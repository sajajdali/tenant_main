import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronLeft, ClipboardList, Loader2, Sparkles } from "lucide-react";
import { useLocation, useRoute } from "wouter";
import { NutritionTopbar } from "@/nutrition/components/nutrition-topbar";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import type { NutritionDietTemplateItem } from "@/lib/types";
import { useFormat, useLocale, useT } from "@/i18n/locale";
import type { MessageKey } from "@/i18n/messages";
import {
  getPanelNutritionPrescribeState,
  updatePanelNutritionPrescribeState,
} from "@/nutrition/lib/panel-nutrition-prescribe-state";

const MODE_LABEL_KEYS: Record<string, MessageKey> = {
  daily_prescription: "panelNutritionPrescribeTemplates.mode.dailyPrescription",
  user_choice: "panelNutritionPrescribeTemplates.mode.userChoice",
  fixed_text: "panelNutritionPrescribeTemplates.mode.fixedText",
};

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

function filterTemplatesByGoal(items: NutritionDietTemplateItem[], goal?: string): NutritionDietTemplateItem[] {
  return items
    .map((item) => {
      const children = filterTemplatesByGoal(item.children ?? [], goal);
      const matchesGoal = !goal || !item.applicableGoals?.length || item.applicableGoals.includes(goal);

      if (!matchesGoal && children.length === 0) {
        return null;
      }

      return {
        ...item,
        children,
      };
    })
    .filter(Boolean) as NutritionDietTemplateItem[];
}

