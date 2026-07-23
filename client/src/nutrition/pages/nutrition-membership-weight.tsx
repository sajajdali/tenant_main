import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Minus, Plus, Weight } from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { MembershipStepProgress } from "@/nutrition/components/membership-step-progress";
import { NutritionTopbar } from "@/nutrition/components/nutrition-topbar";
import { PROFILE_HOME_REVIEW_HREF, isReturningToProfileHomeReview, resolveProfileHomeReviewAwareHref } from "@/nutrition/lib/membership-edit-navigation";
import { saveMembershipProfileEdit } from "@/nutrition/lib/membership-edit-persistence";
import { MEMBERSHIP_STEPS, MEMBERSHIP_TOTAL_STEPS } from "@/nutrition/lib/membership-progress";
import { getNutritionFormState, updateNutritionFormState } from "@/nutrition/lib/nutrition-form-state";
import { Button } from "@/components/ui/button";
import { normalizeDigits } from "@/lib/normalize";
import { useFormat, useLocale, useT } from "@/i18n/locale";

const MIN_WEIGHT_KG = 20;
const MAX_WEIGHT_KG = 350;
const DEFAULT_WEIGHT_KG = 78;
const GRAM_STEP = 100;
const PROFILE_SETUP_STEP = MEMBERSHIP_STEPS.weight;
const PROFILE_SETUP_TOTAL_STEPS = MEMBERSHIP_TOTAL_STEPS;

function parseWeightParts(value?: string) {
  const normalized = normalizeDigits(value || "").replace(/[^\d.]/g, "");
  const [kgPart = "", decimalPart = ""] = normalized.split(".");
  const kg = Math.min(MAX_WEIGHT_KG, Math.max(MIN_WEIGHT_KG, Number(kgPart) || DEFAULT_WEIGHT_KG));
  const grams = Math.min(950, Math.max(0, Number((decimalPart + "000").slice(0, 3)) || 0));

  return { kg, grams };
}

function formatWeight(kg: number, grams: number) {
  if (grams <= 0) {
    return String(kg);
  }

  return `${kg}.${String(grams).padStart(3, "0").replace(/0+$/, "")}`;
}

