import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Minus, Plus, Ruler } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { MembershipStepProgress } from "@/nutrition/components/membership-step-progress";
import { NutritionTopbar } from "@/nutrition/components/nutrition-topbar";
import { PROFILE_HOME_REVIEW_HREF, appendProfileHomeReviewReturn, isReturningToProfileHomeReview, resolveProfileHomeReviewAwareHref } from "@/nutrition/lib/membership-edit-navigation";
import { saveMembershipProfileEdit } from "@/nutrition/lib/membership-edit-persistence";
import { MEMBERSHIP_STEPS, MEMBERSHIP_TOTAL_STEPS } from "@/nutrition/lib/membership-progress";
import { getNutritionFormState, updateNutritionFormState } from "@/nutrition/lib/nutrition-form-state";
import { Button } from "@/components/ui/button";
import { normalizeDigits } from "@/lib/normalize";
import { useFormat, useLocale, useT } from "@/i18n/locale";

const MIN_HEIGHT_CM = 80;
const MAX_HEIGHT_CM = 250;
const DEFAULT_HEIGHT_CM = 168;
const PROFILE_SETUP_STEP = MEMBERSHIP_STEPS.height;
const PROFILE_SETUP_TOTAL_STEPS = MEMBERSHIP_TOTAL_STEPS;

