import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, Mars, UsersRound, Venus } from "lucide-react";
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
import { getNutritionFormState, updateNutritionFormState } from "@/nutrition/lib/nutrition-form-state";
import { useLocale, useT } from "@/i18n/locale";
import type { MessageKey } from "@/i18n/messages";

const GENDER_OPTIONS = [
  {
    value: "male" as const,
    labelKey: "nutritionMembershipGender.option.male" as MessageKey,
    icon: Mars,
    accent: "border-sky-300/20 bg-[linear-gradient(180deg,rgba(96,165,250,0.12),rgba(15,23,42,0.16))]",
    iconWrap: "bg-sky-400/14 text-sky-300",
  },
  {
    value: "female" as const,
    labelKey: "nutritionMembershipGender.option.female" as MessageKey,
    icon: Venus,
    accent: "border-rose-300/20 bg-[linear-gradient(180deg,rgba(244,114,182,0.12),rgba(15,23,42,0.16))]",
    iconWrap: "bg-rose-400/12 text-rose-300",
  },
];

const PROFILE_SETUP_STEP = MEMBERSHIP_STEPS.gender;
const PROFILE_SETUP_TOTAL_STEPS = MEMBERSHIP_TOTAL_STEPS;

export default function NutritionMembershipGenderPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, isLoading, updateProfile } = useAuth();
  const { dir } = useLocale();
  const t = useT();
  const initialState = useMemo(() => getNutritionFormState(), []);
  const searchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const [selectedGender, setSelectedGender] = useState<"male" | "female" | null>(
    (initialState.gender as "male" | "female" | null) ?? ((user?.gender as "male" | "female" | null) ?? null),
  );
  const shouldPersistEdit = isReturningToProfileHomeReview(searchParams);
  const backHref = resolveProfileHomeReviewAwareHref("/nutrition/membership/goal", searchParams);
  const nextHref = appendProfileHomeReviewReturn("/nutrition/membership/activity", backHref !== "/nutrition/membership/goal");

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/nutrition/membership");
    }
  }, [isLoading, setLocation, user]);

  if (isLoading || !user) {
    return (
      <div className="relative isolate min-h-screen overflow-hidden bg-[#0a1224] text-white" dir={dir}>
        <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.16),transparent_28%),linear-gradient(180deg,rgba(7,12,26,0.18),rgba(7,12,26,0.82)_42%,rgba(7,12,26,0.98)_100%)]" />
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="relative z-10 h-7 w-7 animate-spin text-amber-300" />
        </div>
      </div>
    );
  }

  const persistGender = (gender: "male" | "female") => {
    updateNutritionFormState({ gender });
    void updateProfile({ name: user?.name ?? "", gender }).catch(() => {});
  };

  const handleSelect = (gender: "male" | "female") => {
    setSelectedGender(gender);
    persistGender(gender);
    if (!shouldPersistEdit) {
      setLocation(nextHref);
    }
  };

  const handleContinue = async () => {
    if (!selectedGender) {
      return;
    }

    persistGender(selectedGender);
    if (shouldPersistEdit) {
      const result = await saveMembershipProfileEdit({ step: "gender", gender: selectedGender });
      if (!result.success) {
        toast({ variant: "destructive", title: t("nutritionMembershipGender.toast.saveFailed"), description: result.message });
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
        <NutritionTopbar backHref={backHref} title={t("nutritionMembershipGender.topbarTitle")} description={t("nutritionMembershipGender.topbarDescription")} variant="hero" />

        <MembershipStepProgress step={PROFILE_SETUP_STEP} totalSteps={PROFILE_SETUP_TOTAL_STEPS} className="mt-8 space-y-3" itemClassName="h-1.5" />

        <main className="flex flex-1 flex-col pt-9">
          <div className="mx-auto flex h-[64px] w-[64px] items-center justify-center rounded-[23px] border border-amber-300/22 bg-amber-400/12 text-amber-300 shadow-[0_24px_55px_-38px_rgba(251,191,36,0.9)]">
            <UsersRound className="h-8 w-8" />
          </div>

          <div className="mt-7 text-center">
            <h1 className="text-[24px] font-black leading-[1.45] text-white">{t("nutritionMembershipGender.title")}</h1>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-3">
            {GENDER_OPTIONS.map((option) => {
              const Icon = option.icon;
              const active = selectedGender === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={cn(
                    "relative flex min-h-[126px] flex-col items-center justify-center rounded-[22px] border p-3 text-center transition-all duration-200",
                    active
                      ? "border-amber-300/55 bg-amber-400/10 shadow-[0_18px_48px_-34px_rgba(251,191,36,0.7)]"
                      : "border-white/10 bg-white/[0.025]",
                  )}
                >
                  <span className={cn(
                    "absolute end-3 top-3 flex h-7 w-7 items-center justify-center rounded-full border",
                    active ? "border-amber-300 bg-amber-400 text-slate-950" : "border-white/18 text-transparent",
                  )}>
                    <Check className="h-4 w-4" />
                  </span>
                  <div
                    className={cn(
                      "mb-4 flex h-[52px] w-[52px] items-center justify-center rounded-[18px]",
                      option.iconWrap,
                    )}
                  >
                    <Icon className="h-7 w-7" />
                  </div>
                  <div className="text-[16px] font-black text-white">{t(option.labelKey)}</div>
                </button>
              );
            })}
          </div>

          <Button
            type="button"
            onClick={() => void handleContinue()}
            disabled={!selectedGender}
            className="mt-auto h-[56px] w-full shrink-0 rounded-[18px] bg-[linear-gradient(135deg,#f8c45a,#f59e0b)] text-[16px] font-black text-slate-950 shadow-[0_22px_55px_-34px_rgba(251,191,36,0.95)] hover:opacity-95 disabled:opacity-55"
          >
            {shouldPersistEdit ? t("nutritionMembershipGender.saveChanges") : t("nutritionMembershipGender.continue")}
          </Button>
        </main>
      </div>
    </div>
  );
}