export default function PanelNutritionPrescribeTemplatesPage() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/panel/nutrition/prescribe/templates/:templateId");
  const { toast } = useToast();
  const t = useT();
  const format = useFormat();
  const { dir, isRtl } = useLocale();
  const state = useMemo(() => getPanelNutritionPrescribeState(), []);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<NutritionDietTemplateItem[]>([]);

  useEffect(() => {
    if (!state.selectedNutritionPackageId) {
      setLocation("/panel/nutrition/prescribe/packages");
      return;
    }

    api.nutritionTemplates.list().then((result) => {
      if (result.success) {
        setItems(filterTemplatesByGoal(result.data.items ?? [], state.dietGoal));
      } else {
        toast({ variant: "destructive", title: t("panelNutritionPrescribeTemplates.toast.templatesLoadFailed"), description: result.message });
      }

      setLoading(false);
    });
  }, [setLocation, state.dietGoal, state.selectedNutritionPackageId, t, toast]);

  const activePath = useMemo(() => {
    if (!match || !params?.templateId) {
      return null;
    }

    return findTemplatePath(items, params.templateId) ?? null;
  }, [items, match, params?.templateId]);

  const currentNode = activePath ? activePath[activePath.length - 1] : null;
  const visibleItems = currentNode ? currentNode.children ?? [] : items;
  const parentNode = activePath && activePath.length > 1 ? activePath[activePath.length - 2] : null;
  const backHref = currentNode
    ? parentNode
      ? `/panel/nutrition/prescribe/templates/${parentNode.id}`
      : "/panel/nutrition/prescribe/templates"
    : "/panel/nutrition/prescribe/mode";

  if (loading) {
    return (
      <div className="relative isolate min-h-screen bg-[#06131d] text-white" dir={dir}>
        <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.16),transparent_28%),linear-gradient(180deg,rgba(7,12,26,0.18),rgba(7,12,26,0.82)_42%,rgba(7,12,26,0.98)_100%)]" />
        <div className="relative z-10 flex min-h-screen items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-amber-300" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative isolate min-h-screen bg-[#06131d] px-4 py-8 text-white" dir={dir}>
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.14),transparent_26%),linear-gradient(180deg,rgba(7,12,26,0.18),rgba(7,12,26,0.82)_42%,rgba(7,12,26,0.98)_100%)]" />

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center space-y-5">
        <NutritionTopbar backHref={backHref} title={t("panelNutritionPrescribeTemplates.topbarTitle")} description={t("panelNutritionPrescribeTemplates.topbarDescription")} />

        <div className="rounded-[32px] border border-white/10 bg-[#1e2335]/88 p-5 shadow-[0_30px_80px_-45px_rgba(0,0,0,0.85)] backdrop-blur-xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[24px] bg-amber-400/12 text-amber-300">
            <ClipboardList className="h-8 w-8" />
          </div>

          <div className="mt-5 space-y-2 text-center">
            <div className="text-sm font-bold text-amber-300">{t("panelNutritionPrescribeTemplates.stepLabel")}</div>
            <h1 className="text-3xl font-black leading-tight">
              {currentNode ? t("panelNutritionPrescribeTemplates.childrenTitle", { name: currentNode.name }) : t("panelNutritionPrescribeTemplates.title")}
            </h1>
            <p className="text-sm leading-7 text-slate-300">
              {t("panelNutritionPrescribeTemplates.description")}
            </p>
          </div>

          {activePath && activePath.length > 0 ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {activePath.map((item) => (
                <Badge key={item.id} variant="outline" className="border-white/15 bg-white/5 text-slate-200">
                  {item.name}
                </Badge>
              ))}
            </div>
          ) : null}

          <div className="mt-5 space-y-3">
            {visibleItems.length === 0 ? (
              <div className="rounded-[28px] border border-dashed border-white/10 bg-slate-950/18 px-4 py-8 text-center text-slate-300">
                {t("panelNutritionPrescribeTemplates.empty")}
              </div>
            ) : (
              visibleItems.map((item) => {
                const hasChildren = (item.children ?? []).length > 0;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (hasChildren) {
                        setLocation(`/panel/nutrition/prescribe/templates/${item.id}`);
                        return;
                      }

                      updatePanelNutritionPrescribeState({
                        selectedDietTemplateId: item.id,
                        selectedDietTemplateName: item.name,
                      });
                      setLocation("/panel/nutrition/prescribe/generate");
                    }}
                    className="w-full rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(15,23,42,0.24))] p-4 text-start transition hover:-translate-y-1 hover:border-amber-300/30 hover:bg-white/[0.06]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="text-xl font-black">{item.name}</div>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline" className="border-white/15 bg-white/5 text-slate-200">
                            {t(MODE_LABEL_KEYS[item.prescriptionMode ?? ""] ?? "panelNutritionPrescribeTemplates.mode.default")}
                          </Badge>
                          <Badge variant="outline" className="border-white/15 bg-white/5 text-slate-200">
                            {t("panelNutritionPrescribeTemplates.daysDuration", { count: format.number(item.durationDays) })}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={item.isActive ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200" : "border-amber-300/20 bg-amber-300/10 text-amber-100"}
                          >
                            {item.isActive ? t("panelNutritionPrescribeTemplates.status.active") : t("panelNutritionPrescribeTemplates.status.inactiveExpertOnly")}
                          </Badge>
                        </div>
                        <div className="text-sm leading-7 text-slate-300">{item.description || t("panelNutritionPrescribeTemplates.fallbackDescription")}</div>
                      </div>
                      <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-amber-400/12 text-amber-300">
                        {hasChildren ? <ChevronLeft className={`h-6 w-6 ${isRtl ? "" : "rotate-180"}`} /> : <ArrowLeft className={`h-6 w-6 ${isRtl ? "" : "rotate-180"}`} />}
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between rounded-[20px] border border-white/10 bg-black/10 px-4 py-3 text-sm">
                      <div className="text-slate-400">
                        {hasChildren
                          ? t("panelNutritionPrescribeTemplates.openChildren")
                          : item.isActive
                            ? t("panelNutritionPrescribeTemplates.selectTemplate")
                            : t("panelNutritionPrescribeTemplates.hiddenForCustomers")}
                      </div>
                      <div className="flex items-center gap-2 font-black text-amber-300">
                        <Sparkles className="h-4 w-4" />
                        {item.suggestDailyReplacements
                          ? t("panelNutritionPrescribeTemplates.replacement.daily", { count: format.number(1) })
                          : item.allowFoodReplacement
                            ? t("panelNutritionPrescribeTemplates.replacement.allowed")
                            : t("panelNutritionPrescribeTemplates.replacement.none")}
                      </div>
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
