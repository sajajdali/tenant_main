import { useMemo, useState } from "react";
import { ArrowLeft, Flag, LineChart, Target } from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { MembershipStepProgress } from "@/nutrition/components/membership-step-progress";
import { NutritionTopbar } from "@/nutrition/components/nutrition-topbar";
import { PROFILE_HOME_REVIEW_HREF, isReturningToProfileHomeReview, resolveProfileHomeReviewAwareHref } from "@/nutrition/lib/membership-edit-navigation";
import { saveMembershipProfileEdit } from "@/nutrition/lib/membership-edit-persistence";
import { MEMBERSHIP_STEPS, MEMBERSHIP_TOTAL_STEPS } from "@/nutrition/lib/membership-progress";
import { getNutritionFormState, updateNutritionFormState } from "@/nutrition/lib/nutrition-form-state";
import { cn } from "@/lib/utils";
import { useFormat, useLocale, useT } from "@/i18n/locale";

const WEEKLY_RATE_OPTIONS = [
  { value: 0.5, titleKey: "nutritionMembershipNext.rate.slow" },
  { value: 1, titleKey: "nutritionMembershipNext.rate.balanced" },
  { value: 1.5, titleKey: "nutritionMembershipNext.rate.fast" },
] as const;

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const PROFILE_SETUP_STEP = MEMBERSHIP_STEPS.result;
const PROFILE_SETUP_TOTAL_STEPS = MEMBERSHIP_TOTAL_STEPS;

function buildMilestones(
  currentWeight: number,
  targetWeight: number,
  totalWeeks: number,
  weeklyRate: number,
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string,
  labels: { week: string; month: string },
) {
  const direction = targetWeight >= currentWeight ? 1 : -1;
  const steps = totalWeeks <= 1 ? [0, 1] : totalWeeks === 2 ? [0, 0.5, 1] : [0, 1 / 3, 2 / 3, 1];
  const today = new Date();

  return steps.map((progress, index) => {
    const elapsedWeeks = totalWeeks === 0 ? 0 : progress * totalWeeks;
    const rawWeight = currentWeight + (direction * elapsedWeeks * weeklyRate);
    const boundedWeight = direction === -1
      ? Math.max(targetWeight, rawWeight)
      : Math.min(targetWeight, rawWeight);
    const pointDate = new Date(today.getTime() + Math.round(elapsedWeeks * 7) * MS_PER_DAY);

    return {
      id: `${index}-${progress}`,
      progress,
      weight: Number(boundedWeight.toFixed(2)),
      date: pointDate,
      weekLabel: totalWeeks <= 2
        ? `${labels.week} ${formatNumber(Math.round(elapsedWeeks))}`
        : `${labels.month} ${formatNumber(Math.max(1, Math.round((elapsedWeeks / 4) * 10) / 10), { maximumFractionDigits: 1 })}`,
    };
  });
}

