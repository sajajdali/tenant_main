import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, HeartPulse, Loader2, Minus, Plus, ShieldPlus, Weight } from "lucide-react";
import { useLocation, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { MedicalConditionsEditor } from "@/nutrition/components/medical-conditions-editor";
import { NutritionTopbar } from "@/nutrition/components/nutrition-topbar";
import { getNutritionFormState, updateNutritionFormState } from "@/nutrition/lib/nutrition-form-state";
import { ensureMedicalConditionDraft, summarizeMedicalConditionItems } from "@/nutrition/lib/medical-conditions";
import { cn } from "@/lib/utils";
import { normalizeDigits } from "@/lib/normalize";
import { useFormat, useLocale, useT } from "@/i18n/locale";
import type { MessageKey } from "@/i18n/messages";

type FollowUpChoiceKey =
  | "adherenceLevel"
  | "weightOutcome"
  | "sizeChange"
  | "energyLevel"
  | "satietyLevel"
  | "cravingsLevel"
  | "sleepQuality"
  | "activityLevel"
  | "dietDifficulty"
  | "overallSatisfaction"
  | "newDietPreference"
  | "experiencedIssue"
  | "foodPreference";

type FollowUpStep =
  | {
      key: "currentWeightKg";
      type: "number";
      titleKey: MessageKey;
      descriptionKey: MessageKey;
      helperTextKey: MessageKey;
    }
  | {
      key: FollowUpChoiceKey;
      type: "choice";
      titleKey: MessageKey;
      descriptionKey: MessageKey;
      options: Array<{ key: string; labelKey: MessageKey }>;
    }
  | {
      key: "medicalNotes";
      type: "medicalConditions";
      titleKey: MessageKey;
      descriptionKey: MessageKey;
      helperTextKey: MessageKey;
    };

const FOLLOWUP_STEPS: FollowUpStep[] = [
  {
    key: "currentWeightKg",
    type: "number",
    titleKey: "nutritionDietFollowup.steps.currentWeightKg.title",
    descriptionKey: "nutritionDietFollowup.steps.currentWeightKg.description",
    helperTextKey: "nutritionDietFollowup.steps.currentWeightKg.helper",
  },
  {
    key: "adherenceLevel",
    type: "choice",
    titleKey: "nutritionDietFollowup.steps.adherenceLevel.title",
    descriptionKey: "nutritionDietFollowup.steps.adherenceLevel.description",
    options: [
      { key: "excellent", labelKey: "nutritionDietFollowup.steps.adherenceLevel.option.excellent" },
      { key: "mostly", labelKey: "nutritionDietFollowup.steps.adherenceLevel.option.mostly" },
      { key: "medium", labelKey: "nutritionDietFollowup.steps.adherenceLevel.option.medium" },
      { key: "low", labelKey: "nutritionDietFollowup.steps.adherenceLevel.option.low" },
    ],
  },
  {
    key: "weightOutcome",
    type: "choice",
    titleKey: "nutritionDietFollowup.steps.weightOutcome.title",
    descriptionKey: "nutritionDietFollowup.steps.weightOutcome.description",
    options: [
      { key: "excellent_loss", labelKey: "nutritionDietFollowup.steps.weightOutcome.option.excellentLoss" },
      { key: "good_loss", labelKey: "nutritionDietFollowup.steps.weightOutcome.option.goodLoss" },
      { key: "low_loss", labelKey: "nutritionDietFollowup.steps.weightOutcome.option.lowLoss" },
      { key: "unchanged", labelKey: "nutritionDietFollowup.steps.weightOutcome.option.unchanged" },
      { key: "gained", labelKey: "nutritionDietFollowup.steps.weightOutcome.option.gained" },
    ],
  },
  {
    key: "sizeChange",
    type: "choice",
    titleKey: "nutritionDietFollowup.steps.sizeChange.title",
    descriptionKey: "nutritionDietFollowup.steps.sizeChange.description",
    options: [
      { key: "noticeable_loss", labelKey: "nutritionDietFollowup.steps.sizeChange.option.noticeableLoss" },
      { key: "slight_loss", labelKey: "nutritionDietFollowup.steps.sizeChange.option.slightLoss" },
      { key: "unchanged", labelKey: "nutritionDietFollowup.steps.sizeChange.option.unchanged" },
      { key: "increased", labelKey: "nutritionDietFollowup.steps.sizeChange.option.increased" },
    ],
  },
  {
    key: "energyLevel",
    type: "choice",
    titleKey: "nutritionDietFollowup.steps.energyLevel.title",
    descriptionKey: "nutritionDietFollowup.steps.energyLevel.description",
    options: [
      { key: "very_good", labelKey: "nutritionDietFollowup.steps.energyLevel.option.veryGood" },
      { key: "good", labelKey: "nutritionDietFollowup.steps.energyLevel.option.good" },
      { key: "medium", labelKey: "nutritionDietFollowup.steps.energyLevel.option.medium" },
      { key: "low", labelKey: "nutritionDietFollowup.steps.energyLevel.option.low" },
      { key: "very_low", labelKey: "nutritionDietFollowup.steps.energyLevel.option.veryLow" },
    ],
  },
  {
    key: "satietyLevel",
    type: "choice",
    titleKey: "nutritionDietFollowup.steps.satietyLevel.title",
    descriptionKey: "nutritionDietFollowup.steps.satietyLevel.description",
    options: [
      { key: "full", labelKey: "nutritionDietFollowup.steps.satietyLevel.option.full" },
      { key: "usually_full", labelKey: "nutritionDietFollowup.steps.satietyLevel.option.usuallyFull" },
      { key: "sometimes_hungry", labelKey: "nutritionDietFollowup.steps.satietyLevel.option.sometimesHungry" },
      { key: "often_hungry", labelKey: "nutritionDietFollowup.steps.satietyLevel.option.oftenHungry" },
    ],
  },
  {
    key: "cravingsLevel",
    type: "choice",
    titleKey: "nutritionDietFollowup.steps.cravingsLevel.title",
    descriptionKey: "nutritionDietFollowup.steps.cravingsLevel.description",
    options: [
      { key: "none", labelKey: "nutritionDietFollowup.steps.cravingsLevel.option.none" },
      { key: "low", labelKey: "nutritionDietFollowup.steps.cravingsLevel.option.low" },
      { key: "medium", labelKey: "nutritionDietFollowup.steps.cravingsLevel.option.medium" },
      { key: "high", labelKey: "nutritionDietFollowup.steps.cravingsLevel.option.high" },
      { key: "very_high", labelKey: "nutritionDietFollowup.steps.cravingsLevel.option.veryHigh" },
    ],
  },
  {
    key: "sleepQuality",
    type: "choice",
    titleKey: "nutritionDietFollowup.steps.sleepQuality.title",
    descriptionKey: "nutritionDietFollowup.steps.sleepQuality.description",
    options: [
      { key: "excellent", labelKey: "nutritionDietFollowup.steps.sleepQuality.option.excellent" },
      { key: "good", labelKey: "nutritionDietFollowup.steps.sleepQuality.option.good" },
      { key: "medium", labelKey: "nutritionDietFollowup.steps.sleepQuality.option.medium" },
      { key: "poor", labelKey: "nutritionDietFollowup.steps.sleepQuality.option.poor" },
    ],
  },
  {
    key: "activityLevel",
    type: "choice",
    titleKey: "nutritionDietFollowup.steps.activityLevel.title",
    descriptionKey: "nutritionDietFollowup.steps.activityLevel.description",
    options: [
      { key: "high", labelKey: "nutritionDietFollowup.steps.activityLevel.option.high" },
      { key: "medium", labelKey: "nutritionDietFollowup.steps.activityLevel.option.medium" },
      { key: "low", labelKey: "nutritionDietFollowup.steps.activityLevel.option.low" },
      { key: "none", labelKey: "nutritionDietFollowup.steps.activityLevel.option.none" },
    ],
  },
  {
    key: "dietDifficulty",
    type: "choice",
    titleKey: "nutritionDietFollowup.steps.dietDifficulty.title",
    descriptionKey: "nutritionDietFollowup.steps.dietDifficulty.description",
    options: [
      { key: "very_easy", labelKey: "nutritionDietFollowup.steps.dietDifficulty.option.veryEasy" },
      { key: "easy", labelKey: "nutritionDietFollowup.steps.dietDifficulty.option.easy" },
      { key: "medium", labelKey: "nutritionDietFollowup.steps.dietDifficulty.option.medium" },
      { key: "hard", labelKey: "nutritionDietFollowup.steps.dietDifficulty.option.hard" },
      { key: "very_hard", labelKey: "nutritionDietFollowup.steps.dietDifficulty.option.veryHard" },
    ],
  },
  {
    key: "overallSatisfaction",
    type: "choice",
    titleKey: "nutritionDietFollowup.steps.overallSatisfaction.title",
    descriptionKey: "nutritionDietFollowup.steps.overallSatisfaction.description",
    options: [
      { key: "very_satisfied", labelKey: "nutritionDietFollowup.steps.overallSatisfaction.option.verySatisfied" },
      { key: "satisfied", labelKey: "nutritionDietFollowup.steps.overallSatisfaction.option.satisfied" },
      { key: "medium", labelKey: "nutritionDietFollowup.steps.overallSatisfaction.option.medium" },
      { key: "unsatisfied", labelKey: "nutritionDietFollowup.steps.overallSatisfaction.option.unsatisfied" },
    ],
  },
  {
    key: "newDietPreference",
    type: "choice",
    titleKey: "nutritionDietFollowup.steps.newDietPreference.title",
    descriptionKey: "nutritionDietFollowup.steps.newDietPreference.description",
    options: [
      { key: "faster", labelKey: "nutritionDietFollowup.steps.newDietPreference.option.faster" },
      { key: "balanced", labelKey: "nutritionDietFollowup.steps.newDietPreference.option.balanced" },
      { key: "easier", labelKey: "nutritionDietFollowup.steps.newDietPreference.option.easier" },
    ],
  },
  {
    key: "experiencedIssue",
    type: "choice",
    titleKey: "nutritionDietFollowup.steps.experiencedIssue.title",
    descriptionKey: "nutritionDietFollowup.steps.experiencedIssue.description",
    options: [
      { key: "weakness", labelKey: "nutritionDietFollowup.steps.experiencedIssue.option.weakness" },
      { key: "constipation", labelKey: "nutritionDietFollowup.steps.experiencedIssue.option.constipation" },
      { key: "severe_hunger", labelKey: "nutritionDietFollowup.steps.experiencedIssue.option.severeHunger" },
      { key: "low_mood", labelKey: "nutritionDietFollowup.steps.experiencedIssue.option.lowMood" },
      { key: "none", labelKey: "nutritionDietFollowup.steps.experiencedIssue.option.none" },
    ],
  },
  {
    key: "foodPreference",
    type: "choice",
    titleKey: "nutritionDietFollowup.steps.foodPreference.title",
    descriptionKey: "nutritionDietFollowup.steps.foodPreference.description",
    options: [
      { key: "simple", labelKey: "nutritionDietFollowup.steps.foodPreference.option.simple" },
      { key: "varied", labelKey: "nutritionDietFollowup.steps.foodPreference.option.varied" },
      { key: "family", labelKey: "nutritionDietFollowup.steps.foodPreference.option.family" },
      { key: "no_preference", labelKey: "nutritionDietFollowup.steps.foodPreference.option.noPreference" },
    ],
  },
  {
    key: "medicalNotes",
    type: "medicalConditions",
    titleKey: "nutritionDietFollowup.steps.medicalNotes.title",
    descriptionKey: "nutritionDietFollowup.steps.medicalNotes.description",
    helperTextKey: "nutritionDietFollowup.steps.medicalNotes.helper",
  },
];

const MIN_WEIGHT_KG = 20;
const MAX_WEIGHT_KG = 350;
const DEFAULT_WEIGHT_KG = 78;
const GRAM_STEP = 50;

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

export default function NutritionDietFollowUpPage() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/nutrition/diet-followup/:step");
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const t = useT();
  const format = useFormat();
  const { dir, isRtl } = useLocale();
  const formState = useMemo(() => getNutritionFormState(), []);
  const currentStep = Math.max(1, Math.min(FOLLOWUP_STEPS.length, Number(params?.step || "1")));
  const step = FOLLOWUP_STEPS[currentStep - 1];
  const [answers, setAnswers] = useState<Record<string, string>>(formState.repeatDietAnswers ?? {});
  const initialWeightParts = useMemo(() => parseWeightParts(formState.repeatDietWeightKg), [formState.repeatDietWeightKg]);
  const [weightKg, setWeightKg] = useState(initialWeightParts.kg);
  const [weightGrams, setWeightGrams] = useState(initialWeightParts.grams);
  const [medicalConditionItems, setMedicalConditionItems] = useState(
    ensureMedicalConditionDraft(formState.repeatDietMedicalConditionsItems, formState.repeatDietMedicalNotes),
  );

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/nutrition");
      return;
    }

    if (!formState.dietRequestMode) {
      setLocation("/nutrition/diet-type");
      return;
    }

    if (!formState.repeatDietFlowRequired) {
      setLocation(formState.dietRequestMode === "ai" ? "/nutrition/select-diet" : "/nutrition/diet-request/expert");
    }
  }, [formState.dietRequestMode, formState.repeatDietFlowRequired, isLoading, setLocation, user]);

  const nextHref = formState.dietRequestMode === "ai" ? "/nutrition/select-diet" : "/nutrition/diet-request/expert";
  const canGoBack = currentStep > 1;
  const weight = formatWeight(weightKg, weightGrams);
  const numericWeight = Number(weight);
  const isValidWeight = !Number.isNaN(numericWeight) && numericWeight >= MIN_WEIGHT_KG && numericWeight <= MAX_WEIGHT_KG;

  const persistState = (patch?: Record<string, string>) => {
    const nextAnswers = patch ? { ...answers, ...patch } : answers;
    const normalizedMedicalConditionItems = ensureMedicalConditionDraft(medicalConditionItems);
    const medicalNotesSummary = summarizeMedicalConditionItems(normalizedMedicalConditionItems) || t("nutritionDietFollowup.noMedicalConditions");
    updateNutritionFormState({
      repeatDietAnswers: nextAnswers,
      repeatDietWeightKg: weight,
      repeatDietMedicalNotes: medicalNotesSummary,
      repeatDietMedicalConditionsItems: normalizedMedicalConditionItems,
    });
    setAnswers(nextAnswers);
    return nextAnswers;
  };

  const goNext = (nextAnswers?: Record<string, string>) => {
    const payloadAnswers = nextAnswers ?? answers;

    if (currentStep < FOLLOWUP_STEPS.length) {
      setLocation(`/nutrition/diet-followup/${currentStep + 1}`);
      return;
    }

    updateNutritionFormState({
      repeatDietAnswers: payloadAnswers,
      repeatDietWeightKg: weight,
      repeatDietMedicalNotes: summarizeMedicalConditionItems(ensureMedicalConditionDraft(medicalConditionItems)) || t("nutritionDietFollowup.noMedicalConditions"),
      repeatDietMedicalConditionsItems: ensureMedicalConditionDraft(medicalConditionItems),
      repeatDietCheckinCompleted: true,
    });

    toast({
      title: t("nutritionDietFollowup.toast.savedTitle"),
      description: t("nutritionDietFollowup.toast.savedDescription"),
    });
    setLocation(nextHref);
  };

  const handleChoiceSelect = (value: string) => {
    const nextAnswers = persistState({ [step.key]: value });
    goNext(nextAnswers);
  };

  const handleManualContinue = () => {
    if (step.key === "currentWeightKg") {
      if (!isValidWeight) {
        toast({
          variant: "destructive",
          title: t("nutritionDietFollowup.toast.invalidWeightTitle"),
          description: t("nutritionDietFollowup.toast.invalidWeightDescription"),
        });
        return;
      }
    }

    persistState();
    goNext();
  };

  const setNormalizedWeightKg = (value: number) => {
    setWeightKg(Math.min(MAX_WEIGHT_KG, Math.max(MIN_WEIGHT_KG, value)));
  };

  const handleWeightKgInput = (value: string) => {
    const nextValue = normalizeDigits(value).replace(/\D/g, "").slice(0, 3);
    setNormalizedWeightKg(Number(nextValue) || MIN_WEIGHT_KG);
  };

  const setNormalizedWeightGrams = (value: number) => {
    if (value > 950) {
      setNormalizedWeightKg(weightKg + 1);
      setWeightGrams(0);
      return;
    }

    if (value < 0) {
      setNormalizedWeightKg(weightKg - 1);
      setWeightGrams(950);
      return;
    }

    setWeightGrams(value);
  };

  const handleWeightGramsInput = (value: string) => {
    const nextValue = normalizeDigits(value).replace(/\D/g, "").slice(0, 3);
    setWeightGrams(Math.min(950, Number(nextValue) || 0));
  };

  if (isLoading) {
    return (
      <div className="relative isolate min-h-screen overflow-hidden bg-[#0a1224] text-white" dir={dir}>
        <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.14),transparent_26%),linear-gradient(180deg,rgba(7,12,26,0.18),rgba(7,12,26,0.82)_42%,rgba(7,12,26,0.98)_100%)]" />
        <div className="relative z-10 flex min-h-screen items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-amber-300" />
        </div>
      </div>
    );
  }

  const Icon = step.type === "choice"
    ? currentStep === FOLLOWUP_STEPS.length
      ? CheckCircle2
      : HeartPulse
    : step.key === "currentWeightKg"
      ? Weight
      : ShieldPlus;
  const isFirstWeightStep = step.key === "currentWeightKg";
  const NextIcon = ArrowLeft;

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-[#0a1224] text-white" dir={dir}>
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.14),transparent_26%),linear-gradient(180deg,rgba(7,12,26,0.18),rgba(7,12,26,0.82)_42%,rgba(7,12,26,0.98)_100%)]" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[390px] flex-col px-5 pb-10 pt-8">
        <NutritionTopbar
          backHref={canGoBack ? `/nutrition/diet-followup/${currentStep - 1}` : "/nutrition/diet-type"}
          title={t("nutritionDietFollowup.topbarTitle")}
          description={t("nutritionDietFollowup.topbarDescription")}
          variant="hero"
        />

        <main className="flex flex-1 flex-col pt-[40px] max-[400px]:pt-9">
          <div className="mx-auto flex h-[64px] w-[64px] items-center justify-center rounded-[23px] border border-amber-300/22 bg-amber-400/12 text-amber-300 shadow-[0_24px_55px_-38px_rgba(251,191,36,0.9)] max-[400px]:h-[56px] max-[400px]:w-[56px] max-[400px]:rounded-[20px]">
            <Icon className="h-8 w-8 max-[400px]:h-7 max-[400px]:w-7" />
          </div>

          <div className="mt-6 text-center max-[400px]:mt-5">
            <h1 className="text-[25px] font-black leading-[1.45] text-white max-[400px]:text-[22px]">{t(step.titleKey)}</h1>
          </div>

          <div className="mt-7 flex items-center gap-2 max-[400px]:mt-6 max-[400px]:gap-1.5">
            {FOLLOWUP_STEPS.map((item, index) => (
              <div
                key={item.key}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-all max-[400px]:h-1",
                  index < currentStep ? "bg-amber-400" : "bg-white/10",
                )}
              />
            ))}
          </div>

          {step.type === "choice" ? (
            <div className="mt-7 grid gap-2.5 max-[400px]:mt-6">
              {step.options.map((option) => {
                const optionLabel = t(option.labelKey);

                return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => handleChoiceSelect(optionLabel)}
                  className={cn(
                    "rounded-[20px] border border-white/10 bg-white/[0.025] px-4 py-3.5 text-start text-[13px] font-bold leading-7 text-white transition hover:border-amber-300/30 hover:bg-amber-400/10 max-[400px]:rounded-[18px] max-[400px]:px-3.5 max-[400px]:py-3 max-[400px]:text-[12px] max-[400px]:leading-6",
                    answers[step.key] === optionLabel && "border-amber-300/42 bg-amber-400/12 text-amber-300",
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span>{optionLabel}</span>
                    <NextIcon className={cn("h-4 w-4 shrink-0 text-amber-300", !isRtl && "rotate-180")} />
                  </div>
                </button>
                );
              })}
            </div>
          ) : null}

          {step.type === "number" ? (
            <div className="mt-7 flex flex-1 flex-col max-[400px]:mt-6">
              <div className="grid grid-cols-2 gap-3 max-[400px]:gap-2.5" dir="ltr">
                <div className="min-w-0 space-y-2">
                  <div className="text-center text-[13px] font-black text-amber-300 max-[400px]:text-[12px]">{t("nutritionDietFollowup.weight.kilograms")}</div>
                  <div className="min-w-0 rounded-[20px] border border-white/10 bg-white/[0.025] p-2 max-[400px]:rounded-[18px] max-[400px]:p-1.5" dir={dir}>
                    <div className="grid min-w-0 grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-1.5 max-[400px]:grid-cols-[38px_minmax(0,1fr)_38px] max-[400px]:gap-1">
                      <button
                        type="button"
                        onClick={() => setNormalizedWeightKg(weightKg - 1)}
                        disabled={weightKg <= MIN_WEIGHT_KG}
                        aria-label={t("nutritionDietFollowup.weight.decreaseKilograms")}
                        className="flex h-[46px] items-center justify-center rounded-[14px] border border-white/10 bg-white/10 text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40 max-[400px]:h-[40px] max-[400px]:rounded-[12px]"
                      >
                        <Minus className="h-5 w-5 max-[400px]:h-4 max-[400px]:w-4" />
                      </button>
                      <input
                        value={format.number(weightKg)}
                        onChange={(event) => handleWeightKgInput(event.target.value)}
                        onBlur={() => setNormalizedWeightKg(weightKg)}
                        inputMode="numeric"
                        aria-label={t("nutritionDietFollowup.weight.kilogramsAria")}
                        className="min-w-0 border-none bg-transparent p-0 text-center text-[32px] font-black leading-none text-white outline-none max-[400px]:text-[26px]"
                        dir="ltr"
                      />
                      <button
                        type="button"
                        onClick={() => setNormalizedWeightKg(weightKg + 1)}
                        disabled={weightKg >= MAX_WEIGHT_KG}
                        aria-label={t("nutritionDietFollowup.weight.increaseKilograms")}
                        className="flex h-[46px] items-center justify-center rounded-[14px] border border-white/10 bg-white/10 text-amber-300 transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40 max-[400px]:h-[40px] max-[400px]:rounded-[12px]"
                      >
                        <Plus className="h-5 w-5 max-[400px]:h-4 max-[400px]:w-4" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="min-w-0 space-y-2">
                  <div className="text-center text-[13px] font-black text-slate-400 max-[400px]:text-[12px]">{t("nutritionDietFollowup.weight.grams")}</div>
                  <div className="min-w-0 rounded-[20px] border border-white/10 bg-white/[0.025] p-2 max-[400px]:rounded-[18px] max-[400px]:p-1.5" dir={dir}>
                    <div className="grid min-w-0 grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-1.5 max-[400px]:grid-cols-[38px_minmax(0,1fr)_38px] max-[400px]:gap-1">
                      <button
                        type="button"
                        onClick={() => setNormalizedWeightGrams(weightGrams - GRAM_STEP)}
                        disabled={weightKg <= MIN_WEIGHT_KG && weightGrams <= 0}
                        aria-label={t("nutritionDietFollowup.weight.decreaseGrams")}
                        className="flex h-[46px] items-center justify-center rounded-[14px] border border-white/10 bg-white/10 text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40 max-[400px]:h-[40px] max-[400px]:rounded-[12px]"
                      >
                        <Minus className="h-5 w-5 max-[400px]:h-4 max-[400px]:w-4" />
                      </button>
                      <input
                        value={format.number(weightGrams)}
                        onChange={(event) => handleWeightGramsInput(event.target.value)}
                        onBlur={() => setNormalizedWeightGrams(weightGrams)}
                        inputMode="numeric"
                        aria-label={t("nutritionDietFollowup.weight.gramsAria")}
                        className="min-w-0 border-none bg-transparent p-0 text-center text-[30px] font-black leading-none text-white outline-none max-[400px]:text-[25px]"
                        dir="ltr"
                      />
                      <button
                        type="button"
                        onClick={() => setNormalizedWeightGrams(weightGrams + GRAM_STEP)}
                        disabled={weightKg >= MAX_WEIGHT_KG && weightGrams >= 0}
                        aria-label={t("nutritionDietFollowup.weight.increaseGrams")}
                        className="flex h-[46px] items-center justify-center rounded-[14px] border border-white/10 bg-white/10 text-amber-300 transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40 max-[400px]:h-[40px] max-[400px]:rounded-[12px]"
                      >
                        <Plus className="h-5 w-5 max-[400px]:h-4 max-[400px]:w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 text-center text-[14px] font-black leading-7 text-slate-400 max-[400px]:text-[12px] max-[400px]:leading-6">
                {t("nutritionDietFollowup.weight.finalValue", { value: format.number(numericWeight) })}
              </div>

              <Button
                type="button"
                onClick={handleManualContinue}
                disabled={!isValidWeight}
                className="mt-auto h-[56px] w-full shrink-0 rounded-[18px] bg-[linear-gradient(135deg,#f8c45a,#f59e0b)] text-[16px] font-black text-slate-950 shadow-[0_22px_55px_-34px_rgba(251,191,36,0.95)] hover:opacity-95 disabled:opacity-55 max-[400px]:h-[50px] max-[400px]:text-[14px]"
              >
                {isFirstWeightStep ? t("nutritionDietFollowup.saveAndContinue") : t("common.continue")}
                <NextIcon className={cn("h-5 w-5", isRtl ? "ms-2" : "me-2 rotate-180")} />
              </Button>
            </div>
          ) : null}

          {step.type === "medicalConditions" ? (
            <div className="mt-7 flex flex-1 flex-col max-[400px]:mt-6">
              <div className="rounded-[26px] border border-white/10 bg-white/[0.025] p-[18px] max-[400px]:rounded-[23px] max-[400px]:p-4">
                <MedicalConditionsEditor
                  items={medicalConditionItems}
                  onChange={setMedicalConditionItems}
                  accentClassName="bg-amber-400/12 text-amber-300"
                  usePersianDatePicker
                  variant="membership"
                />
              </div>

              <Button
                type="button"
                onClick={handleManualContinue}
                className="mt-auto h-[56px] w-full shrink-0 rounded-[18px] bg-[linear-gradient(135deg,#f8c45a,#f59e0b)] text-[16px] font-black text-slate-950 shadow-[0_22px_55px_-34px_rgba(251,191,36,0.95)] hover:opacity-95 max-[400px]:h-[50px] max-[400px]:text-[14px]"
              >
                {t("nutritionDietFollowup.saveAndContinue")}
                <NextIcon className={cn("h-5 w-5", isRtl ? "ms-2" : "me-2 rotate-180")} />
              </Button>
            </div>
          ) : null}

        </main>
      </div>
    </div>
  );
}
