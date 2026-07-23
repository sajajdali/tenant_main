import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowLeft, ArrowRight, CalendarDays, Equal, Mars, Pill, Ruler, ShieldAlert, Target, Venus, Weight, ArrowDownCircle, ArrowUpCircle, Ban } from "lucide-react";
import { useLocation, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MedicalConditionsEditor } from "@/nutrition/components/medical-conditions-editor";
import { ensureMedicalConditionDraft, summarizeMedicalConditionItems } from "@/nutrition/lib/medical-conditions";
import { normalizeDigits } from "@/lib/normalize";
import { cn } from "@/lib/utils";
import { toGregorianFromJalali, toJalaliFromGregorian } from "@/nutrition/lib/jalali-date";
import { calculateNutritionWeightGoals } from "@/nutrition/lib/nutrition-weight-goals";
import {
  getPanelNutritionPrescribeState,
  PANEL_PRESCRIBE_CORE_STEPS,
  updatePanelNutritionPrescribeState,
} from "@/nutrition/lib/panel-nutrition-prescribe-state";
import { useFormat, useLocale, useT } from "@/i18n/locale";
import type { MessageKey } from "@/i18n/messages";

const STEP_META: Record<string, { titleKey: MessageKey; descriptionKey: MessageKey; backHref: string; nextHref: string }> = {
  goal: { titleKey: "panelNutritionPrescribeStep.step.goal.title", descriptionKey: "panelNutritionPrescribeStep.step.goal.description", backHref: "/panel/nutrition/prescribe/user", nextHref: "/panel/nutrition/prescribe/gender" },
  gender: { titleKey: "panelNutritionPrescribeStep.step.gender.title", descriptionKey: "panelNutritionPrescribeStep.step.gender.description", backHref: "/panel/nutrition/prescribe/goal", nextHref: "/panel/nutrition/prescribe/activity" },
  activity: { titleKey: "panelNutritionPrescribeStep.step.activity.title", descriptionKey: "panelNutritionPrescribeStep.step.activity.description", backHref: "/panel/nutrition/prescribe/gender", nextHref: "/panel/nutrition/prescribe/birth-date" },
  "birth-date": { titleKey: "panelNutritionPrescribeStep.step.birthDate.title", descriptionKey: "panelNutritionPrescribeStep.step.birthDate.description", backHref: "/panel/nutrition/prescribe/activity", nextHref: "/panel/nutrition/prescribe/height" },
  height: { titleKey: "panelNutritionPrescribeStep.step.height.title", descriptionKey: "panelNutritionPrescribeStep.step.height.description", backHref: "/panel/nutrition/prescribe/birth-date", nextHref: "/panel/nutrition/prescribe/weight" },
  weight: { titleKey: "panelNutritionPrescribeStep.step.weight.title", descriptionKey: "panelNutritionPrescribeStep.step.weight.description", backHref: "/panel/nutrition/prescribe/height", nextHref: "/panel/nutrition/prescribe/target-weight" },
  "target-weight": { titleKey: "panelNutritionPrescribeStep.step.targetWeight.title", descriptionKey: "panelNutritionPrescribeStep.step.targetWeight.description", backHref: "/panel/nutrition/prescribe/weight", nextHref: "/panel/nutrition/prescribe/weekly-rate" },
  "weekly-rate": { titleKey: "panelNutritionPrescribeStep.step.weeklyRate.title", descriptionKey: "panelNutritionPrescribeStep.step.weeklyRate.description", backHref: "/panel/nutrition/prescribe/target-weight", nextHref: "/panel/nutrition/prescribe/medical-conditions" },
  "medical-conditions": { titleKey: "panelNutritionPrescribeStep.step.medicalConditions.title", descriptionKey: "panelNutritionPrescribeStep.step.medicalConditions.description", backHref: "/panel/nutrition/prescribe/weekly-rate", nextHref: "/panel/nutrition/prescribe/medications-and-supplements" },
  "medications-and-supplements": { titleKey: "panelNutritionPrescribeStep.step.medications.title", descriptionKey: "panelNutritionPrescribeStep.step.medications.description", backHref: "/panel/nutrition/prescribe/medical-conditions", nextHref: "/panel/nutrition/prescribe/allergies" },
  allergies: { titleKey: "panelNutritionPrescribeStep.step.allergies.title", descriptionKey: "panelNutritionPrescribeStep.step.allergies.description", backHref: "/panel/nutrition/prescribe/medications-and-supplements", nextHref: "/panel/nutrition/prescribe/disliked-foods" },
  "disliked-foods": { titleKey: "panelNutritionPrescribeStep.step.dislikedFoods.title", descriptionKey: "panelNutritionPrescribeStep.step.dislikedFoods.description", backHref: "/panel/nutrition/prescribe/allergies", nextHref: "/panel/nutrition/prescribe/mindset/1" },
};

