import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileText,
  GitBranchPlus,
  Loader2,
  NotebookPen,
  Pencil,
  Plus,
  SquareDashedBottom,
  Settings2,
  Trash2,
  Volume2,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { parseNutritionTemplateConditions, type NutritionDietPlanMode } from "@/nutrition/lib/template-editor-meta";
import type { NutritionDietTemplateItem, NutritionDietTemplateListPayload } from "@/lib/types";
import { CodeText } from "@/i18n/ltr-text";
import { useFormat, useLocale, useT } from "@/i18n/locale";
import type { MessageKey } from "@/i18n/messages";

const DIET_PLAN_MODE_OPTIONS: Array<{ value: NutritionDietPlanMode; labelKey: MessageKey; descriptionKey: MessageKey }> = [
  { value: "daily_prescription", labelKey: "panelNutritionTemplates.mode.dailyPrescription", descriptionKey: "panelNutritionTemplates.mode.dailyPrescriptionDescription" },
  { value: "user_choice", labelKey: "panelNutritionTemplates.mode.userChoice", descriptionKey: "panelNutritionTemplates.mode.userChoiceDescription" },
  { value: "fixed_text", labelKey: "panelNutritionTemplates.mode.fixedText", descriptionKey: "panelNutritionTemplates.mode.fixedTextDescription" },
];

