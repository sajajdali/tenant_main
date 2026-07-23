import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Minus, Plus, Target } from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { normalizeDigits } from "@/lib/normalize";
import { MembershipStepProgress } from "@/nutrition/components/membership-step-progress";
import { NutritionTopbar } from "@/nutrition/components/nutrition-topbar";
import { PROFILE_HOME_REVIEW_HREF, isReturningToProfileHomeReview, resolveProfileHomeReviewAwareHref } from "@/nutrition/lib/membership-edit-navigation";
import { saveMembershipProfileEdit } from "@/nutrition/lib/membership-edit-persistence";
import { MEMBERSHIP_STEPS, MEMBERSHIP_TOTAL_STEPS } from "@/nutrition/lib/membership-progress";
import { calculateNutritionWeightGoals } from "@/nutrition/lib/nutrition-weight-goals";
import { getNutritionFormState, updateNutritionFormState } from "@/nutrition/lib/nutrition-form-state";
import { useFormat, useLocale, useT } from "@/i18n/locale";

const MIN_WEIGHT_KG = 20;
const MAX_WEIGHT_KG = 350;
const DEFAULT_TARGET_WEIGHT_KG = 68;
const GRAM_STEP = 100;
const PROFILE_SETUP_STEP = MEMBERSHIP_STEPS.targetWeight;
const PROFILE_SETUP_TOTAL_STEPS = MEMBERSHIP_TOTAL_STEPS;

function parseWeightParts(value?: string) {
  const normalized = normalizeDigits(value || "").replace(/[^\d.]/g, "");
  const [kgPart = "", decimalPart = ""] = normalized.split(".");
  const kg = Math.min(MAX_WEIGHT_KG, Math.max(MIN_WEIGHT_KG, Number(kgPart) || DEFAULT_TARGET_WEIGHT_KG));
  const grams = Math.min(950, Math.max(0, Number((decimalPart + "000").slice(0, 3)) || 0));

  return { kg, grams };
}

function formatWeightValue(kg: number, grams: number) {
  if (grams <= 0) {
    return String(kg);
  }

  return `${kg}.${String(grams).padStart(3, "0").replace(/0+$/, "")}`;
}

function roundSuggestedWeight(value: number) {
  return Math.round(value);
}

export default function NutritionMembershipTargetWeightPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const t = useT();
  const format = useFormat();
  const { dir, isRtl } = useLocale();
  const { user, isLoading } = useAuth();
  const formState = useMemo(() => getNutritionFormState(), []);
  const searchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const recommendation = useMemo(() => {
    if (!formState.heightCm || !formState.gender || !formState.dietGoal || !formState.weightKg) {
      return null;
    }

    return calculateNutritionWeightGoals({
      heightCm: formState.heightCm,
      gender: formState.gender,
      dietGoal: formState.dietGoal,
      currentWeightKg: Number(formState.weightKg),
    });
  }, [formState.dietGoal, formState.gender, formState.heightCm, formState.weightKg]);
  const roundedIdealWeight = recommendation ? roundSuggestedWeight(recommendation.idealWeightKg) : null;
  const roundedRecommendedTargetWeight = recommendation ? roundSuggestedWeight(recommendation.recommendedTargetWeightKg) : null;
  const initialTargetWeight = useMemo(() => {
    if (formState.targetWeightKg) {
      return formState.targetWeightKg;
    }

    if (formState.idealWeightKg) {
      return String(roundSuggestedWeight(formState.idealWeightKg));
    }

    if (roundedIdealWeight !== null) {
      return String(roundedIdealWeight);
    }

    return "";
  }, [formState.idealWeightKg, formState.targetWeightKg, roundedIdealWeight]);
  const initialTargetWeightParts = useMemo(() => parseWeightParts(initialTargetWeight), [initialTargetWeight]);
  const [targetWeightKg, setTargetWeightKg] = useState(initialTargetWeightParts.kg);
  const [targetWeightGrams, setTargetWeightGrams] = useState(initialTargetWeightParts.grams);
  const [targetWeightKgDraft, setTargetWeightKgDraft] = useState<string | null>(null);
  const [targetWeightGramsDraft, setTargetWeightGramsDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const shouldPersistEdit = isReturningToProfileHomeReview(searchParams);
  const backHref = resolveProfileHomeReviewAwareHref("/nutrition/membership/weight", searchParams);
  const nextHref = resolveProfileHomeReviewAwareHref("/nutrition/membership/result", searchParams);

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/nutrition");
      return;
    }

    if (!shouldPersistEdit && !formState.completedProfileSaved) {
      setLocation("/nutrition/membership/weight");
    }
  }, [formState.completedProfileSaved, isLoading, setLocation, shouldPersistEdit, user]);

  const targetWeight = formatWeightValue(targetWeightKg, targetWeightGrams);
  const targetWeightNumber = Number(targetWeight);
  const isTargetWeightKgDraftValid =
    targetWeightKgDraft === null ||
    (targetWeightKgDraft !== "" && Number(targetWeightKgDraft) >= MIN_WEIGHT_KG && Number(targetWeightKgDraft) <= MAX_WEIGHT_KG);
  const isTargetWeightGramsDraftValid =
    targetWeightGramsDraft === null ||
    (targetWeightGramsDraft !== "" && Number(targetWeightGramsDraft) >= 0 && Number(targetWeightGramsDraft) <= 950);
  const isValidWeight =
    !Number.isNaN(targetWeightNumber) &&
    targetWeightNumber >= MIN_WEIGHT_KG &&
    targetWeightNumber <= MAX_WEIGHT_KG &&
    isTargetWeightKgDraftValid &&
    isTargetWeightGramsDraftValid;

  const setNormalizedTargetWeightKg = (value: number) => {
    setTargetWeightKg(Math.min(MAX_WEIGHT_KG, Math.max(MIN_WEIGHT_KG, value)));
  };

  const handleTargetWeightKgInput = (value: string) => {
    const nextValue = normalizeDigits(value).replace(/\D/g, "").slice(0, 3);
    setTargetWeightKgDraft(nextValue);

    const numericValue = Number(nextValue);
    if (nextValue !== "" && numericValue >= MIN_WEIGHT_KG && numericValue <= MAX_WEIGHT_KG) {
      setTargetWeightKg(numericValue);
    }
  };

  const commitTargetWeightKgInput = () => {
    if (targetWeightKgDraft !== null && targetWeightKgDraft !== "") {
      setNormalizedTargetWeightKg(Number(targetWeightKgDraft));
    }
    setTargetWeightKgDraft(null);
  };

  const setNormalizedTargetWeightGrams = (value: number) => {
    if (value > 950) {
      setNormalizedTargetWeightKg(targetWeightKg + 1);
      setTargetWeightGrams(0);
      return;
    }

    if (value < 0) {
      setNormalizedTargetWeightKg(targetWeightKg - 1);
      setTargetWeightGrams(1000 - GRAM_STEP);
      return;
    }

    setTargetWeightGrams(value);
  };

  const handleTargetWeightGramsInput = (value: string) => {
    const nextValue = normalizeDigits(value).replace(/\D/g, "").slice(0, 3);
    setTargetWeightGramsDraft(nextValue);

    const numericValue = Number(nextValue);
    if (nextValue !== "" && numericValue >= 0 && numericValue <= 950) {
      setTargetWeightGrams(numericValue);
    }
  };

  const commitTargetWeightGramsInput = () => {
    if (targetWeightGramsDraft !== null && targetWeightGramsDraft !== "") {
      setNormalizedTargetWeightGrams(Number(targetWeightGramsDraft));
    }
    setTargetWeightGramsDraft(null);
  };
  const goalMessage = (() => {
    if (!recommendation || !formState.dietGoal || !formState.weightKg) {
      return "";
    }

    const currentWeight = Number(formState.weightKg);

    if (formState.dietGoal === "lose-weight") {
      if (currentWeight <= recommendation.healthyMinWeightKg) {
        return t("nutritionMembershipTargetWeight.goalMessage.loseLow");
      }

      if (currentWeight <= recommendation.healthyMaxWeightKg) {
        return t("nutritionMembershipTargetWeight.goalMessage.loseHealthy");
      }

      return t("nutritionMembershipTargetWeight.goalMessage.loseHigh");
    }

    if (formState.dietGoal === "gain-weight") {
      return t("nutritionMembershipTargetWeight.goalMessage.gain");
    }

    return t("nutritionMembershipTargetWeight.goalMessage.maintain");
  })();

  const persistTargetWeight = async (nextTargetWeight: string) => {
    const nextTargetWeightNumber = Number(nextTargetWeight);

    if (Number.isNaN(nextTargetWeightNumber) || nextTargetWeightNumber < MIN_WEIGHT_KG || nextTargetWeightNumber > MAX_WEIGHT_KG) {
      return;
    }

    if (shouldPersistEdit) {
      updateNutritionFormState({ targetWeightKg: nextTargetWeight });
      setSaving(true);
      const result = await saveMembershipProfileEdit({ step: "target-weight", targetWeightKg: nextTargetWeight });
      setSaving(false);
      if (!result.success) {
        toast({ variant: "destructive", title: t("nutritionMembershipShared.toast.saveFailed"), description: result.message });
        return;
      }

      setLocation(PROFILE_HOME_REVIEW_HREF);
      return;
    }

    setSaving(true);
    const result = await api.nutrition.updateTargetWeight(nextTargetWeight);
    setSaving(false);

    if (!result.success) {
      toast({
        variant: "destructive",
        title: t("nutritionMembershipTargetWeight.toast.saveFailed"),
        description: result.message,
      });
      return;
    }

    updateNutritionFormState({ targetWeightKg: nextTargetWeight });
    setLocation(nextHref);
  };

  const handleSuggestedWeightSelect = (value: number) => {
    const nextParts = parseWeightParts(String(value));
    setTargetWeightKgDraft(null);
    setTargetWeightGramsDraft(null);
    setTargetWeightKg(nextParts.kg);
    setTargetWeightGrams(nextParts.grams);
    void persistTargetWeight(formatWeightValue(nextParts.kg, nextParts.grams));
  };

  const handleContinue = async () => {
    await persistTargetWeight(targetWeight);
  };

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-[#0a1224] text-white" dir={dir}>
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.14),transparent_26%),linear-gradient(180deg,rgba(7,12,26,0.18),rgba(7,12,26,0.82)_42%,rgba(7,12,26,0.98)_100%)]" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[390px] flex-col px-5 pb-10 pt-8">
        <NutritionTopbar backHref={backHref} title={t("nutritionMembershipShared.topbarTitle")} description={t("nutritionMembershipTargetWeight.topbarDescription")} variant="hero" />

        <MembershipStepProgress
          step={PROFILE_SETUP_STEP}
          totalSteps={PROFILE_SETUP_TOTAL_STEPS}
          className="mt-8 space-y-3 max-[400px]:mt-7 max-[400px]:space-y-2.5"
          barClassName="max-[400px]:gap-0.5"
          itemClassName="h-1.5 max-[400px]:h-1"
        />

        <main className="flex flex-1 flex-col pt-8">
          <div className="mx-auto flex h-[64px] w-[64px] items-center justify-center rounded-[23px] border border-amber-300/22 bg-amber-400/12 text-amber-300 shadow-[0_24px_55px_-38px_rgba(251,191,36,0.9)] max-[400px]:h-[56px] max-[400px]:w-[56px] max-[400px]:rounded-[20px]">
            <Target className="h-8 w-8 max-[400px]:h-7 max-[400px]:w-7" />
          </div>

          <div className="mt-7 space-y-3 text-center max-[400px]:mt-6 max-[400px]:space-y-2.5">
            <h1 className="text-[24px] font-black leading-[1.45] text-white max-[400px]:text-[21px]">{t("nutritionMembershipTargetWeight.title")}</h1>
            <p className="mx-auto max-w-[330px] text-[13px] font-semibold leading-7 text-slate-400 max-[400px]:text-[12px] max-[400px]:leading-6">
              {t("nutritionMembershipTargetWeight.description")}
            </p>
          </div>

          <div className="mt-7 grid grid-cols-2 gap-3 max-[400px]:mt-6 max-[400px]:gap-2.5" dir="ltr">
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
                      setTargetWeightKgDraft(null);
                      setNormalizedTargetWeightKg(targetWeightKg - 1);
                    }}
                    disabled={targetWeightKg <= MIN_WEIGHT_KG}
                    aria-label={t("nutritionMembershipTargetWeight.decreaseKg")}
                    className="flex h-[46px] items-center justify-center rounded-[14px] border border-white/8 bg-white/8 text-white transition hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-40 max-[400px]:h-[40px] max-[400px]:rounded-[12px]"
                  >
                    <Minus className="h-5 w-5 max-[400px]:h-4 max-[400px]:w-4" />
                  </button>
                  <input
                    value={targetWeightKgDraft ?? format.number(targetWeightKg, { useGrouping: false })}
                    onFocus={(event) => {
                      setTargetWeightKgDraft(String(targetWeightKg));
                      event.currentTarget.select();
                    }}
                    onChange={(event) => handleTargetWeightKgInput(event.target.value)}
                    onBlur={commitTargetWeightKgInput}
                    inputMode="numeric"
                    pattern="[0-9۰-۹]*"
                    enterKeyHint="done"
                    autoComplete="off"
                    aria-label={t("nutritionMembershipTargetWeight.kgInputAria")}
                    className="min-w-0 border-none bg-transparent p-0 text-center text-[32px] font-black leading-none text-white outline-none max-[400px]:text-[26px]"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setTargetWeightKgDraft(null);
                      setNormalizedTargetWeightKg(targetWeightKg + 1);
                    }}
                    disabled={targetWeightKg >= MAX_WEIGHT_KG}
                    aria-label={t("nutritionMembershipTargetWeight.increaseKg")}
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
                      setTargetWeightGramsDraft(null);
                      setNormalizedTargetWeightGrams(targetWeightGrams - GRAM_STEP);
                    }}
                    disabled={targetWeightKg <= MIN_WEIGHT_KG && targetWeightGrams <= 0}
                    aria-label={t("nutritionMembershipTargetWeight.decreaseGram")}
                    className="flex h-[46px] items-center justify-center rounded-[14px] border border-white/8 bg-white/8 text-white transition hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-40 max-[400px]:h-[40px] max-[400px]:rounded-[12px]"
                  >
                    <Minus className="h-5 w-5 max-[400px]:h-4 max-[400px]:w-4" />
                  </button>
                  <input
                    value={targetWeightGramsDraft ?? format.number(targetWeightGrams, { useGrouping: false })}
                    onFocus={(event) => {
                      setTargetWeightGramsDraft(String(targetWeightGrams));
                      event.currentTarget.select();
                    }}
                    onChange={(event) => handleTargetWeightGramsInput(event.target.value)}
                    onBlur={commitTargetWeightGramsInput}
                    inputMode="numeric"
                    pattern="[0-9۰-۹]*"
                    enterKeyHint="done"
                    autoComplete="off"
                    aria-label={t("nutritionMembershipTargetWeight.gramInputAria")}
                    className="min-w-0 border-none bg-transparent p-0 text-center text-[30px] font-black leading-none text-white outline-none max-[400px]:text-[25px]"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setTargetWeightGramsDraft(null);
                      setNormalizedTargetWeightGrams(targetWeightGrams + GRAM_STEP);
                    }}
                    disabled={targetWeightKg >= MAX_WEIGHT_KG && targetWeightGrams >= 0}
                    aria-label={t("nutritionMembershipTargetWeight.increaseGram")}
                    className="flex h-[46px] items-center justify-center rounded-[14px] border border-white/8 bg-white/8 text-amber-300 transition hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-40 max-[400px]:h-[40px] max-[400px]:rounded-[12px]"
                  >
                    <Plus className="h-5 w-5 max-[400px]:h-4 max-[400px]:w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {recommendation && (
            <div className="mt-5 rounded-[20px] border border-emerald-400/35 bg-emerald-400/8 px-4 py-3 text-[13px] font-black leading-7 text-emerald-300 max-[400px]:px-3 max-[400px]:py-2.5 max-[400px]:text-[11px] max-[400px]:leading-6">
              <div className="flex items-center justify-center gap-2">
                <Check className="h-[18px] w-[18px] text-emerald-300" />
                {t("nutritionMembershipTargetWeight.healthyRange", {
                  min: format.number(Math.round(recommendation.healthyMinWeightKg)),
                  max: format.number(Math.round(recommendation.healthyMaxWeightKg)),
                })}
              </div>
            </div>
          )}

          {recommendation && (
            <div className="mt-5 grid grid-cols-2 gap-3 max-[400px]:gap-2.5">
              <button
                type="button"
                onClick={() => handleSuggestedWeightSelect(roundedRecommendedTargetWeight ?? recommendation.recommendedTargetWeightKg)}
                disabled={saving}
                className="min-h-[160px] rounded-[22px] border border-white/10 bg-white/[0.025] p-4 text-center transition hover:border-emerald-300/40 hover:bg-emerald-400/8 max-[400px]:min-h-[138px] max-[400px]:rounded-[19px] max-[400px]:p-3"
              >
                <div className="mx-auto mb-4 flex h-[50px] w-[50px] items-center justify-center rounded-[17px] border border-emerald-300/20 bg-emerald-400/12 text-emerald-300 max-[400px]:mb-3 max-[400px]:h-[42px] max-[400px]:w-[42px] max-[400px]:rounded-[14px]">
                  <Target className="h-6 w-6 max-[400px]:h-5 max-[400px]:w-5" />
                </div>
                <div className="text-[16px] font-black text-white max-[400px]:text-[14px]">{t("nutritionMembershipTargetWeight.healthyWeightTitle")}</div>
                <div className="mt-4 flex flex-row-reverse items-baseline justify-center gap-1 text-emerald-300 max-[400px]:mt-3">
                  <span className="text-[34px] font-black leading-none max-[400px]:text-[28px]">{format.number(roundedRecommendedTargetWeight ?? recommendation.recommendedTargetWeightKg, { maximumFractionDigits: 2 })}</span>
                  <span className="text-[13px] font-black text-slate-400 max-[400px]:text-[11px]">kg</span>
                </div>
                <div className="mt-4 text-[11px] font-bold leading-5 text-slate-400 max-[400px]:mt-3 max-[400px]:text-[10px]">{t("nutritionMembershipTargetWeight.healthyWeightDescription")}</div>
              </button>

              <button
                type="button"
                onClick={() => handleSuggestedWeightSelect(roundedIdealWeight ?? recommendation.idealWeightKg)}
                disabled={saving}
                className="min-h-[160px] rounded-[22px] border border-amber-300/85 bg-amber-400/5 p-4 text-center shadow-[0_18px_48px_-34px_rgba(251,191,36,0.7)] transition hover:bg-amber-400/8 max-[400px]:min-h-[138px] max-[400px]:rounded-[19px] max-[400px]:p-3"
              >
                <div className="mx-auto mb-4 flex h-[50px] w-[50px] items-center justify-center rounded-[17px] border border-amber-300/22 bg-amber-400/12 text-amber-300 max-[400px]:mb-3 max-[400px]:h-[42px] max-[400px]:w-[42px] max-[400px]:rounded-[14px]">
                  <Target className="h-6 w-6 max-[400px]:h-5 max-[400px]:w-5" />
                </div>
                <div className="text-[16px] font-black text-white max-[400px]:text-[14px]">{t("nutritionMembershipTargetWeight.idealWeightTitle")}</div>
                <div className="mt-4 flex flex-row-reverse items-baseline justify-center gap-1 text-amber-300 max-[400px]:mt-3">
                  <span className="text-[34px] font-black leading-none max-[400px]:text-[28px]">{format.number(roundedIdealWeight ?? recommendation.idealWeightKg, { maximumFractionDigits: 2 })}</span>
                  <span className="text-[13px] font-black text-slate-400 max-[400px]:text-[11px]">kg</span>
                </div>
                <div className="mt-4 text-[11px] font-bold leading-5 text-slate-400 max-[400px]:mt-3 max-[400px]:text-[10px]">{t("nutritionMembershipTargetWeight.idealWeightDescription")}</div>
              </button>
            </div>
          )}

          {goalMessage ? (
            <div className="mt-5 rounded-[20px] border border-white/10 bg-white/[0.025] p-4 text-[12px] font-bold leading-7 text-slate-400 max-[400px]:p-3 max-[400px]:text-[11px] max-[400px]:leading-6">
              {goalMessage}
            </div>
          ) : null}

          <Button
            type="button"
            onClick={() => void handleContinue()}
            disabled={!isValidWeight || saving}
            className="mt-5 h-[56px] w-full shrink-0 rounded-[18px] bg-[linear-gradient(135deg,#f8c45a,#f59e0b)] text-[15px] font-black text-slate-950 shadow-[0_22px_55px_-34px_rgba(251,191,36,0.95)] hover:opacity-95 disabled:opacity-55 max-[400px]:h-[50px] max-[400px]:text-[13px]"
          >
            {shouldPersistEdit ? t("nutritionMembershipShared.saveChanges") : t("nutritionMembershipTargetWeight.continue")}
            <ArrowLeft className={`h-[18px] w-[18px] ${isRtl ? "ms-2" : "me-2 rotate-180"}`} />
          </Button>
        </main>
      </div>
    </div>
  );
}
