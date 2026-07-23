import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useRoute } from "wouter";
import { ArrowLeft, ArrowRight, Loader2, Pencil, RefreshCcw, Sparkles, Trash2, UtensilsCrossed } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import type { NutritionDietRequest, NutritionMealReplacementSuggestion } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { subscribeNutritionMealReplacementSuggestionUpdates } from "@/lib/realtime";
import { useFormat, useLocale, useT } from "@/i18n/locale";

type MealReplacementTarget = {
  key: string;
  sourceType: "meal_slot" | "daily_meal";
  mealSlotKey: string;
  slotTitle: string;
  dayNumber?: number;
  mealIndex?: number;
  originLabel?: string;
};

type EditOptionDraft = {
  suggestionId: string;
  optionId: string;
  title: string;
  description: string;
  preparationText: string;
  quantityText: string;
  grams: string;
  calories: string;
  matchReason: string;
};

type Translator = ReturnType<typeof useT>;

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function mealSlotLabel(slotKey: string | null | undefined, t: Translator) {
  switch ((slotKey ?? "").trim()) {
    case "breakfast":
      return t("panelNutritionReplacements.mealSlot.breakfast");
    case "morning_snack":
      return t("panelNutritionReplacements.mealSlot.morningSnack");
    case "lunch":
      return t("panelNutritionReplacements.mealSlot.lunch");
    case "afternoon_snack":
      return t("panelNutritionReplacements.mealSlot.afternoonSnack");
    case "dinner":
      return t("panelNutritionReplacements.mealSlot.dinner");
    case "night_snack":
      return t("panelNutritionReplacements.mealSlot.nightSnack");
    case "snack":
      return t("panelNutritionReplacements.mealSlot.snack");
    default:
      return slotKey || t("panelNutritionReplacements.mealSlot.meal");
  }
}

function normalizeMealSlotKey(value?: unknown) {
  const raw = String(value ?? "").trim();
  if (raw === "") {
    return "";
  }

  return raw
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^A-Za-z0-9_\u0600-\u06FF-]+/g, "")
    .replace(/_+/g, "_");
}

function mealReplacementStatusMeta(status: string | null | undefined, t: Translator) {
  switch (status) {
    case "generated":
      return { label: t("panelNutritionReplacements.status.generated"), variant: "default" as const };
    case "queued":
      return { label: t("panelNutritionReplacements.status.queued"), variant: "secondary" as const };
    case "processing":
      return { label: t("panelNutritionReplacements.status.processing"), variant: "secondary" as const };
    case "failed":
      return { label: t("panelNutritionReplacements.status.failed"), variant: "destructive" as const };
    case "cancelled":
      return { label: t("panelNutritionReplacements.status.cancelled"), variant: "outline" as const };
    default:
      return { label: status || t("panelNutritionReplacements.status.unknown"), variant: "outline" as const };
  }
}

function buildTargets(item: NutritionDietRequest | null, t: Translator): MealReplacementTarget[] {
  const prescription = item?.currentPrescription;
  const content = prescription?.contentSnapshot;

  if (!prescription || !content || prescription.prescriptionMode !== "daily_prescription") {
    return [];
  }

  const contentRecord = asRecord(content);
  const targets = new Map<string, MealReplacementTarget>();

  asArray(contentRecord.day_plans).forEach((planValue, planIndex) => {
    const plan = asRecord(planValue);
    asArray(plan.meals).forEach((mealValue, mealIndex) => {
      const meal = asRecord(mealValue);
      const mealSlotKey = normalizeMealSlotKey(meal.slot_key ?? meal.title ?? `meal_${mealIndex + 1}`);

      if (mealSlotKey === "" || targets.has(mealSlotKey)) {
        return;
      }

      targets.set(mealSlotKey, {
        key: mealSlotKey,
        sourceType: "daily_meal",
        mealSlotKey,
        slotTitle: String(meal.title ?? mealSlotLabel(mealSlotKey, t)),
        dayNumber: Number(plan.day_number ?? planIndex + 1) || undefined,
        mealIndex,
        originLabel: String(meal.meal_text ?? ""),
      });
    });
  });

  return Array.from(targets.values());
}