export default function PanelNutritionTemplatesPage() {
  const t = useT();
  const format = useFormat();
  const { dir, isRtl } = useLocale();
  const [, setLocation] = useLocation();
  const { isAdmin, isLoading } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [payload, setPayload] = useState<NutritionDietTemplateListPayload | null>(null);

  const loadItems = async () => {
    setLoading(true);
    const res = await api.nutritionTemplates.list();
    if (res.success) {
      setPayload(res.data);
    } else {
      toast({ variant: "destructive", title: t("common.error"), description: res.message });
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isLoading || !isAdmin) {
      return;
    }

    void loadItems();
  }, [isAdmin, isLoading]);

  const templateStats = useMemo(() => {
    const flatten = (items: NutritionDietTemplateItem[]): NutritionDietTemplateItem[] =>
      items.flatMap((item) => [item, ...flatten(item.children)]);

    const allItems = payload ? flatten(payload.items) : [];

    return {
      total: allItems.length,
      active: allItems.filter((item) => item.isActive).length,
      withSupplements: allItems.filter((item) => item.supplementsEnabled).length,
      withMeals: allItems.filter((item) => item.mealSlots.some((slot) => slot.enabled)).length,
    };
  }, [payload]);
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a101a] p-4 text-white" dir={dir}>
        <div className="flex items-center gap-2 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          {t("panelNutritionTemplates.loading.prepare")}
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

  const renderTemplateTree = (items: NutritionDietTemplateItem[], level = 0) => (
    <div className={level > 0 ? "me-5 mt-4 border-e border-primary/15 pe-4" : "space-y-5"}>
      {items.map((item) => (
        (() => {
          const parsedConditions = parseNutritionTemplateConditions(item.conditionsText);
          const effectiveDietPlanMode = item.prescriptionMode ?? parsedConditions.meta.dietPlanMode;
          const effectiveAllowFoodReplacement = item.allowFoodReplacement ?? parsedConditions.meta.allowFoodReplacement;
          const effectiveSuggestDailyReplacements = item.suggestDailyReplacements ?? parsedConditions.meta.suggestDailyReplacements;
          const effectiveShowDietExplanations = item.showDietExplanations ?? false;
          const activeMealCount = item.mealSlots.filter((slot) => slot.enabled).length;

          return (
        <div key={item.id} className="space-y-3">
          <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(16,23,37,0.98),rgba(10,15,25,0.96))] shadow-[0_28px_70px_-44px_rgba(0,0,0,0.9)]">
            <div className="space-y-4 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-lg font-black text-white">{item.name}</div>
                    <Badge variant="secondary" className="border-white/10 bg-white/10 text-white">{item.dietBasisLabel}</Badge>
                    <Badge variant={item.isActive ? "default" : "secondary"} className={item.isActive ? "bg-emerald-500/15 text-emerald-300" : "bg-white/10 text-slate-300"}>
                      {item.isActive ? t("panelNutritionTemplates.status.active") : t("panelNutritionTemplates.status.inactive")}
                    </Badge>
                    {item.depth > 0 ? <Badge variant="outline" className="border-white/10 text-slate-300">{t("panelNutritionTemplates.levelBadge", { level: format.number(item.depth) })}</Badge> : null}
                  </div>
                  {item.imageUrl ? (
                    <div className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-black/20">
                      <img src={item.imageUrl} alt={item.name} className="h-44 w-full object-cover sm:h-52" />
                    </div>
                  ) : null}
                  <CodeText className="text-xs text-slate-500">{item.slug}</CodeText>
                  {item.description ? <div className="text-sm leading-7 text-slate-300">{item.description}</div> : null}
                  {parsedConditions.cleanText ? <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs leading-7 text-slate-400">{parsedConditions.cleanText}</div> : null}

                  <div className="grid gap-2 grid-cols-2 sm:grid-cols-3">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3">
                      <div className="text-[11px] font-bold text-slate-500">{t("panelNutritionTemplates.duration")}</div>
                      <div className="mt-2 text-sm font-black text-white">{t("panelNutritionTemplates.daysValue", { count: format.number(item.durationDays) })}</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3">
                      <div className="text-[11px] font-bold text-slate-500">{t("panelNutritionTemplates.activeMeals")}</div>
                      <div className="mt-2 text-sm font-black text-white">{t("panelNutritionTemplates.mealsValue", { count: format.number(activeMealCount) })}</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3">
                      <div className="text-[11px] font-bold text-slate-500">{t("panelNutritionTemplates.supplement")}</div>
                      <div className="mt-2 text-sm font-black text-white">{item.supplementsEnabled ? t("panelNutritionTemplates.status.active") : t("panelNutritionTemplates.status.inactive")}</div>
                    </div>
                  </div>

                  {item.mealSlots.some((slot) => slot.enabled) ? (
                    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-3">
                      <div className="mb-2 text-xs font-bold text-slate-400">{t("panelNutritionTemplates.activeMealsForTemplate")}</div>
                      <div className="flex flex-wrap gap-2">
                        {[...item.mealSlots]
                          .filter((slot) => slot.enabled)
                          .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, "fa"))
                          .map((slot) => (
                          <Badge key={slot.key} variant="outline" className="border-white/10 text-slate-200">
                            {`${format.number(slot.sortOrder)}. ${slot.title}`}
                            {slot.foodCount > 0 ? ` • ${t("panelNutritionTemplates.foodCount", { count: format.number(slot.foodCount) })}` : ""}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    {item.applicableGoalLabels.map((goal) => (
                      <Badge key={goal} variant="outline" className="border-white/10 text-slate-200">{goal}</Badge>
                    ))}
                    <Badge variant="secondary" className="border-white/10 bg-white/10 text-white">{t("panelNutritionTemplates.daysBadge", { count: format.number(item.durationDays) })}</Badge>
                    <Badge variant="outline" className="border-white/10 text-slate-200">
                      {t(DIET_PLAN_MODE_OPTIONS.find((option) => option.value === effectiveDietPlanMode)?.labelKey ?? "panelNutritionTemplates.mode.dailyPrescription")}
                    </Badge>
                    {effectiveDietPlanMode === "daily_prescription" ? (
                      <Badge variant={effectiveAllowFoodReplacement ? "default" : "outline"} className={effectiveAllowFoodReplacement ? "bg-cyan-400/15 text-cyan-200" : "border-white/10 text-slate-300"}>
                        {effectiveAllowFoodReplacement ? t("panelNutritionTemplates.replacement.enabled") : t("panelNutritionTemplates.replacement.disabled")}
                      </Badge>
                    ) : null}
                    {effectiveDietPlanMode === "daily_prescription" ? (
                      <Badge variant={effectiveSuggestDailyReplacements ? "default" : "outline"} className={effectiveSuggestDailyReplacements ? "bg-emerald-400/15 text-emerald-200" : "border-white/10 text-slate-300"}>
                        {effectiveSuggestDailyReplacements ? t("panelNutritionTemplates.dailyReplacement.enabled") : t("panelNutritionTemplates.dailyReplacement.disabled")}
                      </Badge>
                    ) : null}
                    <Badge variant={effectiveShowDietExplanations ? "default" : "outline"} className={effectiveShowDietExplanations ? "bg-sky-400/15 text-sky-200" : "border-white/10 text-slate-300"}>
                      {effectiveShowDietExplanations ? t("panelNutritionTemplates.explanations.enabled") : t("panelNutritionTemplates.explanations.disabled")}
                    </Badge>
                    <Badge variant={item.supplementsEnabled ? "default" : "outline"} className={item.supplementsEnabled ? "bg-primary/15 text-primary" : "border-white/10 text-slate-300"}>
                      {item.supplementsEnabled ? t("panelNutritionTemplates.supplements.enabled") : t("panelNutritionTemplates.supplements.disabled")}
                    </Badge>
                  </div>
                  <div className="text-xs text-slate-500">{t("panelNutritionTemplates.sortOrder", { order: format.number(item.sortOrder) })}</div>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
                  {item.depth < 2 ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-11 gap-2 border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]"
                      onClick={() => setLocation(`/panel/nutrition/templates/create?parent=${item.id}`)}
                    >
                      <GitBranchPlus className="h-4 w-4" />
                      {t("panelNutritionTemplates.actions.addChild")}
                    </Button>
                  ) : null}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-11 gap-2 border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]"
                    onClick={() => setLocation(`/panel/nutrition/templates/${item.id}/edit`)}
                  >
                    <Pencil className="h-4 w-4" />
                    {t("panelNutritionTemplates.actions.edit")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-full rounded-2xl text-destructive hover:bg-destructive/10 hover:text-destructive sm:w-11"
                    disabled={deletingId === item.id}
                    onClick={async () => {
                      setDeletingId(item.id);
                      const res = await api.nutritionTemplates.delete(item.id);
                      setDeletingId(null);
                      if (!res.success) {
                        toast({ variant: "destructive", title: t("common.error"), description: res.message });
                        return;
                      }
                      toast({ title: t("panelNutritionTemplates.toast.deleted"), description: res.message });
                      await loadItems();
                    }}
                  >
                    {deletingId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {item.children.length > 0 ? renderTemplateTree(item.children, level + 1) : null}
        </div>
          );
        })()
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a101a] pb-20 text-foreground" dir={dir}>
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.12),transparent_20%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.10),transparent_24%),linear-gradient(180deg,#0a101a,#0c1320)]" />

      <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="space-y-1">
            <h1 className="text-xl font-bold">{t("panelNutritionTemplates.title")}</h1>
          </div>
          <Link href="/panel">
            <Button variant="outline" size="icon" title={t("common.back")} className="h-10 w-10 rounded-2xl border-border bg-background/40 hover:bg-background/70">
              {isRtl ? <ArrowRight className="h-5 w-5 rotate-180" /> : <ArrowLeft className="h-5 w-5" />}
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-7xl space-y-6 px-4 py-6">
        <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-amber-300/10 text-amber-300">
                <NotebookPen className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-500">{t("panelNutritionTemplates.stats.total")}</div>
                <div className="mt-1 text-xl font-black text-white">{format.number(templateStats.total)}</div>
              </div>
            </div>
          </div>
          <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-emerald-400/10 text-emerald-300">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-500">{t("panelNutritionTemplates.stats.active")}</div>
                <div className="mt-1 text-xl font-black text-white">{format.number(templateStats.active)}</div>
              </div>
            </div>
          </div>
          <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-cyan-400/10 text-cyan-300">
                <SquareDashedBottom className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-500">{t("panelNutritionTemplates.stats.withMeals")}</div>
                <div className="mt-1 text-xl font-black text-white">{format.number(templateStats.withMeals)}</div>
              </div>
            </div>
          </div>
          <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-violet-400/10 text-violet-300">
                <Settings2 className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-500">{t("panelNutritionTemplates.stats.withSupplements")}</div>
                <div className="mt-1 text-xl font-black text-white">{format.number(templateStats.withSupplements)}</div>
              </div>
            </div>
          </div>
        </section>

        <div className="flex items-center justify-end">
          <div className="flex flex-wrap justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setLocation("/panel/nutrition/audio-guidance")}
              className="h-12 rounded-2xl border-white/10 bg-white/5 px-5 font-black text-white hover:bg-white/10"
            >
              <Volume2 className="me-2 h-4 w-4" />
              {t("panelNutritionTemplates.audioFiles")}
            </Button>
            <Button
              type="button"
              onClick={() => setLocation("/panel/nutrition/templates/create")}
              className="h-12 rounded-2xl bg-[linear-gradient(135deg,#f59e0b,#fbbf24)] px-5 font-black text-slate-950 hover:opacity-95"
            >
              <Plus className="me-2 h-4 w-4" />
              {t("panelNutritionTemplates.addNew")}
            </Button>
          </div>
        </div>

        <Card className="border-white/10 bg-[linear-gradient(180deg,rgba(18,26,40,0.92),rgba(11,16,27,0.94))]">
          <CardHeader>
            <CardTitle className="text-white">{t("panelNutritionTemplates.registeredTitle")}</CardTitle>
            <CardDescription className="text-slate-400">{t("panelNutritionTemplates.registeredDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex h-52 items-center justify-center text-slate-400">
                <Loader2 className="me-2 h-5 w-5 animate-spin" />
                {t("common.loading")}
              </div>
            ) : !payload || payload.items.length === 0 ? (
              <div className="flex h-52 flex-col items-center justify-center rounded-[2rem] border border-dashed border-white/10 bg-white/[0.02] text-center">
                <FileText className="mb-3 h-10 w-10 text-amber-300/80" />
                <div className="font-bold text-white">{t("panelNutritionTemplates.empty")}</div>
              </div>
            ) : (
              renderTemplateTree(payload.items)
            )}
          </CardContent>
        </Card>
      </main>

    </div>
  );
}