const GOAL_OPTIONS = [
  { value: "lose-weight", labelKey: "panelNutritionPrescribeStep.goal.loseWeight", descriptionKey: "panelNutritionPrescribeStep.goal.loseWeightDescription", icon: ArrowDownCircle },
  { value: "gain-weight", labelKey: "panelNutritionPrescribeStep.goal.gainWeight", descriptionKey: "panelNutritionPrescribeStep.goal.gainWeightDescription", icon: ArrowUpCircle },
  { value: "maintain-weight", labelKey: "panelNutritionPrescribeStep.goal.maintainWeight", descriptionKey: "panelNutritionPrescribeStep.goal.maintainWeightDescription", icon: Equal },
] as const;

const GENDER_OPTIONS = [
  { value: "female", labelKey: "panelNutritionPrescribeStep.gender.female", icon: Venus },
  { value: "male", labelKey: "panelNutritionPrescribeStep.gender.male", icon: Mars },
] as const;

const ACTIVITY_OPTIONS = [
  { value: "very-low", labelKey: "panelNutritionPrescribeStep.activity.veryLow" },
  { value: "medium", labelKey: "panelNutritionPrescribeStep.activity.medium" },
  { value: "high", labelKey: "panelNutritionPrescribeStep.activity.high" },
  { value: "intense", labelKey: "panelNutritionPrescribeStep.activity.intense" },
] as const;

const ATHLETE_OPTIONS = [
  { value: "athlete", labelKey: "panelNutritionPrescribeStep.athlete.athlete" },
  { value: "non-athlete", labelKey: "panelNutritionPrescribeStep.athlete.nonAthlete" },
] as const;

const WEEKLY_RATE_OPTIONS = [0.5, 1, 1.5] as const;
const PERSIAN_YEARS = Array.from({ length: 90 }, (_, index) => 1405 - index);
const GREGORIAN_YEARS = Array.from({ length: 90 }, (_, index) => new Date().getFullYear() - index);

function normalizeWeightInput(value: string) {
  const normalized = normalizeDigits(value).replace(/[^\d.]/g, "");
  const parts = normalized.split(".");

  if (parts.length === 1) {
    return parts[0].slice(0, 3);
  }

  return `${parts[0].slice(0, 3)}.${parts.slice(1).join("").slice(0, 2)}`;
}

const getDaysInMonth = (month: number) => (month <= 6 ? 31 : month <= 11 ? 30 : 29);
const getGregorianDaysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();