export default function NutritionMembershipNextPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const t = useT();
  const format = useFormat();
  const { dir, isRtl } = useLocale();
  const searchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const formState = getNutritionFormState();
  const [weeklyRate, setWeeklyRate] = useState<number>(formState.weeklyWeightChangeKg ?? 1);
  const shouldPersistEdit = isReturningToProfileHomeReview(searchParams);
  const backHref = resolveProfileHomeReviewAwareHref("/nutrition/membership/target-weight", searchParams);
  const nextHref = resolveProfileHomeReviewAwareHref("/nutrition/membership/medical-conditions", searchParams);

  const currentWeight = Number(formState.weightKg ?? 0);
  const targetWeight = Number(formState.targetWeightKg ?? formState.idealWeightKg ?? currentWeight);
  const totalDifference = Math.max(0, Math.abs(currentWeight - targetWeight));
  const isGainGoal = targetWeight > currentWeight;
  const rateTitle = isGainGoal ? t("nutritionMembershipNext.gainTitle") : t("nutritionMembershipNext.loseTitle");
  const rateDescription = isGainGoal
    ? t("nutritionMembershipNext.gainDescription")
    : t("nutritionMembershipNext.loseDescription");

  const stats = useMemo(() => {
    const totalWeeks = totalDifference === 0 ? 0 : Math.ceil(totalDifference / weeklyRate);
    const dietPlansCount = totalWeeks === 0 ? 0 : Math.max(1, Math.ceil(totalWeeks / 4));
    const reachDate = new Date(Date.now() + totalWeeks * 7 * MS_PER_DAY);
    const milestones = buildMilestones(
      currentWeight,
      targetWeight,
      totalWeeks,
      weeklyRate,
      format.number,
      { week: t("nutritionMembershipNext.week"), month: t("nutritionMembershipNext.month") },
    );

    return {
      totalWeeks,
      dietPlansCount,
      reachDate,
      milestones,
    };
  }, [currentWeight, format.number, targetWeight, t, totalDifference, weeklyRate]);

  const chartPoints = useMemo(() => {
    const width = 320;
    const height = 180;
    const paddingX = 26;
    const paddingY = 24;
    const minWeight = Math.min(...stats.milestones.map((item) => item.weight));
    const maxWeight = Math.max(...stats.milestones.map((item) => item.weight));
    const range = Math.max(maxWeight - minWeight, 1);

    return stats.milestones.map((item, index) => {
      const x = paddingX + ((width - paddingX * 2) * (stats.milestones.length === 1 ? 0 : index / (stats.milestones.length - 1)));
      const y = paddingY + ((height - paddingY * 2) * (1 - ((item.weight - minWeight) / range)));

      return {
        ...item,
        x,
        y,
      };
    });
  }, [stats.milestones]);

  const polyline = chartPoints.map((point) => `${point.x},${point.y}`).join(" ");
  const targetReachedText = stats.totalWeeks === 0
    ? t("nutritionMembershipNext.alreadyAtTarget")
    : t("nutritionMembershipNext.reachEstimate", { weeks: format.number(stats.totalWeeks) });

  const handleContinue = async () => {
    updateNutritionFormState({ weeklyWeightChangeKg: weeklyRate });
    if (shouldPersistEdit) {
      const result = await saveMembershipProfileEdit({ step: "weekly-rate", weeklyWeightChangeKg: weeklyRate });
      if (!result.success) {
        toast({ variant: "destructive", title: t("nutritionMembershipShared.toast.saveFailed"), description: result.message });
        return;
      }

      setLocation(PROFILE_HOME_REVIEW_HREF);
      return;
    }

    if (formState.targetWeightKg) {
      await api.nutrition.updateTargetWeight(String(formState.targetWeightKg), weeklyRate);
    }
    setLocation(nextHref);
  };

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-[#0a1224] text-white" dir={dir}>
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.14),transparent_26%),linear-gradient(180deg,rgba(7,12,26,0.18),rgba(7,12,26,0.82)_42%,rgba(7,12,26,0.98)_100%)]" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[390px] flex-col px-5 pb-10 pt-8">
        <NutritionTopbar backHref={backHref} title={t("nutritionMembershipShared.topbarTitle")} description={t("nutritionMembershipNext.topbarDescription")} variant="hero" />

        <MembershipStepProgress step={PROFILE_SETUP_STEP} totalSteps={PROFILE_SETUP_TOTAL_STEPS} className="mt-8 space-y-3" itemClassName="h-1.5" />

        <main className="flex flex-1 flex-col pt-8">
          <div className="mx-auto flex h-[64px] w-[64px] items-center justify-center rounded-[23px] border border-amber-300/22 bg-amber-400/12 text-amber-300 shadow-[0_24px_55px_-38px_rgba(251,191,36,0.9)]">
            <LineChart className="h-8 w-8" />
          </div>

          <div className="mt-7 space-y-3 text-center">
            <h1 className="whitespace-nowrap text-[20px] font-black leading-[1.45] text-white max-[400px]:text-[17px]">{rateTitle}</h1>
            <p className="mx-auto max-w-[330px] text-[12px] font-semibold leading-7 text-slate-400">{rateDescription}</p>
          </div>

          <div className="mt-7 grid grid-cols-3 gap-2.5">
            {WEEKLY_RATE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setWeeklyRate(option.value);
                  updateNutritionFormState({ weeklyWeightChangeKg: option.value });
                }}
                className={cn(
                  "min-h-[102px] rounded-[18px] border px-2 py-4 text-center transition-all duration-200",
                  weeklyRate === option.value
                    ? "border-amber-300/85 bg-amber-400/10 text-amber-300 shadow-[0_22px_55px_-34px_rgba(251,191,36,0.9)]"
                    : "border-white/10 bg-white/[0.025] text-slate-200 hover:border-white/20 hover:bg-white/5",
                )}
              >
                <div className={cn("text-[30px] font-black leading-none", weeklyRate === option.value ? "text-white" : "text-white")}>
                  {format.number(option.value, { maximumFractionDigits: 1 })}
                </div>
                <div className="mt-2 text-[11px] font-black text-slate-400">{t("nutritionMembershipNext.kgPerWeek")}</div>
                <div className={cn("mt-2 text-[13px] font-black leading-6", weeklyRate === option.value ? "text-amber-300" : "text-white")}>
                  {t(option.titleKey)}
                </div>
              </button>
            ))}
          </div>

          <Button
            type="button"
            onClick={handleContinue}
            className="mt-5 h-[56px] rounded-[18px] bg-[linear-gradient(135deg,#f8c45a,#f59e0b)] text-[15px] font-black text-slate-950 shadow-[0_22px_55px_-34px_rgba(251,191,36,0.95)] hover:opacity-95"
          >
            {shouldPersistEdit ? t("nutritionMembershipShared.saveChanges") : t("nutritionMembershipShared.continueSteps")}
            <ArrowLeft className={`h-[18px] w-[18px] ${isRtl ? "ms-2" : "me-2 rotate-180"}`} />
          </Button>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="min-h-[96px] rounded-[18px] border border-white/10 bg-white/[0.025] p-4">
              <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400">
                <Target className="h-4 w-4 text-amber-300" />
                {t("nutritionMembershipNext.reachTime")}
              </div>
              <div className="mt-3 text-[22px] font-black text-white">
                {stats.totalWeeks === 0 ? t("nutritionMembershipNext.now") : t("nutritionMembershipNext.weeksValue", { weeks: format.number(stats.totalWeeks) })}
              </div>
            </div>

            <div className="min-h-[96px] rounded-[18px] border border-white/10 bg-white/[0.025] p-4">
              <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400">
                <Flag className="h-4 w-4 text-slate-400" />
                {t("nutritionMembershipNext.requiredDiets")}
              </div>
              <div className="mt-3 text-[22px] font-black text-white">{t("nutritionMembershipNext.dietsValue", { count: format.number(stats.dietPlansCount) })}</div>
              <div className="mt-1 text-[10px] leading-5 text-slate-500">{t("nutritionMembershipNext.dietPlanHint")}</div>
            </div>
          </div>

          <div className="mt-6 rounded-[22px] border border-white/10 bg-white/[0.025] p-4">
            <div>
              <div className="text-[14px] font-black text-amber-300">{t("nutritionMembershipNext.progressChart")}</div>
              <div className="mt-2 text-[12px] font-semibold leading-6 text-slate-400">{targetReachedText}</div>
            </div>

            <svg viewBox="0 0 320 180" className="mt-5 h-[210px] w-full">
              <defs>
                <linearGradient id="nutrition-progress-line" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="52%" stopColor="#a3e635" />
                  <stop offset="100%" stopColor="#f59e0b" />
                </linearGradient>
              </defs>

              {[40, 90, 140].map((y) => (
                <line key={y} x1="16" x2="304" y1={y} y2={y} stroke="rgba(255,255,255,0.08)" strokeDasharray="4 6" />
              ))}

              {chartPoints.length > 1 && (
                <polyline
                  fill="none"
                  stroke="url(#nutrition-progress-line)"
                  strokeWidth="4"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  points={polyline}
                />
              )}

              {chartPoints.map((point, index) => (
                <g key={point.id}>
                  <circle cx={point.x} cy={point.y} r="7" fill="#0f172a" stroke={index === 0 ? "#34d399" : index === chartPoints.length - 1 ? "#f59e0b" : "#fbbf24"} strokeWidth="4" />
                  <text x={point.x} y={point.y - 16} textAnchor="middle" fill="#f8fafc" fontSize="12" fontWeight="700">
                    {format.number(point.weight, { maximumFractionDigits: 2 })}
                  </text>
                </g>
              ))}
            </svg>
          </div>

          <div className="mt-5 grid gap-3">
            {stats.milestones.map((item, index) => (
              <div
                key={item.id}
                className={cn(
                  "flex items-center justify-between rounded-[18px] border px-4 py-3",
                  index === stats.milestones.length - 1
                    ? "border-emerald-400/35 bg-emerald-400/8"
                    : "border-white/10 bg-white/[0.025]",
                )}
              >
                <div>
                  <div className={cn("text-[13px] font-black", index === stats.milestones.length - 1 ? "text-emerald-300" : "text-white")}>
                    {index === stats.milestones.length - 1 ? t("nutritionMembershipNext.targetMilestone") : t("nutritionMembershipNext.milestone", { index: format.number(index + 1) })}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500">{format.date(item.date, { year: "numeric", month: "long", day: "numeric" })}</div>
                </div>
                <div className="text-end">
                  <div className={cn("text-[17px] font-black", index === stats.milestones.length - 1 ? "text-emerald-300" : "text-amber-300")}>{t("nutritionMembershipNext.weightValue", { value: format.number(item.weight, { maximumFractionDigits: 2 }) })}</div>
                  <div className="mt-1 text-[11px] text-slate-500">{item.weekLabel}</div>
                </div>
              </div>
            ))}
          </div>

          <Button
            type="button"
            onClick={handleContinue}
            className="mt-6 h-[56px] rounded-[18px] bg-[linear-gradient(135deg,#f8c45a,#f59e0b)] text-[15px] font-black text-slate-950 shadow-[0_22px_55px_-34px_rgba(251,191,36,0.95)] hover:opacity-95"
          >
            {shouldPersistEdit ? t("nutritionMembershipShared.saveChanges") : t("nutritionMembershipShared.continueSteps")}
            <ArrowLeft className={`h-[18px] w-[18px] ${isRtl ? "ms-2" : "me-2 rotate-180"}`} />
          </Button>
        </main>
      </div>
    </div>
  );
}
