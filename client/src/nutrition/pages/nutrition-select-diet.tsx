import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, FileText, ListChecks, Loader2, Sparkles } from "lucide-react";
import { useLocation, useRoute } from "wouter";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { NutritionDietTemplateItem } from "@/lib/types";
import { NutritionTopbar } from "@/nutrition/components/nutrition-topbar";
import { getNutritionFormState, updateNutritionFormState } from "@/nutrition/lib/nutrition-form-state";
import { parseNutritionTemplateConditions } from "@/nutrition/lib/template-editor-meta";
import { cn } from "@/lib/utils";
import { useLocale, useT } from "@/i18n/locale";

function findTemplatePath(items: NutritionDietTemplateItem[], templateId: string): NutritionDietTemplateItem[] | null {
  for (const item of items) {
    if (item.id === templateId) {
      return [item];
    }

    const childPath = findTemplatePath(item.children ?? [], templateId);
    if (childPath) {
      return [item, ...childPath];
    }
  }

  return null;
}

export default function NutritionSelectDietPage() {
  const t = useT();
  const { dir, isRtl } = useLocale();
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/nutrition/select-diet/:templateId");
  const { user, isLoading } = useAuth();
  const formState = useMemo(() => getNutritionFormState(), []);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<NutritionDietTemplateItem[]>([]);
  const [failedImageIds, setFailedImageIds] = useState<string[]>([]);

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/nutrition");
      return;
    }

    api.nutrition.getProfile().then(async (profileResult) => {
      const profile = profileResult.success ? profileResult.data.profile : null;
      if (!profile?.mindsetCompletedAt) {
        setLocation("/nutrition/membership/mindset/1");
        return;
      }

      const goal = profile.dietGoal ?? formState.dietGoal;
      const result = await api.nutritionTemplates.listPublic(goal || undefined);
      if (!result.success) {
        setItems([]);
        setLoading(false);
        return;
      }

      setItems(result.data.items);
      setLoading(false);
    });
  }, [formState.dietGoal, isLoading, setLocation, user]);

  const activePath = useMemo(() => {
    if (!match || !params?.templateId) {
      return null;
    }

    return findTemplatePath(items, params.templateId) ?? null;
  }, [items, match, params?.templateId]);

  const currentNode = activePath ? activePath[activePath.length - 1] : null;
  const visibleItems = currentNode ? currentNode.children ?? [] : items;
  const isDirectLeafRoute = Boolean(match && currentNode && visibleItems.length === 0);
  const parentNode = activePath && activePath.length > 1 ? activePath[activePath.length - 2] : null;
  const backHref = currentNode
    ? parentNode
      ? `/nutrition/select-diet/${parentNode.id}`
      : "/nutrition/select-diet"
    : "/nutrition/membership/package-result";

  useEffect(() => {
    if (!isDirectLeafRoute || !currentNode) {
      return;
    }

    updateNutritionFormState({
      selectedDietTemplateId: currentNode.id,
      selectedDietTemplateName: currentNode.name,
    });
    setLocation("/nutrition/diet-request/confirm");
  }, [currentNode, isDirectLeafRoute, setLocation]);

  const ActionIcon = isRtl ? ArrowLeft : ArrowRight;
  const DrilldownIcon = isRtl ? ChevronLeft : ChevronRight;

  const selectTemplateAndContinue = (item: NutritionDietTemplateItem) => {
    updateNutritionFormState({
      selectedDietTemplateId: item.id,
      selectedDietTemplateName: item.name,
    });
    setLocation("/nutrition/diet-request/confirm");
  };

  if (isLoading || loading) {
    return (
      <div className="relative isolate min-h-screen bg-[#0a1224] text-white" dir={dir}>
        <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.16),transparent_28%),linear-gradient(180deg,rgba(7,12,26,0.18),rgba(7,12,26,0.82)_42%,rgba(7,12,26,0.98)_100%)]" />
        <div className="relative z-10 flex min-h-screen items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-amber-300" />
        </div>
      </div>
    );
  }

  if (isDirectLeafRoute) {
    return (
      <div className="relative isolate min-h-screen bg-[#0a1224] text-white" dir={dir}>
        <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.16),transparent_28%),linear-gradient(180deg,rgba(7,12,26,0.18),rgba(7,12,26,0.82)_42%,rgba(7,12,26,0.98)_100%)]" />
        <div className="relative z-10 flex min-h-screen items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-amber-300" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-[#0a1224] text-white" dir={dir}>
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.14),transparent_26%),linear-gradient(180deg,rgba(7,12,26,0.18),rgba(7,12,26,0.82)_42%,rgba(7,12,26,0.98)_100%)]" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[390px] flex-col px-5 pb-8 pt-5">
        <NutritionTopbar backHref={backHref} title={t("nutritionSelectDiet.topbarTitle")} description={t("nutritionSelectDiet.topbarDescription")} variant="hero" compact />

        <section className="mt-6 text-start">
          <div className="flex items-center gap-3 text-[12px] font-black text-amber-300">
            <div className="flex h-[42px] w-[42px] items-center justify-center rounded-[14px] border border-amber-300/28 bg-amber-400/10 text-amber-300">
              <FileText className="h-5 w-5" />
            </div>
            {t("nutritionSelectDiet.stepLabel")}
          </div>
          <h1 className="mt-4 text-[22px] font-black leading-8 text-white">
            {currentNode ? t("nutritionSelectDiet.titleFromNode", { name: currentNode.name }) : t("nutritionSelectDiet.title")}
          </h1>
        </section>

        {activePath && activePath.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {activePath.map((item) => (
              <div key={item.id} className="rounded-[10px] border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-black text-slate-200">
                {item.name}
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-4 flex flex-1 flex-col">
          <div className="space-y-3.5">
            {visibleItems.length === 0 ? (
              <div className="rounded-[26px] border border-dashed border-white/10 bg-slate-950/18 px-4 py-8 text-center">
                <div className="text-[15px] font-black">{t("nutritionSelectDiet.emptyTitle")}</div>
                <div className="mt-2 text-[12px] leading-6 text-slate-400">{t("nutritionSelectDiet.emptyDescription")}</div>
              </div>
            ) : (
              visibleItems.map((item, index) => {
                const hasChildren = (item.children ?? []).length > 0;
                const cleanConditions = parseNutritionTemplateConditions(item.conditionsText).cleanText;
                const hasImage = Boolean(item.imageUrl?.trim()) && !failedImageIds.includes(item.id);
                const recommended = index === 1;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (hasChildren) {
                        setLocation(`/nutrition/select-diet/${item.id}`);
                        return;
                      }

                      selectTemplateAndContinue(item);
                    }}
                    className={cn(
                      "group relative w-full overflow-hidden text-start transition hover:-translate-y-0.5",
                      hasImage
                        ? "rounded-[22px] border p-4"
                        : "rounded-[22px] border px-4 py-4",
                      "border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(11,16,25,0.72))] shadow-[0_20px_48px_-38px_rgba(0,0,0,0.8)]",
                    )}
                  >
                    {hasImage ? (
                      <div className="relative mb-5 aspect-[4/3] overflow-hidden rounded-[17px] bg-slate-950/55">
                        <img
                          src={item.imageUrl ?? ""}
                          alt={item.name}
                          className="h-full w-full object-contain"
                          onError={() => setFailedImageIds((current) => (current.includes(item.id) ? current : [...current, item.id]))}
                        />
                        {recommended ? (
                          <div className="absolute end-4 top-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#101826]/85 px-3 py-1.5 text-[11px] font-black text-white backdrop-blur">
                            <Sparkles className="h-3 w-3 text-amber-300" />
                            {t("nutritionSelectDiet.systemRecommendation")}
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    <div className={cn("flex gap-3.5", hasImage ? "items-start" : "items-start")}>
                      <div className="min-w-0 flex-1">
                        <div className={cn("flex items-start gap-3", hasImage ? "justify-between" : "justify-start")}>
                          {!hasImage ? (
                            <div className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[16px] bg-amber-400/12 text-amber-300">
                              {hasChildren ? <DrilldownIcon className="h-5 w-5" /> : <ListChecks className="h-5 w-5" />}
                            </div>
                          ) : null}

                          <div className="min-w-0">
                            <div className="text-[19px] font-black leading-8 text-white">{item.name}</div>
                            {item.dietLevel?.trim() ? (
                              <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-amber-200/20 bg-amber-300/10 px-3.5 py-1.5 text-[11px] font-black text-amber-100 shadow-[0_12px_32px_-24px_rgba(251,191,36,0.85)]">
                                <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                                {item.dietLevel}
                              </div>
                            ) : null}
                          </div>
                        </div>

                        {item.description ? <div className="mt-4 text-[13px] font-extrabold leading-7 text-slate-300">{item.description}</div> : null}
                        {cleanConditions ? (
                          <div className="mt-3 text-[12px] font-bold leading-7 text-slate-400">
                            {cleanConditions}
                          </div>
                        ) : null}
                      </div>

                      <div className="flex w-8 shrink-0 justify-center pt-1">
                        <span className="h-[23px] w-[23px] rounded-full border-2 border-slate-600/80 bg-transparent" />
                      </div>
                    </div>

                    <div className="mt-4 h-px bg-white/8" />
                    <div className="mt-3 flex min-h-[46px] w-full items-center justify-center gap-3 rounded-[15px] border border-amber-200/30 bg-gradient-to-l from-amber-500 to-amber-300 px-4 py-3 text-[12px] font-black text-slate-950 shadow-[0_18px_45px_-32px_rgba(251,191,36,0.92)] transition group-hover:brightness-105">
                      <ActionIcon className="h-3.5 w-3.5" />
                      {t("nutritionSelectDiet.selectTemplate")}
                    </div>
                  </button>
                );
              })
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
