import { useMemo, useState } from "react";
import { ArrowLeft, Brain, CheckCircle2 } from "lucide-react";
import { useLocation, useRoute } from "wouter";
import { NutritionTopbar } from "@/nutrition/components/nutrition-topbar";
import { cn } from "@/lib/utils";
import { useFormat, useLocale, useT } from "@/i18n/locale";
import {
  getPanelNutritionPrescribeState,
  PANEL_PRESCRIBE_QUESTION_STEPS,
  updatePanelNutritionPrescribeState,
} from "@/nutrition/lib/panel-nutrition-prescribe-state";

export default function PanelNutritionPrescribeMindsetPage() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/panel/nutrition/prescribe/mindset/:step");
  const t = useT();
  const format = useFormat();
  const { dir, isRtl } = useLocale();
  const search = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const isEditMode = search.get("edit") === "1";
  const state = useMemo(() => getPanelNutritionPrescribeState(), []);
  const currentStep = Math.max(1, Math.min(PANEL_PRESCRIBE_QUESTION_STEPS.length, Number(params?.step || "1")));
  const question = PANEL_PRESCRIBE_QUESTION_STEPS[currentStep - 1];
  const [answers, setAnswers] = useState<Record<string, string>>(state.mindsetAnswers ?? {});

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-[#06131d] px-4 py-8 pb-24 text-white" dir={dir}>
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.16),transparent_22%),linear-gradient(180deg,rgba(6,19,29,0.97),rgba(4,10,17,1))]" />
      <div className="relative z-10 mx-auto max-w-md space-y-5">
        <NutritionTopbar
          backHref={isEditMode ? "/panel/nutrition/prescribe/review" : currentStep === 1 ? "/panel/nutrition/prescribe/disliked-foods" : `/panel/nutrition/prescribe/mindset/${currentStep - 1}`}
          title={t("panelNutritionPrescribeMindset.topbarTitle")}
          description={t("panelNutritionPrescribeMindset.topbarDescription")}
        />

        <section className="rounded-[32px] border border-white/10 bg-[linear-gradient(160deg,rgba(18,34,49,0.95),rgba(11,22,35,0.9))] p-5">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[24px] bg-amber-400/12 text-amber-300">
            {currentStep === PANEL_PRESCRIBE_QUESTION_STEPS.length ? <CheckCircle2 className="h-8 w-8" /> : <Brain className="h-8 w-8" />}
          </div>
          <div className="mt-5 space-y-2 text-center">
            <div className="text-sm font-bold text-amber-300">
              {t("panelNutritionPrescribeMindset.stepCounter", { current: format.number(currentStep), total: format.number(PANEL_PRESCRIBE_QUESTION_STEPS.length) })}
            </div>
            <h1 className="text-3xl font-black leading-tight">{t(question.titleKey)}</h1>
            <p className="text-sm leading-7 text-slate-300">{t(question.descriptionKey)}</p>
          </div>

          <div className="mt-5 flex gap-2">
            {PANEL_PRESCRIBE_QUESTION_STEPS.map((item, index) => (
              <div key={item.key} className={cn("h-2 flex-1 rounded-full", index < currentStep ? "bg-amber-300" : "bg-white/10")} />
            ))}
          </div>

          <div className="mt-6 grid gap-3">
            {question.optionKeys.map((optionKey) => {
              const option = t(optionKey);
              return (
              <button
                key={optionKey}
                type="button"
                onClick={() => {
                  const nextAnswers = { ...answers, [question.key]: option };
                  setAnswers(nextAnswers);
                  updatePanelNutritionPrescribeState({ mindsetAnswers: nextAnswers });
                  if (isEditMode) {
                    setLocation("/panel/nutrition/prescribe/review");
                  } else if (currentStep < PANEL_PRESCRIBE_QUESTION_STEPS.length) {
                    setLocation(`/panel/nutrition/prescribe/mindset/${currentStep + 1}`);
                  } else {
                    setLocation("/panel/nutrition/prescribe/review");
                  }
                }}
                className={cn(
                  "rounded-[24px] border border-white/10 bg-white/[0.04] px-4 py-4 text-start text-sm font-bold leading-7 text-white transition hover:border-amber-300/30 hover:bg-amber-400/10",
                  answers[question.key] === option && "border-amber-300/40 bg-amber-400/12 text-amber-300",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <span>{option}</span>
                  <ArrowLeft className={cn("h-4 w-4", !isRtl && "rotate-180")} />
                </div>
              </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
