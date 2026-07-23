import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowDown, ArrowLeft, ArrowUp, Check, Equal, Target } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { MembershipStepProgress } from "@/nutrition/components/membership-step-progress";
import { NutritionTopbar } from "@/nutrition/components/nutrition-topbar";
import { PROFILE_HOME_REVIEW_HREF, appendProfileHomeReviewReturn, isReturningToProfileHomeReview, resolveProfileHomeReviewAwareHref } from "@/nutrition/lib/membership-edit-navigation";
import { saveMembershipProfileEdit } from "@/nutrition/lib/membership-edit-persistence";
import { MEMBERSHIP_STEPS, MEMBERSHIP_TOTAL_STEPS } from "@/nutrition/lib/membership-progress";
import { getNutritionFormState, NutritionDietGoal, updateNutritionFormState } from "@/nutrition/lib/nutrition-form-state";
import { cn } from "@/lib/utils";
import { useLocale, useT } from "@/i18n/locale";
import type { MessageKey } from "@/i18n/messages";

const GOAL_OPTIONS: Array<{
  value: NutritionDietGoal;
  labelKey: MessageKey;
  descriptionKey: MessageKey;
  icon: LucideIcon;
}> = [
  {
    value: "lose-weight",
    labelKey: "nutritionMembershipGoal.option.loseWeight",
    descriptionKey: "nutritionMembershipGoal.option.loseWeightDescription",
    icon: ArrowDown,
  },
  {
    value: "gain-weight",
    labelKey: "nutritionMembershipGoal.option.gainWeight",
    descriptionKey: "nutritionMembershipGoal.option.gainWeightDescription",
    icon: ArrowUp,
  },
  {
    value: "maintain-weight",
    labelKey: "nutritionMembershipGoal.option.maintainWeight",
    descriptionKey: "nutritionMembershipGoal.option.maintainWeightDescription",
    icon: Equal,
  },
];

const PROFILE_SETUP_STEP = MEMBERSHIP_STEPS.goal;
const PROFILE_SETUP_TOTAL_STEPS = MEMBERSHIP_TOTAL_STEPS;

export default function NutritionMembershipGoalPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, isLoading } = useAuth();
  const { dir, isRtl } = useLocale();
  const t = useT();
  const initialState = useMemo(() => getNutritionFormState(), []);
  const searchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const [selectedGoal, setSelectedGoal] = useState<NutritionDietGoal | null>(initialState.dietGoal ?? null);
  const shouldPersistEdit = isReturningToProfileHomeReview(searchParams);
  const backHref = resolveProfileHomeReviewAwareHref("/nutrition", searchParams);
  const nextHref = appendProfileHomeReviewReturn("/nutrition/membership/gender", backHref !== "/nutrition");

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/nutrition");
    }
  }, [isLoading, setLocation, user]);

  const persistGoal = (goal: NutritionDietGoal) => {
    updateNutritionFormState({ dietGoal: goal });
  };

  const handleSelect = (goal: NutritionDietGoal) => {
    setSelectedGoal(goal);
    persistGoal(goal);
    if (!shouldPersistEdit) {
      setLocation(nextHref);
    }
  };

  const handleContinue = async () => {
    if (!selectedGoal) {
      return;
    }

    persistGoal(selectedGoal);
    if (shouldPersistEdit) {
      const result = await saveMembershipProfileEdit({ step: "goal", dietGoal: selectedGoal });
      if (!result.success) {
        toast({ variant: "destructive", title: t("nutritionMembershipShared.toast.saveFailed"), description: result.message });
        return;
      }

      setLocation(PROFILE_HOME_REVIEW_HREF);
      return;
    }

    setLocation(nextHref);
  };

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-[#0a1224] text-white" dir={dir}>
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.16),transparent_28%),linear-gradient(180deg,rgba(7,12,26,0.18),rgba(7,12,26,0.82)_42%,rgba(7,12,26,0.98)_100%)]" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[390px] flex-col px-5 pb-10 pt-8">
        <NutritionTopbar backHref={backHref} title={t("nutritionMembershipShared.topbarTitle")} description={t("nutritionMembershipGoal.topbarDescription")} variant="hero" />

        <MembershipStepProgress step={PROFILE_SETUP_STEP} totalSteps={PROFILE_SETUP_TOTAL_STEPS} className="mt-8 space-y-3" itemClassName="h-1.5" />

        <main className="flex flex-1 flex-col pt-10">
          <div className="mx-auto flex h-[68px] w-[68px] items-center justify-center rounded-[24px] border border-amber-300/22 bg-amber-400/12 text-amber-300 shadow-[0_24px_55px_-38px_rgba(251,191,36,0.9)]">
            <Target className="h-9 w-9" />
          </div>

          <div className="mt-8 space-y-3 text-center">
            <h1 className="text-[26px] font-black leading-[1.45] text-white">{t("nutritionMembershipGoal.title")}</h1>
          </div>

          <div className="mt-8 space-y-3">
            {GOAL_OPTIONS.map((option) => {
              const Icon = option.icon;
              const active = selectedGoal === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={cn(
                    "flex min-h-[78px] w-full items-center gap-3 rounded-[22px] border px-3.5 py-3 text-start transition-all duration-200",
                    active
                      ? "border-amber-300/55 bg-amber-400/10 shadow-[0_18px_48px_-34px_rgba(251,191,36,0.7)]"
                      : "border-white/10 bg-white/[0.025]",
                  )}
                >
                  <span className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border",
                    active ? "border-amber-300 bg-amber-400 text-slate-950" : "border-white/18 text-transparent",
                  )}>
                    <Check className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="text-[17px] font-black leading-7 text-white">{t(option.labelKey)}</div>
                    <div className="text-[12px] font-semibold leading-6 text-slate-400">{t(option.descriptionKey)}</div>
                  </div>
                  <div className="flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-[18px] bg-amber-400/12 text-amber-300">
                    <Icon className="h-6 w-6" />
                  </div>
                </button>
              );
            })}
          </div>

          <Button
            type="button"
            onClick={() => void handleContinue()}
            disabled={!selectedGoal}
            className="mt-8 h-[56px] w-full shrink-0 rounded-[18px] bg-[linear-gradient(135deg,#f8c45a,#f59e0b)] text-[16px] font-black text-slate-950 shadow-[0_22px_55px_-34px_rgba(251,191,36,0.95)] hover:opacity-95 disabled:opacity-55"
          >
            {shouldPersistEdit ? t("nutritionMembershipShared.saveChanges") : t("nutritionMembershipGender.continue")}
            <ArrowLeft className={`me-2 h-5 w-5 ${isRtl ? "" : "rotate-180"}`} />
          </Button>
        </main>
      </div>
    </div>
  );
}
