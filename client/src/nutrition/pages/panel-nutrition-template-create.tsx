import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  BedDouble,
  CalendarDays,
  Dumbbell,
  Flame,
  HeartPulse,
  Hourglass,
  LampDesk,
  Loader2,
  MoonStar,
  PartyPopper,
  Pill,
  Plus,
  Salad,
  Sparkles,
  Stars,
  Sun,
  Sunset,
  TimerReset,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { buildNutritionTemplateConditions, parseNutritionTemplateConditions, type NutritionDietPlanMode } from "@/nutrition/lib/template-editor-meta";
import type { NutritionDietTemplateItem, NutritionDietTemplateListPayload, NutritionDietTemplateMealSlot } from "@/lib/types";
import { useLocale, useT } from "@/i18n/locale";
import type { MessageKey } from "@/i18n/messages";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/--+/g, "-");
}

const MEAL_SLOT_DEFINITIONS = [
  { key: "breakfast", titleKey: "panelNutritionTemplateCreate.mealSlot.breakfast", iconComponent: Sun },
  { key: "morning_snack", titleKey: "panelNutritionTemplateCreate.mealSlot.morningSnack", iconComponent: Sparkles },
  { key: "lunch", titleKey: "panelNutritionTemplateCreate.mealSlot.lunch", iconComponent: Salad },
  { key: "afternoon_snack", titleKey: "panelNutritionTemplateCreate.mealSlot.afternoonSnack", iconComponent: Sunset },
  { key: "dinner", titleKey: "panelNutritionTemplateCreate.mealSlot.dinner", iconComponent: MoonStar },
  { key: "before_sleep_snack", titleKey: "panelNutritionTemplateCreate.mealSlot.beforeSleepSnack", iconComponent: BedDouble },
  { key: "sahari", titleKey: "panelNutritionTemplateCreate.mealSlot.sahari", iconComponent: Stars },
  { key: "iftar", titleKey: "panelNutritionTemplateCreate.mealSlot.iftar", iconComponent: LampDesk },
  { key: "pre_workout_snack", titleKey: "panelNutritionTemplateCreate.mealSlot.preWorkoutSnack", iconComponent: Dumbbell },
  { key: "post_workout_snack", titleKey: "panelNutritionTemplateCreate.mealSlot.postWorkoutSnack", iconComponent: Flame },
  { key: "pre_fasting_meal", titleKey: "panelNutritionTemplateCreate.mealSlot.preFastingMeal", iconComponent: Hourglass },
  { key: "post_fasting_meal", titleKey: "panelNutritionTemplateCreate.mealSlot.postFastingMeal", iconComponent: TimerReset },
  { key: "recovery_snack", titleKey: "panelNutritionTemplateCreate.mealSlot.recoverySnack", iconComponent: HeartPulse },
  { key: "free_meal", titleKey: "panelNutritionTemplateCreate.mealSlot.freeMeal", iconComponent: PartyPopper },
  { key: "supplement_meal", titleKey: "panelNutritionTemplateCreate.mealSlot.supplementMeal", iconComponent: Pill },
] as const;

const DIET_PLAN_MODE_OPTIONS: Array<{ value: NutritionDietPlanMode; labelKey: MessageKey; descriptionKey: MessageKey }> = [
  { value: "daily_prescription", labelKey: "panelNutritionTemplates.mode.dailyPrescription", descriptionKey: "panelNutritionTemplates.mode.dailyPrescriptionDescription" },
  { value: "user_choice", labelKey: "panelNutritionTemplates.mode.userChoice", descriptionKey: "panelNutritionTemplates.mode.userChoiceDescription" },
  { value: "fixed_text", labelKey: "panelNutritionTemplates.mode.fixedText", descriptionKey: "panelNutritionTemplates.mode.fixedTextDescription" },
];

type Translator = ReturnType<typeof useT>;

function buildDefaultMealSlots(t: Translator): NutritionDietTemplateMealSlot[] {
  return MEAL_SLOT_DEFINITIONS.map((item, index) => ({
    key: item.key,
    title: t(item.titleKey),
    icon: item.key,
    enabled: false,
    description: "",
    foodCount: 0,
    sortOrder: index + 1,
  }));
}