export default function PanelNutritionPrescribeStepPage() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/panel/nutrition/prescribe/:step");
  const t = useT();
  const format = useFormat();
  const { calendar, dir, isRtl } = useLocale();
  const usesJalaliCalendar = calendar === "jalali";
  const search = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const isEditMode = search.get("edit") === "1";
  const stepKey = String(params?.step ?? "");
  const meta = STEP_META[stepKey];
  const state = useMemo(() => getPanelNutritionPrescribeState(), []);
  const initialRecommendation =
    state.heightCm && state.weightKg && state.gender && state.dietGoal
      ? calculateNutritionWeightGoals({
          heightCm: state.heightCm,
          currentWeightKg: Number(state.weightKg),
          dietGoal: state.dietGoal,
          gender: state.gender,
        })
      : null;

  const initialBirth = useMemo(() => {
    if (!state.birthDate) {
      return usesJalaliCalendar ? { year: 1367, month: 9, day: 10 } : { year: 1990, month: 9, day: 10 };
    }
    const [gy, gm, gd] = String(state.birthDate).split("-").map(Number);
    if (!gy || !gm || !gd) {
      return usesJalaliCalendar ? { year: 1367, month: 9, day: 10 } : { year: 1990, month: 9, day: 10 };
    }
    if (!usesJalaliCalendar) {
      return { year: gy, month: gm, day: gd };
    }
    const jalali = toJalaliFromGregorian(gy, gm, gd);
    return { year: jalali.jy, month: jalali.jm, day: jalali.jd };
  }, [state.birthDate, usesJalaliCalendar]);

  const [goal, setGoal] = useState(state.dietGoal ?? "lose-weight");
  const [gender, setGender] = useState(state.gender ?? "female");
  const [athleteMode, setAthleteMode] = useState(state.athleteMode ?? "non-athlete");
  const [activityLevel, setActivityLevel] = useState(state.activityLevel ?? "medium");
  const [birthYear, setBirthYear] = useState(initialBirth.year);
  const [birthMonth, setBirthMonth] = useState(initialBirth.month);
  const [birthDay, setBirthDay] = useState(initialBirth.day);
  const [height, setHeight] = useState(state.heightCm ? String(state.heightCm) : "");
  const [weight, setWeight] = useState(state.weightKg ?? "");
  const [targetWeight, setTargetWeight] = useState(
    state.targetWeightKg ?? (initialRecommendation ? String(initialRecommendation.recommendedTargetWeightKg) : ""),
  );
  const [weeklyRate, setWeeklyRate] = useState(state.weeklyWeightChangeKg ?? 1);
  const [medicalConditionItems, setMedicalConditionItems] = useState(ensureMedicalConditionDraft(state.medicalConditionsItems, state.medicalConditions));
  const [medicationsAndSupplements, setMedicationsAndSupplements] = useState(state.medicationsAndSupplements ?? "");
  const [allergies, setAllergies] = useState(state.foodAllergies ?? "");
  const [dislikedFoods, setDislikedFoods] = useState(state.dislikedFoods ?? "");

  useEffect(() => {
    if (!meta) {
      setLocation("/panel/nutrition/prescribe");
    }
  }, [meta, setLocation]);

  if (!meta) {
    return null;
  }

  const yearOptions = usesJalaliCalendar ? PERSIAN_YEARS : GREGORIAN_YEARS;
  const daysInBirthMonth = usesJalaliCalendar ? getDaysInMonth(birthMonth) : getGregorianDaysInMonth(birthYear, birthMonth);
  const availableDays = Array.from({ length: daysInBirthMonth }, (_, index) => index + 1);
  const recommendation =
    height && weight
      ? calculateNutritionWeightGoals({
          heightCm: Number(height),
          currentWeightKg: Number(weight),
          dietGoal: goal,
          gender,
        })
      : null;

  useEffect(() => {
    if (stepKey !== "target-weight" || !recommendation || targetWeight.trim() !== "") {
      return;
    }

    setTargetWeight(String(recommendation.recommendedTargetWeightKg));
  }, [recommendation, stepKey, targetWeight]);

  const stepIndex = PANEL_PRESCRIBE_CORE_STEPS.indexOf(stepKey as never) + 1;
  const canContinue = (() => {
    switch (stepKey) {
      case "goal":
        return Boolean(goal);
      case "gender":
        return Boolean(gender);
      case "activity":
        return Boolean(athleteMode && activityLevel);
      case "birth-date":
        return Boolean(birthYear && birthMonth && birthDay);
      case "height":
        return Number(height) >= 80 && Number(height) <= 250;
      case "weight":
        return Number(weight) >= 20 && Number(weight) <= 350;
      case "target-weight":
        return Number(targetWeight) >= 20 && Number(targetWeight) <= 350;
      case "weekly-rate":
        return Boolean(weeklyRate);
      default:
        return true;
    }
  })();

  const handleContinue = () => {
    switch (stepKey) {
      case "goal":
        updatePanelNutritionPrescribeState({ dietGoal: goal });
        break;
      case "gender":
        updatePanelNutritionPrescribeState({ gender });
        break;
      case "activity":
        updatePanelNutritionPrescribeState({ athleteMode, activityLevel });
        break;
      case "birth-date": {
        const { gy, gm, gd } = usesJalaliCalendar
          ? toGregorianFromJalali(birthYear, birthMonth, birthDay)
          : { gy: birthYear, gm: birthMonth, gd: birthDay };
        updatePanelNutritionPrescribeState({ birthDate: `${gy}-${String(gm).padStart(2, "0")}-${String(gd).padStart(2, "0")}` });
        break;
      }
      case "height":
        updatePanelNutritionPrescribeState({ heightCm: Number(height) });
        break;
      case "weight":
        updatePanelNutritionPrescribeState({ weightKg: weight });
        break;
      case "target-weight":
        updatePanelNutritionPrescribeState({ targetWeightKg: targetWeight });
        break;
      case "weekly-rate":
        updatePanelNutritionPrescribeState({ weeklyWeightChangeKg: weeklyRate });
        break;
      case "medical-conditions":
        updatePanelNutritionPrescribeState({
          medicalConditionsItems: ensureMedicalConditionDraft(medicalConditionItems),
          medicalConditions: summarizeMedicalConditionItems(medicalConditionItems),
        });
        break;
      case "medications-and-supplements":
        updatePanelNutritionPrescribeState({ medicationsAndSupplements: medicationsAndSupplements.trim() });
        break;
      case "allergies":
        updatePanelNutritionPrescribeState({ foodAllergies: allergies.trim() });
        break;
      case "disliked-foods":
        updatePanelNutritionPrescribeState({ dislikedFoods: dislikedFoods.trim() });
        break;
      default:
        break;
    }
    setLocation(isEditMode ? "/panel/nutrition/prescribe/review" : meta.nextHref);
  };

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-[#06131d] pb-24 text-white" dir={dir}>
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.16),transparent_22%),linear-gradient(180deg,rgba(6,19,29,0.97),rgba(4,10,17,1))]" />
      <header className="sticky top-0 z-20 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="space-y-1">
            <h1 className="text-xl font-bold">{t("panelNutritionPrescribeStep.headerTitle")}</h1>
          </div>
          <Button
            variant="outline"
            size="icon"
            title={t("common.back")}
            className="h-10 w-10 rounded-2xl border-border bg-background/40 hover:bg-background/70"
            onClick={() => setLocation(isEditMode ? "/panel/nutrition/prescribe/review" : meta.backHref)}
          >
            <ArrowRight className={`h-5 w-5 ${isRtl ? "rotate-180" : ""}`} />
          </Button>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-md space-y-5 px-4 py-6">
        <section className="rounded-[32px] border border-white/10 bg-[linear-gradient(160deg,rgba(18,34,49,0.95),rgba(11,22,35,0.9))] p-5">
          <div className="space-y-2 text-center">
            <div className="text-sm font-bold text-amber-300">{t("panelNutritionPrescribeStep.progress", { current: format.number(stepIndex), total: format.number(PANEL_PRESCRIBE_CORE_STEPS.length) })}</div>
            <h1 className="text-3xl font-black">{t(meta.titleKey)}</h1>
            <p className="text-sm leading-7 text-slate-300">{t(meta.descriptionKey)}</p>
          </div>

          {stepKey === "goal" ? (
            <div className="mt-5 space-y-3">
              {GOAL_OPTIONS.map((option) => {
                const Icon = option.icon;
                return (
                  <button key={option.value} type="button" onClick={() => setGoal(option.value)} className={cn("flex w-full items-center justify-between rounded-[24px] border px-4 py-4 text-start", goal === option.value ? "border-amber-300/40 bg-amber-400/10" : "border-white/10 bg-white/[0.04]")}>
                    <div>
                      <div className="font-black">{t(option.labelKey)}</div>
                      <div className="mt-1 text-xs text-slate-300">{t(option.descriptionKey)}</div>
                    </div>
                    <Icon className="h-6 w-6 text-amber-300" />
                  </button>
                );
              })}
            </div>
          ) : null}

          {stepKey === "gender" ? (
            <div className="mt-5 grid grid-cols-2 gap-3">
              {GENDER_OPTIONS.map((option) => {
                const Icon = option.icon;
                return (
                  <button key={option.value} type="button" onClick={() => setGender(option.value)} className={cn("rounded-[24px] border p-4 text-start", gender === option.value ? "border-amber-300/40 bg-amber-400/10" : "border-white/10 bg-white/[0.04]")}>
                    <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-white/5 text-amber-300"><Icon className="h-7 w-7" /></div>
                    <div className="mt-4 text-2xl font-black">{t(option.labelKey)}</div>
                  </button>
                );
              })}
            </div>
          ) : null}

          {stepKey === "activity" ? (
            <div className="mt-5 space-y-4">
              <div className="grid gap-3">
                {ATHLETE_OPTIONS.map((option) => (
                  <button key={option.value} type="button" onClick={() => setAthleteMode(option.value)} className={cn("rounded-[22px] border px-4 py-4 text-start", athleteMode === option.value ? "border-amber-300/40 bg-amber-400/10" : "border-white/10 bg-white/[0.04]")}>
                    <div className="font-black">{t(option.labelKey)}</div>
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {ACTIVITY_OPTIONS.map((option) => (
                  <button key={option.value} type="button" onClick={() => setActivityLevel(option.value)} className={cn("rounded-[22px] border px-4 py-4 text-start", activityLevel === option.value ? "border-amber-300/40 bg-amber-400/10" : "border-white/10 bg-white/[0.04]")}>
                    <div className="flex items-center gap-2 font-black"><Activity className="h-4 w-4 text-amber-300" />{t(option.labelKey)}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {stepKey === "birth-date" ? (
            <div className="mt-5 grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <div className="text-center text-xs text-slate-400">{t("panelNutritionPrescribeStep.birthDate.year")}</div>
                <Select value={String(birthYear)} onValueChange={(value) => setBirthYear(Number(value))}>
                  <SelectTrigger className="h-14 rounded-[20px] border-white/10 bg-white/5 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent dir={dir}>{yearOptions.map((year) => <SelectItem key={year} value={String(year)}>{format.number(year)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="text-center text-xs text-slate-400">{t("panelNutritionPrescribeStep.birthDate.month")}</div>
                <Select value={String(birthMonth)} onValueChange={(value) => setBirthMonth(Number(value))}>
                  <SelectTrigger className="h-14 rounded-[20px] border-white/10 bg-white/5 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent dir={dir}>
                    {Array.from({ length: 12 }, (_, index) => (
                      <SelectItem key={index + 1} value={String(index + 1)}>
                        {t(`panelNutritionPrescribeStep.birthDate.${usesJalaliCalendar ? "jalaliMonth" : "gregorianMonth"}.${index + 1}` as MessageKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="text-center text-xs text-slate-400">{t("panelNutritionPrescribeStep.birthDate.day")}</div>
                <Select value={String(Math.min(birthDay, daysInBirthMonth))} onValueChange={(value) => setBirthDay(Number(value))}>
                  <SelectTrigger className="h-14 rounded-[20px] border-white/10 bg-white/5 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent dir={dir}>{availableDays.map((day) => <SelectItem key={day} value={String(day)}>{format.number(day)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          ) : null}

          {stepKey === "height" ? (
            <div className="mt-5 rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
              <label className="text-sm font-bold text-white">{t("panelNutritionPrescribeStep.height.label")}</label>
              <div className="relative mt-2" dir="ltr">
                <Input value={height} onChange={(event) => setHeight(normalizeDigits(event.target.value).replace(/\D/g, "").slice(0, 3))} className="h-16 rounded-[22px] border-white/10 bg-white/5 pe-16 ps-11 text-start text-2xl font-black text-white" dir="ltr" />
                <div className="pointer-events-none absolute inset-y-0 end-4 flex items-center text-sm font-bold text-slate-400">{t("panelNutritionPrescribeStep.unit.cm")}</div>
                <Ruler className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-300" />
              </div>
            </div>
          ) : null}

          {stepKey === "weight" ? (
            <div className="mt-5 rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
              <label className="text-sm font-bold text-white">{t("panelNutritionPrescribeStep.weight.label")}</label>
              <div className="relative mt-2" dir="ltr">
                <Input value={weight} onChange={(event) => setWeight(normalizeDigits(event.target.value).replace(/[^\d.]/g, "").slice(0, 6))} className="h-16 rounded-[22px] border-white/10 bg-white/5 pe-16 ps-11 text-start text-2xl font-black text-white" dir="ltr" />
                <div className="pointer-events-none absolute inset-y-0 end-4 flex items-center text-sm font-bold text-slate-400">{t("panelNutritionPrescribeStep.unit.kg")}</div>
                <Weight className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-300" />
              </div>
            </div>
          ) : null}

          {stepKey === "target-weight" ? (
            <div className="mt-5 space-y-4">
              {recommendation ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4 text-center">
                    <div className="text-xs text-slate-400">{t("panelNutritionPrescribeStep.targetWeight.ideal")}</div>
                    <div className="mt-2 text-xl font-black text-amber-300">{t("panelNutritionPrescribeStep.kgValue", { value: format.number(recommendation.idealWeightKg) })}</div>
                  </div>
                  <div className="rounded-[22px] border border-emerald-300/20 bg-emerald-300/10 p-4 text-center">
                    <div className="text-xs text-emerald-100/80">{t("panelNutritionPrescribeStep.targetWeight.healthy")}</div>
                    <div className="mt-2 text-xl font-black text-emerald-300">{t("panelNutritionPrescribeStep.kgValue", { value: format.number(recommendation.recommendedTargetWeightKg) })}</div>
                  </div>
                </div>
              ) : null}
              <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                <label className="text-sm font-bold text-white">{t("panelNutritionPrescribeStep.targetWeight.label")}</label>
                <div className="relative mt-2" dir="ltr">
                  <Input value={targetWeight} onChange={(event) => setTargetWeight(normalizeWeightInput(event.target.value))} className="h-16 rounded-[22px] border-white/10 bg-white/5 pe-16 ps-11 text-start text-2xl font-black text-white" dir="ltr" />
                  <div className="pointer-events-none absolute inset-y-0 end-4 flex items-center text-sm font-bold text-slate-400">{t("panelNutritionPrescribeStep.unit.kg")}</div>
                  <Target className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-300" />
                </div>
                {recommendation ? (
                  <div className="mt-3 text-xs leading-6 text-slate-300">
                    {t("panelNutritionPrescribeStep.targetWeight.note")}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {stepKey === "weekly-rate" ? (
            <div className="mt-5 grid grid-cols-3 gap-3">
              {WEEKLY_RATE_OPTIONS.map((option) => (
                <button key={option} type="button" onClick={() => setWeeklyRate(option)} className={cn("rounded-[20px] border px-3 py-4 text-sm font-black", weeklyRate === option ? "border-amber-300/40 bg-amber-400/10 text-amber-300" : "border-white/10 bg-white/[0.04] text-white")}>
                  {t("panelNutritionPrescribeStep.weeklyRate.option", { value: format.number(option) })}
                </button>
              ))}
            </div>
          ) : null}

          {stepKey === "medical-conditions" ? (
            <div className="mt-5">
              <MedicalConditionsEditor items={medicalConditionItems} onChange={setMedicalConditionItems} />
            </div>
          ) : null}

          {stepKey === "medications-and-supplements" ? (
            <div className="mt-5 rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
              <label className="flex items-center gap-2 text-sm font-bold text-white"><Pill className="h-4 w-4 text-emerald-300" />{t("panelNutritionPrescribeStep.medications.label")}</label>
              <Textarea value={medicationsAndSupplements} onChange={(event) => setMedicationsAndSupplements(event.target.value)} className="mt-3 min-h-[180px] rounded-[22px] border-white/10 bg-white/5 text-white" />
            </div>
          ) : null}

          {stepKey === "allergies" ? (
            <div className="mt-5 rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
              <label className="flex items-center gap-2 text-sm font-bold text-white"><ShieldAlert className="h-4 w-4 text-rose-300" />{t("panelNutritionPrescribeStep.allergies.label")}</label>
              <Textarea value={allergies} onChange={(event) => setAllergies(event.target.value)} className="mt-3 min-h-[180px] rounded-[22px] border-white/10 bg-white/5 text-white" />
            </div>
          ) : null}

          {stepKey === "disliked-foods" ? (
            <div className="mt-5 rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
              <label className="flex items-center gap-2 text-sm font-bold text-white"><Ban className="h-4 w-4 text-amber-300" />{t("panelNutritionPrescribeStep.dislikedFoods.label")}</label>
              <Textarea value={dislikedFoods} onChange={(event) => setDislikedFoods(event.target.value)} className="mt-3 min-h-[180px] rounded-[22px] border-white/10 bg-white/5 text-white" />
            </div>
          ) : null}

          <Button type="button" disabled={!canContinue} onClick={handleContinue} className="mt-5 h-14 w-full rounded-[18px] bg-amber-400 font-black text-slate-950">
            {isEditMode ? t("panelNutritionPrescribeStep.saveAndBack") : t("common.continue")}
            <ArrowLeft className={`ms-2 h-5 w-5 ${isRtl ? "" : "rotate-180"}`} />
          </Button>
        </section>
      </main>
    </div>
  );
}