export default function NutritionMembershipWeightPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const t = useT();
  const format = useFormat();
  const { dir, isRtl } = useLocale();
  const { user, isLoading } = useAuth();
  const formState = useMemo(() => getNutritionFormState(), []);
  const searchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const initialWeightParts = useMemo(() => parseWeightParts(formState.weightKg), [formState.weightKg]);
  const [weightKg, setWeightKg] = useState(initialWeightParts.kg);
  const [weightGrams, setWeightGrams] = useState(initialWeightParts.grams);
  const [weightKgDraft, setWeightKgDraft] = useState<string | null>(null);
  const [weightGramsDraft, setWeightGramsDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const shouldPersistEdit = isReturningToProfileHomeReview(searchParams);
  const backHref = resolveProfileHomeReviewAwareHref("/nutrition/membership/height", searchParams);
  const nextHref = resolveProfileHomeReviewAwareHref("/nutrition/membership/target-weight", searchParams);

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/nutrition");
      return;
    }

    if (!shouldPersistEdit && !formState.dietGoal) {
      setLocation("/nutrition/membership/goal");
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
      return;
    }

    if (!shouldPersistEdit && !formState.heightCm) {
      setLocation("/nutrition/membership/height");
    }
  }, [formState.activityLevel, formState.athleteMode, formState.birthDate, formState.dietGoal, formState.gender, formState.heightCm, isLoading, setLocation, shouldPersistEdit, user]);

  const weight = formatWeight(weightKg, weightGrams);
  const numericWeight = Number(weight);
  const isWeightKgDraftValid =
    weightKgDraft === null ||
    (weightKgDraft !== "" && Number(weightKgDraft) >= MIN_WEIGHT_KG && Number(weightKgDraft) <= MAX_WEIGHT_KG);
  const isWeightGramsDraftValid =
    weightGramsDraft === null ||
    (weightGramsDraft !== "" && Number(weightGramsDraft) >= 0 && Number(weightGramsDraft) <= 950);
  const isValidWeight =
    !Number.isNaN(numericWeight) &&
    numericWeight >= MIN_WEIGHT_KG &&
    numericWeight <= MAX_WEIGHT_KG &&
    isWeightKgDraftValid &&
    isWeightGramsDraftValid;

  const setNormalizedWeightKg = (value: number) => {
    setWeightKg(Math.min(MAX_WEIGHT_KG, Math.max(MIN_WEIGHT_KG, value)));
  };

  const handleWeightKgInput = (value: string) => {
    const nextValue = normalizeDigits(value).replace(/\D/g, "").slice(0, 3);
    setWeightKgDraft(nextValue);

    const numericValue = Number(nextValue);
    if (nextValue !== "" && numericValue >= MIN_WEIGHT_KG && numericValue <= MAX_WEIGHT_KG) {
      setWeightKg(numericValue);
    }
  };

  const commitWeightKgInput = () => {
    if (weightKgDraft !== null && weightKgDraft !== "") {
      setNormalizedWeightKg(Number(weightKgDraft));
    }
    setWeightKgDraft(null);
  };

  const setNormalizedWeightGrams = (value: number) => {
    if (value > 950) {
      setNormalizedWeightKg(weightKg + 1);
      setWeightGrams(0);
      return;
    }

    if (value < 0) {
      setNormalizedWeightKg(weightKg - 1);
      setWeightGrams(1000 - GRAM_STEP);
      return;
    }

    setWeightGrams(value);
  };

  const handleWeightGramsInput = (value: string) => {
    const nextValue = normalizeDigits(value).replace(/\D/g, "").slice(0, 3);
    setWeightGramsDraft(nextValue);

    const numericValue = Number(nextValue);
    if (nextValue !== "" && numericValue >= 0 && numericValue <= 950) {
      setWeightGrams(numericValue);
    }
  };

  const commitWeightGramsInput = () => {
    if (weightGramsDraft !== null && weightGramsDraft !== "") {
      setNormalizedWeightGrams(Number(weightGramsDraft));
    }
    setWeightGramsDraft(null);
  };

  const handleContinue = async () => {
    if (!isValidWeight) {
      return;
    }

    if (shouldPersistEdit) {
      updateNutritionFormState({ weightKg: weight });
      setSaving(true);
      const result = await saveMembershipProfileEdit({ step: "weight", weightKg: weight });
      setSaving(false);
      if (!result.success) {
        toast({ variant: "destructive", title: t("nutritionMembershipShared.toast.saveFailed"), description: result.message });
        return;
      }

      setLocation(PROFILE_HOME_REVIEW_HREF);
      return;
    }

    const latestFormState = getNutritionFormState();
    const resolvedDietGoal = latestFormState.dietGoal ?? formState.dietGoal;
    const resolvedGender = latestFormState.gender ?? formState.gender;
    const resolvedAthleteMode = latestFormState.athleteMode ?? formState.athleteMode;
    const resolvedActivityLevel = latestFormState.activityLevel ?? formState.activityLevel;
    const resolvedBirthDate = latestFormState.birthDate ?? formState.birthDate;
    const resolvedHeightCm = latestFormState.heightCm ?? formState.heightCm;

    if (!resolvedDietGoal || !resolvedGender || !resolvedAthleteMode || !resolvedActivityLevel || !resolvedBirthDate || !resolvedHeightCm) {
      toast({
        variant: "destructive",
        title: t("nutritionMembershipWeight.toast.incompleteTitle"),
        description: t("nutritionMembershipWeight.toast.incompleteDescription"),
      });
      return;
    }

    setSaving(true);
    const result = await api.nutrition.saveProfile({
      dietGoal: resolvedDietGoal,
      gender: resolvedGender,
      athleteMode: resolvedAthleteMode,
      activityLevel: resolvedActivityLevel,
      birthDate: resolvedBirthDate,
      heightCm: resolvedHeightCm,
      weightKg: weight,
    });
    setSaving(false);

    if (!result.success) {
      toast({
        variant: "destructive",
        title: t("nutritionMembershipWeight.toast.saveProfileFailed"),
        description: result.message,
      });
      return;
    }

    updateNutritionFormState({
      weightKg: weight,
      idealWeightKg: result.data.recommendation.idealWeightKg,
      recommendedTargetWeightKg: result.data.recommendation.recommendedTargetWeightKg,
      healthyMinWeightKg: result.data.recommendation.healthyMinWeightKg,
      healthyMaxWeightKg: result.data.recommendation.healthyMaxWeightKg,
      completedProfileSaved: true,
    });
    setLocation(nextHref);
  };

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-[#0a1224] text-white" dir={dir}>
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.14),transparent_26%),linear-gradient(180deg,rgba(7,12,26,0.18),rgba(7,12,26,0.82)_42%,rgba(7,12,26,0.98)_100%)]" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[390px] flex-col px-5 pb-10 pt-8">
        <NutritionTopbar backHref={backHref} title={t("nutritionMembershipShared.topbarTitle")} description={t("nutritionMembershipWeight.topbarDescription")} variant="hero" />

        <MembershipStepProgress
          step={PROFILE_SETUP_STEP}
          totalSteps={PROFILE_SETUP_TOTAL_STEPS}
          className="mt-8 space-y-3 max-[400px]:mt-7 max-[400px]:space-y-2.5"
          barClassName="max-[400px]:gap-0.5"
          itemClassName="h-1.5 max-[400px]:h-1"
        />

        <main className="flex flex-1 flex-col pt-[64px] max-[400px]:pt-12">
          <div className="mx-auto flex h-[64px] w-[64px] items-center justify-center rounded-[23px] border border-amber-300/22 bg-amber-400/12 text-amber-300 shadow-[0_24px_55px_-38px_rgba(251,191,36,0.9)] max-[400px]:h-[56px] max-[400px]:w-[56px] max-[400px]:rounded-[20px]">
            <Weight className="h-8 w-8 max-[400px]:h-7 max-[400px]:w-7" />
          </div>

          <div className="mt-7 space-y-3 text-center max-[400px]:mt-6 max-[400px]:space-y-2.5">
            <h1 className="text-[24px] font-black leading-[1.45] text-white max-[400px]:text-[21px]">{t("nutritionMembershipWeight.title")}</h1>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-3 max-[400px]:mt-6 max-[400px]:gap-2.5" dir="ltr">
            <div className="min-w-0 space-y-2" dir={dir}>
              <div className="flex items-center justify-center gap-1.5 text-center text-[13px] font-black text-white max-[400px]:text-[12px]">
                <span className="h-2 w-2 rounded-full bg-amber-300" />
                {t("nutritionMembershipWeight.kgLabel")}
              </div>
              <div className="min-w-0 rounded-[20px] border border-white/10 bg-white/[0.025] p-2 max-[400px]:rounded-[18px] max-[400px]:p-1.5" dir={dir}>
                <div className="grid min-w-0 grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-1.5 max-[400px]:grid-cols-[38px_minmax(0,1fr)_38px] max-[400px]:gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setWeightKgDraft(null);
                      setNormalizedWeightKg(weightKg - 1);
                    }}
                    disabled={weightKg <= MIN_WEIGHT_KG}
                    aria-label={t("nutritionMembershipWeight.decreaseKg")}
                    className="flex h-[46px] items-center justify-center rounded-[14px] border border-white/8 bg-white/8 text-white transition hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-40 max-[400px]:h-[40px] max-[400px]:rounded-[12px]"
                  >
                    <Minus className="h-5 w-5 max-[400px]:h-4 max-[400px]:w-4" />
                  </button>
                  <input
                    value={weightKgDraft ?? format.number(weightKg, { useGrouping: false })}
                    onFocus={(event) => {
                      setWeightKgDraft(String(weightKg));
                      event.currentTarget.select();
                    }}
                    onChange={(event) => handleWeightKgInput(event.target.value)}
                    onBlur={commitWeightKgInput}
                    inputMode="numeric"
                    pattern="[0-9۰-۹]*"
                    enterKeyHint="done"
                    autoComplete="off"
                    aria-label={t("nutritionMembershipWeight.kgInputAria")}
                    className="min-w-0 border-none bg-transparent p-0 text-center text-[32px] font-black leading-none text-white outline-none max-[400px]:text-[26px]"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setWeightKgDraft(null);
                      setNormalizedWeightKg(weightKg + 1);
                    }}
                    disabled={weightKg >= MAX_WEIGHT_KG}
                    aria-label={t("nutritionMembershipWeight.increaseKg")}
                    className="flex h-[46px] items-center justify-center rounded-[14px] border border-white/8 bg-white/8 text-amber-300 transition hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-40 max-[400px]:h-[40px] max-[400px]:rounded-[12px]"
                  >
                    <Plus className="h-5 w-5 max-[400px]:h-4 max-[400px]:w-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="min-w-0 space-y-2" dir={dir}>
              <div className="flex items-center justify-center gap-1.5 text-center text-[13px] font-black text-white max-[400px]:text-[12px]">
                <span className="h-2 w-2 rounded-full bg-cyan-300" />
                {t("nutritionMembershipWeight.gramLabel")}
              </div>
              <div className="min-w-0 rounded-[20px] border border-white/10 bg-white/[0.025] p-2 max-[400px]:rounded-[18px] max-[400px]:p-1.5" dir={dir}>
                <div className="grid min-w-0 grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-1.5 max-[400px]:grid-cols-[38px_minmax(0,1fr)_38px] max-[400px]:gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setWeightGramsDraft(null);
                      setNormalizedWeightGrams(weightGrams - GRAM_STEP);
                    }}
                    disabled={weightKg <= MIN_WEIGHT_KG && weightGrams <= 0}
                    aria-label={t("nutritionMembershipWeight.decreaseGram")}
                    className="flex h-[46px] items-center justify-center rounded-[14px] border border-white/8 bg-white/8 text-white transition hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-40 max-[400px]:h-[40px] max-[400px]:rounded-[12px]"
                  >
                    <Minus className="h-5 w-5 max-[400px]:h-4 max-[400px]:w-4" />
                  </button>
                  <input
                    value={weightGramsDraft ?? format.number(weightGrams, { useGrouping: false })}
                    onFocus={(event) => {
                      setWeightGramsDraft(String(weightGrams));
                      event.currentTarget.select();
                    }}
                    onChange={(event) => handleWeightGramsInput(event.target.value)}
                    onBlur={commitWeightGramsInput}
                    inputMode="numeric"
                    pattern="[0-9۰-۹]*"
                    enterKeyHint="done"
                    autoComplete="off"
                    aria-label={t("nutritionMembershipWeight.gramInputAria")}
                    className="min-w-0 border-none bg-transparent p-0 text-center text-[30px] font-black leading-none text-white outline-none max-[400px]:text-[25px]"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setWeightGramsDraft(null);
                      setNormalizedWeightGrams(weightGrams + GRAM_STEP);
                    }}
                    disabled={weightKg >= MAX_WEIGHT_KG && weightGrams >= 0}
                    aria-label={t("nutritionMembershipWeight.increaseGram")}
                    className="flex h-[46px] items-center justify-center rounded-[14px] border border-white/8 bg-white/8 text-amber-300 transition hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-40 max-[400px]:h-[40px] max-[400px]:rounded-[12px]"
                  >
                    <Plus className="h-5 w-5 max-[400px]:h-4 max-[400px]:w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 text-center text-[12px] font-black leading-6 text-slate-400 max-[400px]:text-[11px] max-[400px]:leading-5">
            {t("nutritionMembershipWeight.finalWeightPrefix")}
            {" "}
            <span className="text-amber-300">{format.number(weightKg)}</span> {t("nutritionMembershipWeight.kgUnit")}
            {" "}
            {t("nutritionMembershipWeight.and")}
            {" "}
            <span className="text-cyan-300">{format.number(weightGrams)}</span> {t("nutritionMembershipWeight.gramUnit")}
          </div>

          <Button
            type="button"
            onClick={() => void handleContinue()}
            disabled={!isValidWeight || saving}
            className="mt-auto h-[56px] w-full shrink-0 rounded-[18px] bg-[linear-gradient(135deg,#f8c45a,#f59e0b)] text-[16px] font-black text-slate-950 shadow-[0_22px_55px_-34px_rgba(251,191,36,0.95)] hover:opacity-95 disabled:opacity-55 max-[400px]:h-[50px] max-[400px]:text-[14px]"
          >
            {shouldPersistEdit ? t("nutritionMembershipShared.saveChanges") : t("common.continue")}
            <ArrowLeft className={`h-[18px] w-[18px] ${isRtl ? "ms-2" : "me-2 rotate-180"}`} />
          </Button>
        </main>
      </div>
    </div>
  );
}