export default function PanelNutritionRequestReplacementsPage() {
  const { isAdmin, isLoading } = useAuth();
  const { toast } = useToast();
  const t = useT();
  const format = useFormat();
  const { dir, isRtl } = useLocale();
  const [match, params] = useRoute("/panel/nutrition/requests/:requestId/replacements");
  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState<NutritionDietRequest | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [promptModes, setPromptModes] = useState<Record<string, "tenant" | "default" | "custom">>({});
  const [customPrompts, setCustomPrompts] = useState<Record<string, string>>({});
  const [expandedPrompts, setExpandedPrompts] = useState<Record<string, boolean>>({});
  const [editingOption, setEditingOption] = useState<EditOptionDraft | null>(null);
  const [savingEditedOption, setSavingEditedOption] = useState(false);

  const requestId = match ? params.requestId : null;
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;
  const formatDateTime = (value?: string | null) => (value ? format.dateTime(value) : "—");
  const formatCount = (value: number) => format.number(value, { maximumFractionDigits: 0 });

  const load = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!requestId) {
      return;
    }

    if (!silent) {
      setLoading(true);
    }

    const result = await api.nutritionDietRequests.adminShow(requestId);

    if (result.success) {
      setItem(result.data.item);
    } else {
      toast({ variant: "destructive", title: t("panelNutritionReplacements.toast.loadFailed"), description: result.message });
    }

    if (!silent) {
      setLoading(false);
    }
  }, [requestId, t, toast]);

  useEffect(() => {
    if (isLoading || !isAdmin || !requestId) {
      return;
    }

    void load();
  }, [isAdmin, isLoading, load, requestId]);

  useEffect(() => {
    const tenantUserId = item?.user?.id;

    if (!tenantUserId) {
      return;
    }

    return subscribeNutritionMealReplacementSuggestionUpdates(tenantUserId, (payload) => {
      if (payload?.suggestion?.id) {
        void load({ silent: true });
      }
    });
  }, [item?.user?.id, load]);

  const targets = useMemo(() => buildTargets(item, t), [item, t]);
  const suggestions = useMemo(() => item?.currentPrescription?.mealReplacementSuggestions ?? item?.mealReplacementSuggestions ?? [], [item]);
  const suggestionMap = useMemo(() => {
    const map = new Map<string, NutritionMealReplacementSuggestion>();

    suggestions.forEach((suggestion) => {
      if (!suggestion.mealSlotKey || map.has(suggestion.mealSlotKey)) {
        return;
      }

      map.set(suggestion.mealSlotKey, suggestion);
    });

    return map;
  }, [suggestions]);

  useEffect(() => {
    if (!targets.length) {
      return;
    }

    setPromptModes((current) => {
      const next = { ...current };
      targets.forEach((target) => {
        const suggestion = suggestionMap.get(target.mealSlotKey);
        if (next[target.key]) {
          return;
        }

        const mode = suggestion?.promptMode;
        next[target.key] = mode === "default" || mode === "custom" ? mode : "tenant";
      });
      return next;
    });

    setCustomPrompts((current) => {
      const next = { ...current };
      targets.forEach((target) => {
        const suggestion = suggestionMap.get(target.mealSlotKey);
        if (typeof next[target.key] === "string") {
          return;
        }

        next[target.key] = suggestion?.customPrompt ?? "";
      });
      return next;
    });
  }, [suggestionMap, targets]);

  const updatePromptMode = useCallback((targetKey: string, value: "tenant" | "default" | "custom") => {
    setPromptModes((current) => ({
      ...current,
      [targetKey]: value,
    }));
  }, []);

  const updateCustomPrompt = useCallback((targetKey: string, value: string) => {
    setCustomPrompts((current) => ({
      ...current,
      [targetKey]: value,
    }));
  }, []);

  const createSuggestion = useCallback(async (target: MealReplacementTarget) => {
    if (!item?.currentPrescription) {
      return;
    }

    const promptMode = promptModes[target.key] ?? "tenant";
    const customPrompt = (customPrompts[target.key] ?? "").trim();

    if (promptMode === "custom" && customPrompt === "") {
      toast({
        variant: "destructive",
        title: t("panelNutritionReplacements.toast.customPromptEmpty"),
        description: t("panelNutritionReplacements.toast.customPromptCreateDescription"),
      });
      return;
    }

    setBusyKey(`create:${target.key}`);
    const result = await api.nutritionDietRequests.adminGenerateMealReplacementSuggestion(item.id, {
      prescriptionId: Number(item.currentPrescription.id),
      sourceType: target.sourceType,
      mealSlotKey: target.mealSlotKey,
      slotTitle: target.slotTitle,
      dayNumber: target.dayNumber,
      mealIndex: target.mealIndex,
      promptMode,
      customPrompt: promptMode === "custom" ? customPrompt : undefined,
    });

    if (result.success) {
      setItem(result.data.item);
      toast({
        title: t("panelNutritionReplacements.toast.createQueued"),
        description: t("panelNutritionReplacements.toast.createQueuedDescription", { meal: target.slotTitle }),
      });
    } else {
      toast({ variant: "destructive", title: t("panelNutritionReplacements.toast.createFailed"), description: result.message || t("common.tryAgain") });
    }

    setBusyKey(null);
  }, [customPrompts, item, promptModes, t, toast]);

  const regenerateSuggestion = useCallback(async (target: MealReplacementTarget, suggestion: NutritionMealReplacementSuggestion) => {
    if (!item) {
      return;
    }

    const promptMode = promptModes[target.key] ?? (suggestion.promptMode === "default" || suggestion.promptMode === "custom" ? suggestion.promptMode : "tenant");
    const customPrompt = (customPrompts[target.key] ?? suggestion.customPrompt ?? "").trim();

    if (promptMode === "custom" && customPrompt === "") {
      toast({
        variant: "destructive",
        title: t("panelNutritionReplacements.toast.customPromptEmpty"),
        description: t("panelNutritionReplacements.toast.customPromptRegenerateDescription"),
      });
      return;
    }

    setBusyKey(`regenerate:${target.key}`);
    const result = await api.nutritionDietRequests.adminRegenerateMealReplacementSuggestion(item.id, suggestion.id, {
      promptMode,
      customPrompt: promptMode === "custom" ? customPrompt : undefined,
    });

    if (result.success) {
      setItem(result.data.item);
      toast({
        title: t("panelNutritionReplacements.toast.regenerateQueued"),
        description: t("panelNutritionReplacements.toast.regenerateQueuedDescription", { meal: target.slotTitle }),
      });
    } else {
      toast({ variant: "destructive", title: t("panelNutritionReplacements.toast.regenerateFailed"), description: result.message || t("common.tryAgain") });
    }

    setBusyKey(null);
  }, [customPrompts, item, promptModes, t, toast]);

  const deleteSuggestion = useCallback(async (target: MealReplacementTarget, suggestion: NutritionMealReplacementSuggestion) => {
    if (!item) {
      return;
    }

    setBusyKey(`delete:${target.key}`);
    const result = await api.nutritionDietRequests.adminDeleteMealReplacementSuggestion(item.id, suggestion.id);

    if (result.success) {
      setItem(result.data.item);
      toast({
        title: t("panelNutritionReplacements.toast.deleteSuccess"),
        description: t("panelNutritionReplacements.toast.deleteSuccessDescription", { meal: target.slotTitle }),
      });
    } else {
      toast({ variant: "destructive", title: t("panelNutritionReplacements.toast.deleteFailed"), description: result.message || t("common.tryAgain") });
    }

    setBusyKey(null);
  }, [item, t, toast]);

  const cancelSuggestion = useCallback(async (target: MealReplacementTarget, suggestion: NutritionMealReplacementSuggestion) => {
    if (!item) {
      return;
    }

    setBusyKey(`cancel:${target.key}`);
    const result = await api.nutritionDietRequests.adminCancelMealReplacementSuggestion(item.id, suggestion.id);

    if (result.success) {
      setItem(result.data.item);
      toast({
        title: t("panelNutritionReplacements.toast.cancelSuccess"),
        description: t("panelNutritionReplacements.toast.cancelSuccessDescription", { meal: target.slotTitle }),
      });
    } else {
      toast({ variant: "destructive", title: t("panelNutritionReplacements.toast.cancelFailed"), description: result.message || t("common.tryAgain") });
    }

    setBusyKey(null);
  }, [item, t, toast]);

  const saveEditedOption = useCallback(async () => {
    if (!item || !editingOption) {
      return;
    }

    setSavingEditedOption(true);
    const result = await api.nutritionDietRequests.adminUpdateMealReplacementSuggestionOption(item.id, editingOption.suggestionId, {
      optionId: editingOption.optionId,
      title: editingOption.title,
      description: editingOption.description,
      preparationText: editingOption.preparationText,
      quantityText: editingOption.quantityText,
      grams: editingOption.grams.trim() === "" ? 0 : Number(editingOption.grams),
      calories: editingOption.calories.trim() === "" ? 0 : Number(editingOption.calories),
      matchReason: editingOption.matchReason,
    });

    if (result.success) {
      setItem(result.data.item);
      setEditingOption(null);
      toast({
        title: t("panelNutritionReplacements.toast.editSaved"),
        description: t("panelNutritionReplacements.toast.editSavedDescription"),
      });
    } else {
      toast({ variant: "destructive", title: t("panelNutritionReplacements.toast.editFailed"), description: result.message || t("common.tryAgain") });
    }

    setSavingEditedOption(false);
  }, [editingOption, item, t, toast]);

  if (isLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground" dir={dir}>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          {t("panelNutritionReplacements.loading")}
        </div>
      </div>
    );
  }

  if (!isAdmin || !item?.currentPrescription) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground" dir={dir}>
        <div className="w-full max-w-md space-y-4 text-center">
          <h1 className="text-xl font-bold">{t("panelNutritionReplacements.empty.title")}</h1>
          <p className="leading-7 text-muted-foreground">{t("panelNutritionReplacements.empty.description")}</p>
          <Link href="/panel/nutrition/requests">
            <Button>{t("panelNutritionReplacements.empty.back")}</Button>
          </Link>
        </div>
      </div>
    );
  }

  const isDailyPrescription = item.currentPrescription.prescriptionMode === "daily_prescription";
  const replacementEnabled = item.currentPrescription.allowFoodReplacement === true;

  return (
    <div className="min-h-screen bg-background pb-20 text-foreground" dir={dir}>
      <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between gap-4 px-4 py-4">
          <div className="space-y-1">
            <h1 className="text-xl font-black">{t("panelNutritionReplacements.header.title", { id: item.id })}</h1>
            <p className="text-sm text-muted-foreground">{t("panelNutritionReplacements.header.description")}</p>
          </div>
          <Link href={`/panel/nutrition/requests/${item.id}`}>
            <Button variant="outline" size="icon" className="h-10 w-10 rounded-2xl">
              <BackIcon className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-border/70 bg-card/60">
            <CardContent className="p-5">
              <div className="text-xs text-muted-foreground">{t("panelNutritionReplacements.stats.targets")}</div>
              <div className="mt-2 text-3xl font-black">{formatCount(targets.length)}</div>
            </CardContent>
          </Card>
          <Card className="border-border/70 bg-card/60">
            <CardContent className="p-5">
              <div className="text-xs text-muted-foreground">{t("panelNutritionReplacements.stats.generated")}</div>
              <div className="mt-2 text-3xl font-black">{formatCount(suggestions.filter((suggestion) => suggestion.status === "generated").length)}</div>
            </CardContent>
          </Card>
          <Card className="border-border/70 bg-card/60">
            <CardContent className="p-5">
              <div className="text-xs text-muted-foreground">{t("panelNutritionReplacements.stats.pending")}</div>
              <div className="mt-2 text-3xl font-black">{formatCount(suggestions.filter((suggestion) => suggestion.status === "queued" || suggestion.status === "processing").length)}</div>
            </CardContent>
          </Card>
        </div>

        {!isDailyPrescription ? (
          <Card className="mt-6 border-border/70 bg-card/60">
            <CardContent className="p-6 text-sm leading-8 text-muted-foreground">
              {t("panelNutritionReplacements.dailyOnly.prefix")} <span className="font-bold text-foreground">{t("panelNutritionReplacements.dailyOnly.mode")}</span> {t("panelNutritionReplacements.dailyOnly.suffix")}
            </CardContent>
          </Card>
        ) : null}

        {isDailyPrescription && !replacementEnabled ? (
          <Card className="mt-6 border-amber-400/20 bg-amber-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UtensilsCrossed className="h-5 w-5 text-amber-400" />
                {t("panelNutritionReplacements.disabled.title")}
              </CardTitle>
              <CardDescription>
                {t("panelNutritionReplacements.disabled.description")}
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        {isDailyPrescription && replacementEnabled ? (
          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            {targets.map((target) => {
              const suggestion = suggestionMap.get(target.mealSlotKey);
              const statusMeta = mealReplacementStatusMeta(suggestion?.status, t);
              const promptMode = promptModes[target.key] ?? (suggestion?.promptMode === "default" || suggestion?.promptMode === "custom" ? suggestion.promptMode : "tenant");
              const customPrompt = customPrompts[target.key] ?? suggestion?.customPrompt ?? "";
              const isCreating = busyKey === `create:${target.key}`;
              const isRegenerating = busyKey === `regenerate:${target.key}`;
              const isDeleting = busyKey === `delete:${target.key}`;
              const isCancelling = busyKey === `cancel:${target.key}`;
              const isPendingSuggestion = suggestion?.status === "queued" || suggestion?.status === "processing";
              const isBusy = isCreating || isRegenerating || isDeleting || isCancelling;

              return (
                <Card key={target.key} className="relative overflow-hidden border-border/70 bg-card/60">
                  {isBusy || isPendingSuggestion ? (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-slate-950/55 backdrop-blur-[2px]">
                      <Loader2 className="h-6 w-6 animate-spin text-amber-300" />
                      <div className="text-sm font-bold text-white">
                        {isCreating
                          ? t("panelNutritionReplacements.busy.create")
                          : isRegenerating
                            ? t("panelNutritionReplacements.busy.regenerate")
                            : isDeleting
                              ? t("panelNutritionReplacements.busy.delete")
                              : isCancelling
                                ? t("panelNutritionReplacements.busy.cancel")
                                : suggestion?.status === "processing"
                                  ? t("panelNutritionReplacements.busy.processing")
                                  : t("panelNutritionReplacements.busy.queued")}
                      </div>
                      {suggestion && isPendingSuggestion ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => void cancelSuggestion(target, suggestion)}
                          disabled={isCancelling}
                          className="rounded-2xl border-rose-400/40 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20"
                        >
                          {isCancelling ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
                          {t("panelNutritionReplacements.actions.cancelRequest")}
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle>{target.slotTitle}</CardTitle>
                        <CardDescription className="mt-2 leading-7">
                          {target.originLabel?.trim() ? target.originLabel : t("panelNutritionReplacements.card.sharedListDescription")}
                        </CardDescription>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
                        {suggestion?.cacheScopeLabel ? <Badge variant="outline">{suggestion.cacheScopeLabel}</Badge> : null}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl border border-border/70 bg-background/40 p-3">
                        <div className="text-xs text-muted-foreground">{t("panelNutritionReplacements.card.mealKey")}</div>
                        <div className="mt-1 font-bold">{target.mealSlotKey}</div>
                      </div>
                      <div className="rounded-2xl border border-border/70 bg-background/40 p-3">
                        <div className="text-xs text-muted-foreground">{t("panelNutritionReplacements.card.lastPromptMode")}</div>
                        <div className="mt-1 font-bold">{suggestion?.promptModeLabel ?? t("panelNutritionReplacements.card.noListYet")}</div>
                      </div>
                      <div className="rounded-2xl border border-border/70 bg-background/40 p-3">
                        <div className="text-xs text-muted-foreground">{t("panelNutritionReplacements.card.requestedAt")}</div>
                        <div className="mt-1 font-bold">{formatDateTime(suggestion?.requestedAt)}</div>
                      </div>
                      <div className="rounded-2xl border border-border/70 bg-background/40 p-3">
                        <div className="text-xs text-muted-foreground">{t("panelNutritionReplacements.card.optionCount")}</div>
                        <div className="mt-1 font-bold">{formatCount(Number(suggestion?.suggestionCount ?? 0))}</div>
                      </div>
                    </div>

                    <div className="grid gap-3 lg:grid-cols-[180px_minmax(0,1fr)]">
                      <div className="space-y-2">
                        <Label>{t("panelNutritionReplacements.prompt.mode")}</Label>
                        <Select value={promptMode} onValueChange={(value) => updatePromptMode(target.key, value as "tenant" | "default" | "custom")}>
                          <SelectTrigger className="rounded-2xl">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="tenant">{t("panelNutritionReplacements.prompt.tenant")}</SelectItem>
                            <SelectItem value="default">{t("panelNutritionReplacements.prompt.default")}</SelectItem>
                            <SelectItem value="custom">{t("panelNutritionReplacements.prompt.custom")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>{t("panelNutritionReplacements.prompt.customLabel")}</Label>
                        <Textarea
                          value={customPrompt}
                          onChange={(event) => updateCustomPrompt(target.key, event.target.value)}
                          className="min-h-24 rounded-2xl leading-7"
                          placeholder={t("panelNutritionReplacements.prompt.customPlaceholder")}
                          disabled={promptMode !== "custom"}
                        />
                      </div>
                    </div>

                    {suggestion?.effectiveSystemPrompt ? (
                      <div className="rounded-2xl border border-border/70 bg-background/30 p-4">
                        <div className="text-xs font-bold text-muted-foreground">{t("panelNutritionReplacements.prompt.effective")}</div>
                        <div className={`mt-2 whitespace-pre-wrap text-sm leading-7 ${expandedPrompts[suggestion.id] ? "" : "line-clamp-3"}`}>
                          {suggestion.effectiveSystemPrompt}
                        </div>
                        {suggestion.effectiveSystemPrompt.trim() !== "" ? (
                          <button
                            type="button"
                            onClick={() => setExpandedPrompts((current) => ({
                              ...current,
                              [suggestion.id]: !current[suggestion.id],
                            }))}
                            className="mt-3 text-xs font-bold text-amber-300 transition hover:text-amber-200"
                          >
                            {expandedPrompts[suggestion.id] ? t("common.close") : t("panelNutritionReplacements.prompt.readMore")}
                          </button>
                        ) : null}
                      </div>
                    ) : null}

                    {suggestion?.errorMessage ? (
                      <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm leading-7 text-rose-100">
                        {suggestion.errorMessage}
                      </div>
                    ) : null}

                    {suggestion?.options?.length ? (
                      <div className="rounded-2xl border border-emerald-400/15 bg-emerald-500/[0.05] p-4">
                        <div className="font-black">{t("panelNutritionReplacements.options.title")}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {suggestion.generatedAt
                            ? t("panelNutritionReplacements.options.generatedAt", { date: formatDateTime(suggestion.generatedAt) })
                            : t("panelNutritionReplacements.options.saved")}
                        </div>
                        <div className="mt-4 space-y-3">
                          {suggestion.options.map((option, index) => (
                            <div key={option.id} className="rounded-xl border border-border/70 bg-background/50 p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1">
                                  <div className="font-bold">{`${formatCount(index + 1)}. ${option.title}`}</div>
                                  {option.description.trim() !== "" ? (
                                    <div className="mt-2 text-sm leading-7 text-muted-foreground">{option.description}</div>
                                  ) : null}
                                </div>
                                <div className="flex items-center gap-2">
                                  {option.calories > 0 ? <Badge variant="outline">{t("panelNutritionReplacements.units.kcal", { value: formatCount(option.calories) })}</Badge> : null}
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="outline"
                                    className="h-9 w-9 rounded-xl"
                                    onClick={() => setEditingOption({
                                      suggestionId: suggestion.id,
                                      optionId: option.id,
                                      title: option.title,
                                      description: option.description,
                                      preparationText: option.preparationText,
                                      quantityText: option.quantityText,
                                      grams: String(option.grams ?? ""),
                                      calories: String(option.calories ?? ""),
                                      matchReason: option.matchReason ?? "",
                                    })}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                              {option.quantityText.trim() !== "" ? (
                                <div className="mt-3 text-xs text-muted-foreground">{option.quantityText}</div>
                              ) : null}
                              {option.preparationText.trim() !== "" ? (
                                <div className="mt-3 rounded-xl border border-cyan-400/15 bg-cyan-400/[0.05] px-3 py-3 text-sm leading-7">
                                  {option.preparationText}
                                </div>
                              ) : null}
                              {option.matchReason?.trim() ? (
                                <div className="mt-3 text-xs leading-6 text-muted-foreground">{t("panelNutritionReplacements.options.matchReason", { reason: option.matchReason })}</div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="flex flex-wrap gap-2">
                      {suggestion ? (
                        <>
                          <Button type="button" onClick={() => void regenerateSuggestion(target, suggestion)} disabled={isBusy || isPendingSuggestion} className="rounded-2xl">
                            {isRegenerating ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="me-2 h-4 w-4" />}
                            {t("panelNutritionReplacements.actions.regenerate")}
                          </Button>
                          {isPendingSuggestion ? (
                            <Button type="button" variant="outline" onClick={() => void cancelSuggestion(target, suggestion)} disabled={isBusy} className="rounded-2xl border-amber-400/30 text-amber-100 hover:bg-amber-500/10 hover:text-amber-50">
                              {isCancelling ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
                              {t("panelNutritionReplacements.actions.cancelRequest")}
                            </Button>
                          ) : null}
                          <Button type="button" variant="outline" onClick={() => void deleteSuggestion(target, suggestion)} disabled={isBusy || isPendingSuggestion} className="rounded-2xl border-rose-400/30 text-rose-200 hover:bg-rose-500/10 hover:text-rose-100">
                            {isDeleting ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Trash2 className="me-2 h-4 w-4" />}
                            {t("panelNutritionReplacements.actions.delete")}
                          </Button>
                        </>
                      ) : (
                        <Button type="button" onClick={() => void createSuggestion(target)} disabled={isBusy} className="rounded-2xl">
                          {isCreating ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Sparkles className="me-2 h-4 w-4" />}
                          {t("panelNutritionReplacements.actions.create")}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : null}
      </main>

      <Dialog open={editingOption !== null} onOpenChange={(open) => !open && !savingEditedOption ? setEditingOption(null) : undefined}>
        <DialogContent className="max-w-2xl" dir={dir}>
          <DialogHeader>
            <DialogTitle>{t("panelNutritionReplacements.edit.title")}</DialogTitle>
          </DialogHeader>

          {editingOption ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t("panelNutritionReplacements.edit.foodTitle")}</Label>
                <Input value={editingOption.title} onChange={(event) => setEditingOption((current) => current ? { ...current, title: event.target.value } : current)} />
              </div>

              <div className="space-y-2">
                <Label>{t("panelNutritionReplacements.edit.description")}</Label>
                <Textarea value={editingOption.description} onChange={(event) => setEditingOption((current) => current ? { ...current, description: event.target.value } : current)} className="min-h-24 leading-7" />
              </div>

              <div className="space-y-2">
                <Label>{t("panelNutritionReplacements.edit.preparation")}</Label>
                <Textarea value={editingOption.preparationText} onChange={(event) => setEditingOption((current) => current ? { ...current, preparationText: event.target.value } : current)} className="min-h-24 leading-7" />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>{t("panelNutritionReplacements.edit.quantity")}</Label>
                  <Input value={editingOption.quantityText} onChange={(event) => setEditingOption((current) => current ? { ...current, quantityText: event.target.value } : current)} />
                </div>
                <div className="space-y-2">
                  <Label>{t("panelNutritionReplacements.edit.grams")}</Label>
                  <Input value={editingOption.grams} onChange={(event) => setEditingOption((current) => current ? { ...current, grams: event.target.value } : current)} inputMode="numeric" />
                </div>
                <div className="space-y-2">
                  <Label>{t("panelNutritionReplacements.edit.calories")}</Label>
                  <Input value={editingOption.calories} onChange={(event) => setEditingOption((current) => current ? { ...current, calories: event.target.value } : current)} inputMode="numeric" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t("panelNutritionReplacements.edit.matchReason")}</Label>
                <Textarea value={editingOption.matchReason} onChange={(event) => setEditingOption((current) => current ? { ...current, matchReason: event.target.value } : current)} className="min-h-20 leading-7" />
              </div>
            </div>
          ) : null}

          <DialogFooter className="gap-2 sm:justify-start">
            <Button type="button" onClick={() => void saveEditedOption()} disabled={savingEditedOption || !editingOption} className="rounded-2xl">
              {savingEditedOption ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
              {t("panelNutritionReplacements.edit.save")}
            </Button>
            <Button type="button" variant="outline" onClick={() => setEditingOption(null)} disabled={savingEditedOption} className="rounded-2xl">
              {t("common.close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