export default function NutritionMembershipHeightPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, isLoading } = useAuth();
  const { dir, isRtl } = useLocale();
  const t = useT();
  const format = useFormat();
  const formState = useMemo(() => getNutritionFormState(), []);
  const searchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const [height, setHeight] = useState(() => String(formState.heightCm || DEFAULT_HEIGHT_CM));
  const shouldPersistEdit = isReturningToProfileHomeReview(searchParams);
  const backHref = resolveProfileHomeReviewAwareHref("/nutrition/membership/birth-date", searchParams);
  const nextHref = appendProfileHomeReviewReturn("/nutrition/membership/weight", backHref !== "/nutrition/membership/birth-date");

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/nutrition");
      return;
    }

    if (!shouldPersistEdit && !formState.gender) {
      setLocation("/nutrition/membership/gender");
      return;
    }

    if (!shouldPersistEdit && (!formState.athleteMode || !formState.activityLevel)) {
      setLocation("/nutrition/membership/activity");
      return;
    }

    if (!shouldPersistEdit && !formState.birthDate) {
      setLocation("/nutrition/membership/birth-date");
    }
  }, [formState.activityLevel, formState.athleteMode, formState.birthDate, formState.gender, isLoading, setLocation, shouldPersistEdit, user]);

  const numericHeight = Number(normalizeDigits(height));
  const isValidHeight = numericHeight >= MIN_HEIGHT_CM && numericHeight <= MAX_HEIGHT_CM;
  const resolvedHeight = isValidHeight ? numericHeight : DEFAULT_HEIGHT_CM;
  const heightProgress = ((resolvedHeight - MIN_HEIGHT_CM) / (MAX_HEIGHT_CM - MIN_HEIGHT_CM)) * 100;

  const setNormalizedHeight = (value: number) => {
    const nextHeight = Math.min(MAX_HEIGHT_CM, Math.max(MIN_HEIGHT_CM, value));
    setHeight(String(nextHeight));
  };

  const handleHeightInput = (value: string) => {
    const nextValue = normalizeDigits(value).replace(/\D/g, "").slice(0, 3);
    setHeight(nextValue);
  };

  const handleContinue = async () => {
    if (!isValidHeight) {
      return;
    }

    updateNutritionFormState({ heightCm: numericHeight });
    if (shouldPersistEdit) {
      const result = await saveMembershipProfileEdit({ step: "height", heightCm: numericHeight });
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
        <NutritionTopbar backHref={backHref} title={t("nutritionMembershipShared.topbarTitle")} description={t("nutritionMembershipHeight.topbarDescription")} variant="hero" />

        <MembershipStepProgress step={PROFILE_SETUP_STEP} totalSteps={PROFILE_SETUP_TOTAL_STEPS} className="mt-8 space-y-3" itemClassName="h-1.5" />

        <main className="flex flex-1 flex-col pt-[116px]">
          <div className="mx-auto flex h-[64px] w-[64px] items-center justify-center rounded-[23px] border border-amber-300/22 bg-amber-400/12 text-amber-300 shadow-[0_24px_55px_-38px_rgba(251,191,36,0.9)]">
            <Ruler className="h-8 w-8" />
          </div>

          <div className="mt-7 text-center">
            <h1 className="text-[24px] font-black leading-[1.45] text-white">{t("nutritionMembershipHeight.title")}</h1>
          </div>

          <div className="mt-8 rounded-[24px] border border-white/10 bg-white/[0.025] p-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02)]">
            <div className="grid grid-cols-[64px_1fr_64px] items-center gap-3">
              <button
                type="button"
                onClick={() => setNormalizedHeight((Number(normalizeDigits(height)) || DEFAULT_HEIGHT_CM) - 1)}
                disabled={numericHeight <= MIN_HEIGHT_CM}
                aria-label={t("nutritionMembershipHeight.decrease")}
                className="flex h-[64px] items-center justify-center rounded-[18px] border border-white/8 bg-white/8 text-white transition hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Minus className="h-5 w-5" />
              </button>

              <div className="flex min-w-0 items-center justify-center gap-2">
                <input
                  value={height}
                  onChange={(event) => handleHeightInput(event.target.value)}
                  onBlur={() => {
                    if (!isValidHeight) {
                      setNormalizedHeight(Number(normalizeDigits(height)) || DEFAULT_HEIGHT_CM);
                    }
                  }}
                  inputMode="numeric"
                  aria-label={t("nutritionMembershipHeight.inputLabel")}
                  className="h-[64px] w-[76px] border-none bg-transparent p-0 text-center text-[44px] font-black leading-none text-white outline-none"
                  dir="ltr"
                />
                <span className="text-[12px] font-black text-slate-400">{t("nutritionMembershipHeight.unit")}</span>
              </div>

              <button
                type="button"
                onClick={() => setNormalizedHeight((Number(normalizeDigits(height)) || DEFAULT_HEIGHT_CM) + 1)}
                disabled={numericHeight >= MAX_HEIGHT_CM}
                aria-label={t("nutritionMembershipHeight.increase")}
                className="flex h-[64px] items-center justify-center rounded-[18px] border border-white/8 bg-white/8 text-white transition hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-6">
              <input
                type="range"
                min={MIN_HEIGHT_CM}
                max={MAX_HEIGHT_CM}
                value={resolvedHeight}
                onChange={(event) => setNormalizedHeight(Number(event.target.value))}
                aria-label={t("nutritionMembershipHeight.rangeLabel")}
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-transparent accent-amber-400"
                style={{
                  background: `linear-gradient(${isRtl ? "to left" : "to right"}, #f8b43a 0%, #f8b43a ${heightProgress}%, rgba(255,255,255,0.12) ${heightProgress}%, rgba(255,255,255,0.12) 100%)`,
                }}
              />
              <div className="mt-3 flex items-center justify-between text-[11px] font-bold text-slate-500">
                <span>{format.number(MAX_HEIGHT_CM)}</span>
                <span>{format.number(MIN_HEIGHT_CM)}</span>
              </div>
            </div>
          </div>

          <Button
            type="button"
            onClick={() => void handleContinue()}
            disabled={!isValidHeight}
            className="mt-auto h-[56px] w-full shrink-0 rounded-[18px] bg-[linear-gradient(135deg,#f8c45a,#f59e0b)] text-[16px] font-black text-slate-950 shadow-[0_22px_55px_-34px_rgba(251,191,36,0.95)] hover:opacity-95 disabled:opacity-55"
          >
            {shouldPersistEdit ? t("nutritionMembershipShared.saveChanges") : t("nutritionMembershipGender.continue")}
            <ArrowLeft className={`me-2 h-[18px] w-[18px] ${isRtl ? "" : "rotate-180"}`} />
          </Button>
        </main>
      </div>
    </div>
  );
}
