import { useEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Activity, ArrowLeft, Check, Dumbbell, PersonStanding, Zap } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { MembershipStepProgress } from "@/nutrition/components/membership-step-progress";
import { NutritionTopbar } from "@/nutrition/components/nutrition-topbar";
import { PROFILE_HOME_REVIEW_HREF, appendProfileHomeReviewReturn, isReturningToProfileHomeReview, resolveProfileHomeReviewAwareHref } from "@/nutrition/lib/membership-edit-navigation";
import { saveMembershipProfileEdit } from "@/nutrition/lib/membership-edit-persistence";
import { MEMBERSHIP_STEPS, MEMBERSHIP_TOTAL_STEPS } from "@/nutrition/lib/membership-progress";
import {
  getNutritionFormState,
  NutritionActivityLevel,
  NutritionAthleteMode,
  updateNutritionFormState,
} from "@/nutrition/lib/nutrition-form-state";
import { useLocale, useT } from "@/i18n/locale";
import type { MessageKey } from "@/i18n/messages";

const ATHLETE_OPTIONS: Array<{
  value: NutritionAthleteMode;
  labelKey: MessageKey;
  descriptionKey: MessageKey;
  icon: LucideIcon;
  iconWrap: string;
}> = [
  {
    value: "non-athlete",
    labelKey: "nutritionMembershipActivity.athlete.nonAthlete",
    descriptionKey: "nutritionMembershipActivity.athlete.nonAthleteDescription",
    icon: PersonStanding,
    iconWrap: "bg-amber-400/14 text-amber-300",
  },
  {
    value: "athlete",
    labelKey: "nutritionMembershipActivity.athlete.athlete",
    descriptionKey: "nutritionMembershipActivity.athlete.athleteDescription",
    icon: Dumbbell,
    iconWrap: "bg-slate-400/10 text-slate-300",
  },
];

const ACTIVITY_LEVEL_OPTIONS: Array<{
  value: NutritionActivityLevel;
  labelKey: MessageKey;
  descriptionKey: MessageKey;
  intensity: number;
}> = [
  { value: "very-low", labelKey: "nutritionMembershipActivity.level.veryLow", descriptionKey: "nutritionMembershipActivity.level.veryLowDescription", intensity: 1 },
  { value: "medium", labelKey: "nutritionMembershipActivity.level.medium", descriptionKey: "nutritionMembershipActivity.level.mediumDescription", intensity: 2 },
  { value: "high", labelKey: "nutritionMembershipActivity.level.high", descriptionKey: "nutritionMembershipActivity.level.highDescription", intensity: 3 },
  { value: "intense", labelKey: "nutritionMembershipActivity.level.intense", descriptionKey: "nutritionMembershipActivity.level.intenseDescription", intensity: 4 },
];

const PROFILE_SETUP_STEP = MEMBERSHIP_STEPS.activity;
const PROFILE_SETUP_TOTAL_STEPS = MEMBERSHIP_TOTAL_STEPS;

function ActivityBars({ level, active }: { level: number; active: boolean }) {
  return (
    <div className={cn(
      "flex h-[44px] w-[44px] items-end justify-center gap-1 rounded-[15px] px-2 py-2",
      active ? "bg-amber-400/14" : "bg-white/6",
    )}>
      {[1, 2, 3, 4].map((item) => (
        <span
          key={item}
          className={cn(
            "w-1.5 rounded-full",
            item <= level && active ? "bg-amber-300" : item <= level ? "bg-slate-300/70" : "bg-slate-500/35",
            item === 1 && "h-3",
            item === 2 && "h-4",
            item === 3 && "h-5",
            item === 4 && "h-6",
          )}
        />
      ))}
    </div>
  );
}