function normalizeMealSlots(mealSlots: NutritionDietTemplateMealSlot[] | null | undefined, t: Translator): NutritionDietTemplateMealSlot[] {
  const current = new Map((mealSlots ?? []).map((item) => [item.key, item]));

  return MEAL_SLOT_DEFINITIONS.map((definition, index) => {
    const item = current.get(definition.key);

    return {
      key: definition.key,
      title: item?.title ?? t(definition.titleKey),
      icon: item?.icon ?? definition.key,
      enabled: item?.enabled ?? false,
      description: item?.description ?? "",
      foodCount: item?.foodCount ?? 0,
      sortOrder: item?.sortOrder ?? index + 1,
    };
  });
}

function flattenTemplates(items: NutritionDietTemplateItem[]): NutritionDietTemplateItem[] {
  return items.flatMap((item) => [item, ...flattenTemplates(item.children)]);
}

export default function PanelNutritionTemplateCreatePage() {
  const t = useT();
  const { dir, isRtl } = useLocale();
  const [, setLocation] = useLocation();
  const [, routeParams] = useRoute("/panel/nutrition/templates/:templateId/edit");
  const templateId = routeParams?.templateId;
  const isEditMode = Boolean(templateId);
  const { isAdmin, isLoading } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [payload, setPayload] = useState<NutritionDietTemplateListPayload | null>(null);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [parentId, setParentId] = useState<string>("none");
  const [dietBasis, setDietBasis] = useState<string>("");
  const [dietLevel, setDietLevel] = useState("");
  const [description, setDescription] = useState("");
  const [templateNotes, setTemplateNotes] = useState("");
  const [conditionsText, setConditionsText] = useState("");
  const [dietPlanMode, setDietPlanMode] = useState<NutritionDietPlanMode>("daily_prescription");
  const [allowFoodReplacement, setAllowFoodReplacement] = useState(false);
  const [suggestDailyReplacements, setSuggestDailyReplacements] = useState(false);
  const [showDietExplanations, setShowDietExplanations] = useState(false);
  const [dietExplanationPrompt, setDietExplanationPrompt] = useState("");
  const [durationDays, setDurationDays] = useState("30");
  const [supplementsEnabled, setSupplementsEnabled] = useState(false);
  const [supplementNotes, setSupplementNotes] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [isActive, setIsActive] = useState(true);
  const [applicableGoals, setApplicableGoals] = useState<string[]>([]);
  const [mealSlots, setMealSlots] = useState<NutritionDietTemplateMealSlot[]>(() => buildDefaultMealSlots(t));
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [removeImage, setRemoveImage] = useState(false);
  const [initializedTemplateId, setInitializedTemplateId] = useState<string | null>(null);

  const BackIcon = isRtl ? ArrowRight : ArrowLeft;

  useEffect(() => {
    if (isLoading || !isAdmin) {
      return;
    }

    api.nutritionTemplates.list().then((res) => {
      if (res.success) {
        setPayload(res.data);
      } else {
        toast({ variant: "destructive", title: t("common.error"), description: res.message });
      }
      setLoading(false);
    });
  }, [isAdmin, isLoading, t, toast]);

  const editingTemplate = useMemo(() => {
    if (!payload || !templateId) {
      return null;
    }

    return flattenTemplates(payload.items).find((item) => item.id === templateId) ?? null;
  }, [payload, templateId]);

  useEffect(() => {
    if (!isEditMode || !editingTemplate || initializedTemplateId === editingTemplate.id) {
      return;
    }

    const parsed = parseNutritionTemplateConditions(editingTemplate.conditionsText);
    setName(editingTemplate.name);
    setSlug(editingTemplate.slug);
    setParentId(editingTemplate.parentId ?? "none");
    setDietBasis(editingTemplate.dietBasis);
    setDietLevel(editingTemplate.dietLevel ?? "");
    setDescription(editingTemplate.description ?? "");
    setTemplateNotes(editingTemplate.templateNotes ?? "");
    setConditionsText(parsed.cleanText);
    setDietPlanMode(editingTemplate.prescriptionMode ?? parsed.meta.dietPlanMode);
    setAllowFoodReplacement(editingTemplate.allowFoodReplacement ?? parsed.meta.allowFoodReplacement);
    setSuggestDailyReplacements(editingTemplate.suggestDailyReplacements ?? parsed.meta.suggestDailyReplacements);
    setShowDietExplanations(editingTemplate.showDietExplanations ?? false);
    setDietExplanationPrompt(editingTemplate.dietExplanationPrompt ?? "");
    setDurationDays(String(editingTemplate.durationDays ?? 30));
    setSupplementsEnabled(editingTemplate.supplementsEnabled ?? false);
    setSupplementNotes(editingTemplate.supplementNotes ?? "");
    setSortOrder(String(editingTemplate.sortOrder));
    setIsActive(editingTemplate.isActive);
    setApplicableGoals(editingTemplate.applicableGoals);
    setMealSlots(normalizeMealSlots(editingTemplate.mealSlots, t));
    setImageFile(null);
    setImagePreview(editingTemplate.imageUrl ?? "");
    setRemoveImage(false);
    setInitializedTemplateId(editingTemplate.id);
  }, [editingTemplate, initializedTemplateId, isEditMode, t]);

  const canSubmit = useMemo(() => name.trim() && dietBasis && applicableGoals.length > 0, [applicableGoals.length, dietBasis, name]);
  const shouldShowMealSlots = dietPlanMode !== "fixed_text";
  const shouldShowReplacementToggle = dietPlanMode === "daily_prescription";

  if (isLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a101a] p-4 text-white" dir={dir}>
        <div className="flex items-center gap-2 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          {t("panelNutritionTemplateCreate.loading.prepare")}
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a101a] p-4 text-white" dir={dir}>
        <div className="w-full max-w-md space-y-4 text-center">
          <h1 className="text-xl font-bold">{t("panelNutritionTemplates.accessDenied.title")}</h1>
          <p className="leading-7 text-slate-400">{t("panelNutritionTemplates.accessDenied.description")}</p>
          <Link href="/panel">
            <Button>{t("panelNutritionTemplates.backToPanel")}</Button>
          </Link>
        </div>
      </div>
    );
  }

  const parentOptions = payload?.parentOptions ?? [];
  const availableParentOptions = isEditMode
    ? parentOptions.filter((option) => option.id !== templateId && option.canHaveChild)
    : parentOptions.filter((option) => option.canHaveChild);

  if (isEditMode && payload && !editingTemplate) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a101a] p-4 text-white" dir={dir}>
        <div className="w-full max-w-md space-y-4 text-center">
          <h1 className="text-xl font-bold">{t("panelNutritionTemplateCreate.notFound.title")}</h1>
          <p className="leading-7 text-slate-400">{t("panelNutritionTemplateCreate.notFound.description")}</p>
          <Button onClick={() => setLocation("/panel/nutrition/templates")}>{t("panelNutritionTemplateCreate.backToTemplates")}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a101a] pb-20 text-white" dir={dir}>
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.12),transparent_20%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.10),transparent_24%),linear-gradient(180deg,#0a101a,#0c1320)]" />
      <header className="sticky top-0 z-10 border-b border-white/10 bg-[#0a101a]/80 backdrop-blur-xl">
        <div className="container mx-auto flex items-center justify-between px-4 py-5">
          <div className="space-y-1">
            <h1 className="text-2xl font-black">{isEditMode ? t("panelNutritionTemplateCreate.header.editTitle") : t("panelNutritionTemplateCreate.header.createTitle")}</h1>
            <p className="text-sm text-slate-400">{isEditMode ? t("panelNutritionTemplateCreate.header.editDescription") : t("panelNutritionTemplateCreate.header.createDescription")}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setLocation("/panel/nutrition/templates")}
            className="h-11 rounded-2xl border-white/10 bg-white/[0.04] px-4 text-white hover:bg-white/[0.08]"
          >
            <BackIcon className={`me-2 h-4 w-4 ${isRtl ? "rotate-180" : ""}`} />
            {t("common.back")}
          </Button>
        </div>
      </header>

      <main className="container mx-auto max-w-6xl px-4 py-6">
        <Card className="border-white/10 bg-[linear-gradient(180deg,rgba(18,26,40,0.92),rgba(11,16,27,0.94))]">
          <CardHeader>
            <CardTitle className="text-white">{isEditMode ? t("panelNutritionTemplateCreate.form.editTitle") : t("panelNutritionTemplateCreate.form.createTitle")}</CardTitle>
            <CardDescription className="text-slate-400">{t("panelNutritionTemplateCreate.form.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("panelNutritionTemplateCreate.fields.name")}</Label>
                <Input
                  value={name}
                  onChange={(e) => {
                    const nextName = e.target.value;
                    setName(nextName);
                    setSlug((current) => (current ? current : slugify(nextName)));
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("panelNutritionTemplateCreate.fields.slug")}</Label>
                <Input value={slug} onChange={(e) => setSlug(slugify(e.target.value))} className="text-start [direction:ltr]" />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("panelNutritionTemplateCreate.fields.image")}</Label>
                <Input
                  type="file"
                  accept=".jpg,.jpeg,.png,.gif,.webp,.avif,image/jpeg,image/png,image/gif,image/webp,image/avif"
                  onChange={(event) => {
                    const file = event.target.files?.[0] || null;
                    setImageFile(file);
                    setImagePreview(file ? URL.createObjectURL(file) : "");
                    if (file) {
                      setRemoveImage(false);
                    }
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("panelNutritionTemplateCreate.fields.parent")}</Label>
                <Select value={parentId} onValueChange={setParentId}>
                  <SelectTrigger><SelectValue placeholder={t("panelNutritionTemplateCreate.parent.none")} /></SelectTrigger>
                  <SelectContent dir={dir}>
                    <SelectItem value="none">{t("panelNutritionTemplateCreate.parent.none")}</SelectItem>
                    {availableParentOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {imagePreview ? (
              <div className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-black/20">
                <img src={imagePreview} alt={t("panelNutritionTemplateCreate.imagePreviewAlt")} className="h-64 w-full object-cover" />
              </div>
            ) : null}

            {isEditMode ? (
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
                <div>
                  <div className="font-bold">{t("panelNutritionTemplateCreate.removeImage.title")}</div>
                  <div className="text-xs text-slate-500">{t("panelNutritionTemplateCreate.removeImage.description")}</div>
                </div>
                <Switch
                  checked={removeImage}
                  onCheckedChange={(checked) => {
                    setRemoveImage(checked);
                    if (checked) {
                      setImageFile(null);
                      setImagePreview("");
                    } else {
                      setImagePreview(editingTemplate?.imageUrl ?? "");
                    }
                  }}
                />
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-2 xl:col-span-2">
                <Label>{t("panelNutritionTemplateCreate.fields.dietPlanMode")}</Label>
                <Select value={dietPlanMode} onValueChange={(value) => setDietPlanMode(value as NutritionDietPlanMode)}>
                  <SelectTrigger><SelectValue placeholder={t("panelNutritionTemplateCreate.placeholders.dietPlanMode")} /></SelectTrigger>
                  <SelectContent dir={dir}>
                    {DIET_PLAN_MODE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{t(option.labelKey)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs leading-7 text-slate-300">
                  {t(DIET_PLAN_MODE_OPTIONS.find((option) => option.value === dietPlanMode)?.descriptionKey ?? "panelNutritionTemplates.mode.dailyPrescriptionDescription")}
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t("panelNutritionTemplateCreate.fields.dietBasis")}</Label>
                <Select value={dietBasis} onValueChange={setDietBasis}>
                  <SelectTrigger><SelectValue placeholder={t("panelNutritionTemplateCreate.placeholders.dietBasis")} /></SelectTrigger>
                  <SelectContent dir={dir}>
                    {payload?.dietBasisOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("panelNutritionTemplateCreate.fields.dietLevel")}</Label>
                <Input
                  value={dietLevel}
                  onChange={(e) => setDietLevel(e.target.value)}
                  placeholder={t("panelNutritionTemplateCreate.placeholders.dietLevel")}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("panelNutritionTemplateCreate.fields.durationDays")}</Label>
                <div className="relative">
                  <Input type="number" min="1" max="365" value={durationDays} onChange={(e) => setDurationDays(e.target.value)} className="pe-10" />
                  <CalendarDays className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t("panelNutritionTemplateCreate.fields.sortOrder")}</Label>
                <Input type="number" min="0" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <div>
                  <div className="font-bold">{t("panelNutritionTemplateCreate.active.title")}</div>
                  <div className="text-xs text-slate-500">{t("panelNutritionTemplateCreate.active.description")}</div>
                </div>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </div>
            </div>

            {shouldShowReplacementToggle ? (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
                  <div>
                    <div className="font-bold">{t("panelNutritionTemplateCreate.replacement.title")}</div>
                    <div className="text-xs text-slate-500">{t("panelNutritionTemplateCreate.replacement.description")}</div>
                  </div>
                  <Switch checked={allowFoodReplacement} onCheckedChange={setAllowFoodReplacement} />
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
                  <div>
                    <div className="font-bold">{t("panelNutritionTemplateCreate.dailyReplacement.title")}</div>
                    <div className="text-xs text-slate-500">{t("panelNutritionTemplateCreate.dailyReplacement.description")}</div>
                  </div>
                  <Switch checked={suggestDailyReplacements} onCheckedChange={setSuggestDailyReplacements} />
                </div>
              </div>
            ) : null}

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="font-bold">{t("panelNutritionTemplateCreate.explanations.title")}</div>
                  <div className="text-xs text-slate-500">{t("panelNutritionTemplateCreate.explanations.description")}</div>
                </div>
                <Switch checked={showDietExplanations} onCheckedChange={setShowDietExplanations} />
              </div>
              {showDietExplanations ? (
                <div className="mt-4 space-y-2">
                  <Label>{t("panelNutritionTemplateCreate.fields.dietExplanationPrompt")}</Label>
                  <Textarea
                    className="min-h-[130px]"
                    value={dietExplanationPrompt}
                    onChange={(e) => setDietExplanationPrompt(e.target.value)}
                    placeholder={t("panelNutritionTemplateCreate.placeholders.dietExplanationPrompt")}
                  />
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
              <div>
                <div className="font-bold">{t("panelNutritionTemplateCreate.supplements.title")}</div>
                <div className="text-xs text-slate-500">{t("panelNutritionTemplateCreate.supplements.description")}</div>
              </div>
              <Switch checked={supplementsEnabled} onCheckedChange={setSupplementsEnabled} />
            </div>

            {supplementsEnabled ? (
              <div className="space-y-2">
                <Label>{t("panelNutritionTemplateCreate.fields.supplementNotes")}</Label>
                <Textarea
                  className="min-h-[120px]"
                  value={supplementNotes}
                  onChange={(e) => setSupplementNotes(e.target.value)}
                  placeholder={t("panelNutritionTemplateCreate.placeholders.supplementNotes")}
                />
              </div>
            ) : null}

            <div className="space-y-3">
              <Label>{t("panelNutritionTemplateCreate.fields.goals")}</Label>
              <div className="grid gap-2 md:grid-cols-3">
                {payload?.goalOptions.map((goal) => {
                  const active = applicableGoals.includes(goal.value);
                  return (
                    <button
                      key={goal.value}
                      type="button"
                      onClick={() => setApplicableGoals((current) => active ? current.filter((item) => item !== goal.value) : [...current, goal.value])}
                      className={`rounded-2xl border px-4 py-3 text-start text-sm font-bold transition ${active ? "border-primary/40 bg-primary/10 text-primary" : "border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.06]"}`}
                    >
                      {goal.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("panelNutritionTemplateCreate.fields.description")}</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{dietPlanMode === "fixed_text" ? t("panelNutritionTemplateCreate.fields.fixedText") : t("panelNutritionTemplateCreate.fields.templateNotes")}</Label>
                <Textarea
                  className="min-h-[150px]"
                  value={templateNotes}
                  onChange={(e) => setTemplateNotes(e.target.value)}
                  placeholder={
                    dietPlanMode === "fixed_text"
                      ? t("panelNutritionTemplateCreate.placeholders.fixedText")
                      : t("panelNutritionTemplateCreate.placeholders.templateNotes")
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("panelNutritionTemplateCreate.fields.conditions")}</Label>
              <Textarea className="min-h-[120px]" value={conditionsText} onChange={(e) => setConditionsText(e.target.value)} />
            </div>

            {shouldShowMealSlots ? (
              <div className="space-y-4">
                <div>
                  <div className="font-bold">{t("panelNutritionTemplateCreate.mealSlots.title")}</div>
                  <div className="text-sm text-slate-400">{t("panelNutritionTemplateCreate.mealSlots.description")}</div>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  {[...mealSlots]
                    .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title))
                    .map((item) => {
                    const definition = MEAL_SLOT_DEFINITIONS.find((slot) => slot.key === item.key);
                    if (!definition) {
                      return null;
                    }
                    const Icon = definition.iconComponent;

                    return (
                      <div key={definition.key} className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-[1rem] bg-primary/10 text-primary">
                              <Icon className="h-5 w-5" />
                            </div>
                            <div className="font-bold">{t(definition.titleKey)}</div>
                          </div>
                          <Switch
                            checked={item.enabled}
                            onCheckedChange={(checked) => {
                              setMealSlots((current) => current.map((slot) => (
                                slot.key === definition.key
                                  ? { ...slot, enabled: checked, foodCount: checked && slot.foodCount <= 0 ? 1 : slot.foodCount }
                                  : slot
                              )));
                            }}
                          />
                        </div>

                        <div className="mt-4 space-y-3">
                          <div className="grid gap-3 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>{t("panelNutritionTemplateCreate.mealSlots.sortOrder")}</Label>
                            <Input
                              type="number"
                              min="1"
                              value={String(item.sortOrder)}
                              onChange={(e) => {
                                const value = Math.max(1, Number(e.target.value) || 1);
                                setMealSlots((current) => current.map((slot) => (
                                  slot.key === definition.key
                                    ? { ...slot, sortOrder: value }
                                    : slot
                                )));
                              }}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>{t("panelNutritionTemplateCreate.mealSlots.foodCount")}</Label>
                            <Input
                              type="number"
                              min="0"
                              value={String(item.foodCount)}
                              onChange={(e) => {
                                const value = Math.max(0, Number(e.target.value) || 0);
                                setMealSlots((current) => current.map((slot) => (
                                  slot.key === definition.key
                                    ? { ...slot, foodCount: value, enabled: value > 0 ? true : slot.enabled }
                                    : slot
                                )));
                              }}
                            />
                          </div>
                          </div>
                          <div className="space-y-2">
                            <Label>{t("panelNutritionTemplateCreate.mealSlots.descriptionField")}</Label>
                            <Textarea
                              className="min-h-[120px]"
                              value={item.description ?? ""}
                              onChange={(e) => {
                                setMealSlots((current) => current.map((slot) => (
                                  slot.key === definition.key
                                    ? { ...slot, description: e.target.value }
                                    : slot
                                )));
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="rounded-[1.75rem] border border-amber-300/20 bg-amber-300/10 px-4 py-4">
                <div className="font-bold text-amber-100">{t("panelNutritionTemplateCreate.fixedTextNotice.title")}</div>
                <div className="mt-2 text-sm leading-7 text-amber-50/85">
                  {t("panelNutritionTemplateCreate.fixedTextNotice.description")}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="h-12 flex-1 rounded-2xl border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]"
                onClick={() => setLocation("/panel/nutrition/templates")}
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="button"
                className="h-12 flex-1 rounded-2xl bg-[linear-gradient(135deg,#f59e0b,#fbbf24)] font-black text-slate-950 hover:opacity-95"
                disabled={!canSubmit || submitting}
                onClick={async () => {
                  setSubmitting(true);
                  const submitPayload = {
                    name,
                    slug,
                    parentId: parentId === "none" ? null : parentId,
                    image: imageFile,
                    dietBasis,
                    dietLevel,
                    applicableGoals,
                    mealSlots: mealSlots.map((slot) => ({
                      ...slot,
                      description: slot.description ?? "",
                    })),
                    prescriptionMode: dietPlanMode,
                    allowFoodReplacement: shouldShowReplacementToggle ? allowFoodReplacement : false,
                    suggestDailyReplacements: shouldShowReplacementToggle ? suggestDailyReplacements : false,
                    showDietExplanations,
                    dietExplanationPrompt,
                    description,
                    templateNotes,
                    conditionsText: buildNutritionTemplateConditions(conditionsText, {
                      dietPlanMode,
                      allowFoodReplacement: shouldShowReplacementToggle ? allowFoodReplacement : false,
                      suggestDailyReplacements: shouldShowReplacementToggle ? suggestDailyReplacements : false,
                    }),
                    durationDays: Number(durationDays) || 30,
                    supplementsEnabled,
                    supplementNotes,
                    sortOrder: Number(sortOrder) || 0,
                    isActive,
                  };
                  const res = isEditMode && templateId
                    ? await api.nutritionTemplates.update(templateId, {
                      ...submitPayload,
                      removeImage,
                    })
                    : await api.nutritionTemplates.create(submitPayload);
                  setSubmitting(false);
                  if (!res.success) {
                    toast({ variant: "destructive", title: t("common.error"), description: res.message });
                    return;
                  }
                  toast({ title: isEditMode ? t("panelNutritionTemplateCreate.toast.saved") : t("panelNutritionTemplateCreate.toast.created"), description: res.message });
                  setLocation("/panel/nutrition/templates");
                }}
              >
                {submitting ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Plus className="me-2 h-4 w-4" />}
                {isEditMode ? t("panelNutritionTemplateCreate.actions.saveChanges") : t("panelNutritionTemplateCreate.actions.create")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