export default function NutritionMembershipActivityPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, isLoading } = useAuth();
  const { dir, isRtl } = useLocale();
  const t = useT();
  const initialState = useMemo(() => getNutritionFormState(), []);
  const searchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const [athleteMode, setAthleteMode] = useState<NutritionAthleteMode | null>(initialState.athleteMode ?? null);
  const [activityLevel, setActivityLevel] = useState<NutritionActivityLevel | null>(initialState.activityLevel ?? null);
  const activityLevelSectionRef = useRef<HTMLElement | null>(null);
  const shouldPersistEdit = isReturningToProfileHomeReview(searchParams);
  const backHref = resolveProfileHomeReviewAwareHref("/nutrition/membership/gender", searchParams);
  const nextHref = appendProfileHomeReviewReturn("/nutrition/membership/birth-date", backHref !== "/nutrition/membership/gender");

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/nutrition");
      return;
    }

    if (!shouldPersistEdit && !initialState.gender && !user?.gender) {
      setLocation("/nutrition/membership/gender");
    }
  }, [initialState.gender, isLoading, setLocation, shouldPersistEdit, user]);

  const handleAthleteSelect = (value: NutritionAthleteMode) => {
    setAthleteMode(value);
    setActivityLevel(value === athleteMode ? activityLevel : null);
    updateNutritionFormState({ athleteMode: value, activityLevel: value === athleteMode ? activityLevel ?? undefined : undefined });

    window.setTimeout(() => {
      if (!window.matchMedia("(max-width: 640px)").matches) {
        return;
      }

      activityLevelSectionRef.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start",
      });
    }, 80);
  };

  const handleLevelSelect = (value: NutritionActivityLevel) => {
    if (!athleteMode) {
      return;
    }

    setActivityLevel(value);
    updateNutritionFormState({ athleteMode, activityLevel: value });
    if (!shouldPersistEdit) {
      setLocation(nextHref);
    }
  };

  const handleContinue = async () => {
    if (!athleteMode || !activityLevel) {
      return;
    }

    updateNutritionFormState({ athleteMode, activityLevel });
    if (shouldPersistEdit) {
      const result = await saveMembershipProfileEdit({ step: "activity", athleteMode, activityLevel });
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
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.14),transparent_26%),linear-gradient(180deg,rgba(7,12,26,0.18),rgba(7,12,26,0.82)_42%,rgba(7,12,26,0.98)_100%)]" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[390px] flex-col px-5 pb-10 pt-8">
        <NutritionTopbar backHref={backHref} title={t("nutritionMembershipShared.topbarTitle")} description={t("nutritionMembershipActivity.topbarDescription")} variant="hero" />

        <MembershipStepProgress step={PROFILE_SETUP_STEP} totalSteps={PROFILE_SETUP_TOTAL_STEPS} className="mt-8 space-y-3" itemClassName="h-1.5" />

        <main className="flex flex-1 flex-col pt-8">
          <div className="mx-auto flex h-[64px] w-[64px] items-center justify-center rounded-[23px] border border-amber-300/22 bg-amber-400/12 text-amber-300 shadow-[0_24px_55px_-38px_rgba(251,191,36,0.9)]">
            <Activity className="h-8 w-8" />
          </div>

          <div className="mt-7 text-center">
            <h1 className="text-[24px] font-black leading-[1.45] text-white">{t("nutritionMembershipActivity.title")}</h1>
          </div>

          <section className="mt-7 space-y-2.5">
            <div className="flex w-full items-center justify-start gap-2 text-start text-[13px] font-black text-slate-300">
              <Zap className="h-3.5 w-3.5 text-amber-300" />
              <span>{t("nutritionMembershipActivity.athleteQuestion")}</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {ATHLETE_OPTIONS.map((option) => {
                const Icon = option.icon;
                const active = athleteMode === option.value;

                return (
                  <button
                    key={option.value}
                  type="button"
                  onClick={() => handleAthleteSelect(option.value)}
                  className={cn(
                      "relative flex min-h-[116px] flex-col items-center justify-center rounded-[20px] border p-3 text-center transition-all duration-200",
                      active
                        ? "border-amber-300/55 bg-amber-400/10 shadow-[0_18px_48px_-34px_rgba(251,191,36,0.7)]"
                        : "border-white/10 bg-white/[0.025]",
                    )}
                  >
                    <span className={cn(
                      "absolute end-3 top-3 flex h-6 w-6 items-center justify-center rounded-full border",
                      active ? "border-amber-300 bg-amber-400 text-slate-950" : "border-white/18",
                    )}>
                      {active ? <Check className="h-3.5 w-3.5" /> : null}
                    </span>
                    <div className={cn("mb-4 flex h-[50px] w-[50px] items-center justify-center rounded-[17px]", option.iconWrap)}>
                      <Icon className="h-7 w-7" />
                    </div>
                    <div className="text-[15px] font-black leading-6 text-white">{t(option.labelKey)}</div>
                  </button>
                );
              })}
            </div>
          </section>

          {athleteMode ? (
            <section ref={activityLevelSectionRef} className="mt-6 scroll-mt-6 space-y-2.5">
              <div className="flex w-full items-center justify-start gap-2 text-start text-[13px] font-black text-slate-300">
                <Zap className="h-3.5 w-3.5 text-amber-300" />
                <span>{t("nutritionMembershipActivity.levelTitle")}</span>
              </div>
              {ACTIVITY_LEVEL_OPTIONS.map((option) => {
                const active = activityLevel === option.value;

                return (
                  <button
                    key={option.value}
                  type="button"
                  onClick={() => handleLevelSelect(option.value)}
                  className={cn(
                      "grid min-h-[68px] w-full grid-cols-[auto_1fr_auto] items-center gap-3 rounded-[19px] border px-3 py-2.5 text-start transition-all duration-200",
                      active
                        ? "border-amber-300/55 bg-amber-400/10 shadow-[0_18px_48px_-34px_rgba(251,191,36,0.7)]"
                        : "border-white/10 bg-white/[0.025]",
                    )}
                  >
                    <ActivityBars level={option.intensity} active={active} />
                    <div className="min-w-0 space-y-1">
                      <div className="text-[16px] font-black leading-6 text-white">{t(option.labelKey)}</div>
                      <div className="text-[11px] font-semibold leading-5 text-slate-400">{t(option.descriptionKey)}</div>
                    </div>
                    <span className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full border",
                      active ? "border-amber-300 bg-amber-400 text-slate-950" : "border-white/18",
                    )}>
                      {active ? <Check className="h-3.5 w-3.5" /> : null}
                    </span>
                  </button>
                );
              })}
            </section>
          ) : null}

          <Button
            type="button"
            onClick={() => void handleContinue()}
            disabled={!athleteMode || !activityLevel}
            className="mt-7 h-[54px] w-full shrink-0 rounded-[17px] bg-[linear-gradient(135deg,#f8c45a,#f59e0b)] text-[15px] font-black text-slate-950 shadow-[0_22px_55px_-34px_rgba(251,191,36,0.95)] hover:opacity-95 disabled:opacity-55"
          >
            {shouldPersistEdit ? t("nutritionMembershipShared.saveChanges") : t("nutritionMembershipGender.continue")}
            <ArrowLeft className={`me-2 h-[18px] w-[18px] ${isRtl ? "" : "rotate-180"}`} />
          </Button>
        </main>
      </div>
    </div>
  );
}
