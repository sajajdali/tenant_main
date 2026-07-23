import { ArrowLeft, Ban, CalendarDays, ClipboardPlus, Dumbbell, Flag, Pencil, Pill, Ruler, Scale, ShieldAlert, Target, UserRound } from "lucide-react";
import { useMemo } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useFormat, useLocale, useT } from "@/i18n/locale";
import { cn } from "@/lib/utils";
import { MedicalConditionsSummary } from "@/nutrition/components/medical-conditions-summary";
import { NutritionTopbar } from "@/nutrition/components/nutrition-topbar";
import {
  getPanelNutritionPrescribeState,
  PANEL_PRESCRIBE_QUESTION_STEPS,
} from "@/nutrition/lib/panel-nutrition-prescribe-state";

function formatValue(value: string | number | null | undefined, formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string) {
  if (value === undefined || value === null || value === "") return "—";
  const numeric = Number(value);

  return Number.isFinite(numeric) ? formatNumber(numeric, { maximumFractionDigits: 1 }) : String(value);
}

function formatBirthDate(value: string | null | undefined, formatDate: (value: string, options?: Intl.DateTimeFormatOptions) => string, formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string) {
  if (!value) {
    return "—";
  }

  const [yearPart, monthPart, dayPart] = value.split("-");
  const numericYear = Number(yearPart);
  const numericMonth = Number(monthPart);
  const numericDay = Number(dayPart);

  if (
    Number.isNaN(numericYear)
    || Number.isNaN(numericMonth)
    || Number.isNaN(numericDay)
    || !monthPart
    || !dayPart
  ) {
    return "—";
  }

  if (numericYear > 1200 && numericYear < 1700) {
    return `${formatNumber(numericYear, { useGrouping: false })}/${formatNumber(numericMonth, { useGrouping: false })}/${formatNumber(numericDay, { useGrouping: false })}`;
  }

  return formatDate(value, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
}

function InfoRow({ icon, label, value, href }: { icon: React.ReactNode; label: string; value: React.ReactNode; href: string }) {
  const [, setLocation] = useLocation();

  return (
    <div className="flex items-start justify-between gap-3 rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-start gap-3">
        <div className="mt-1 flex h-11 w-11 items-center justify-center rounded-[16px] bg-amber-400/12 text-amber-300">{icon}</div>
        <div>
          <div className="text-xs font-bold text-slate-400">{label}</div>
          <div className="mt-2 text-base font-black text-white">{value}</div>
        </div>
      </div>
      <button type="button" onClick={() => setLocation(href)} className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-white/10 bg-white/5 text-slate-300">
        <Pencil className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function PanelNutritionPrescribeReviewPage() {
  const [, setLocation] = useLocation();
  const t = useT();
  const format = useFormat();
  const { dir, isRtl } = useLocale();
  const state = useMemo(() => getPanelNutritionPrescribeState(), []);
  const backToUserProfileHref = state.mobile?.trim()
    ? `/panel/nutrition/prescribe/users/${encodeURIComponent(state.mobile.trim())}`
    : "/panel/nutrition/prescribe";
  const hasSelectedPackage = Boolean(state.selectedNutritionPackageId);
  const primaryActionHref = hasSelectedPackage
    ? backToUserProfileHref
    : "/panel/nutrition/prescribe/packages";
  const primaryActionLabel = hasSelectedPackage ? t("panelNutritionPrescribeReview.back") : t("panelNutritionPrescribeReview.choosePackage");
  const emptyText = "—";
  const missingText = t("panelNutritionPrescribeReview.notProvided");
  const formatMetric = (value?: string | number | null) => formatValue(value, format.number);
  const goalLabel = state.dietGoal === "lose-weight"
    ? t("panelNutritionPrescribeReview.goal.loseWeight")
    : state.dietGoal === "gain-weight"
      ? t("panelNutritionPrescribeReview.goal.gainWeight")
      : state.dietGoal === "maintain-weight"
        ? t("panelNutritionPrescribeReview.goal.maintainWeight")
        : emptyText;
  const genderLabel = state.gender === "female"
    ? t("panelNutritionPrescribeReview.gender.female")
    : state.gender === "male"
      ? t("panelNutritionPrescribeReview.gender.male")
      : emptyText;
  const athleteLabel = state.athleteMode === "athlete"
    ? t("panelNutritionPrescribeReview.athlete.athlete")
    : state.athleteMode === "non-athlete"
      ? t("panelNutritionPrescribeReview.athlete.nonAthlete")
      : emptyText;

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-[#06131d] px-4 py-8 pb-24 text-white" dir={dir}>
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.16),transparent_22%),linear-gradient(180deg,rgba(6,19,29,0.97),rgba(4,10,17,1))]" />
      <div className="relative z-10 mx-auto max-w-md space-y-5">
        <NutritionTopbar
          backHref="/panel/nutrition/prescribe/mindset/5"
          title={t("panelNutritionPrescribeReview.topbarTitle")}
          description={t("panelNutritionPrescribeReview.topbarDescription")}
        />

        <section className="rounded-[32px] border border-white/10 bg-[linear-gradient(160deg,rgba(18,34,49,0.95),rgba(11,22,35,0.9))] p-5">
          <div className="space-y-2 text-center">
            <div className="text-sm font-bold text-amber-300">{t("panelNutritionPrescribeReview.eyebrow")}</div>
            <h1 className="text-3xl font-black">{t("panelNutritionPrescribeReview.title")}</h1>
            <p className="text-sm leading-7 text-slate-300">{t("panelNutritionPrescribeReview.description")}</p>
          </div>

          <div className="mt-5 grid gap-3">
            <InfoRow icon={<UserRound className="h-5 w-5" />} label={t("panelNutritionPrescribeReview.label.user")} value={state.fullName?.trim() || emptyText} href="/panel/nutrition/prescribe/user?edit=1" />
            <InfoRow icon={<Flag className="h-5 w-5" />} label={t("panelNutritionPrescribeReview.label.goal")} value={goalLabel} href="/panel/nutrition/prescribe/goal?edit=1" />
            <InfoRow icon={<UserRound className="h-5 w-5" />} label={t("panelNutritionPrescribeReview.label.gender")} value={genderLabel} href="/panel/nutrition/prescribe/gender?edit=1" />
            <InfoRow icon={<Dumbbell className="h-5 w-5" />} label={t("panelNutritionPrescribeReview.label.athlete")} value={athleteLabel} href="/panel/nutrition/prescribe/activity?edit=1" />
            <InfoRow icon={<CalendarDays className="h-5 w-5" />} label={t("panelNutritionPrescribeReview.label.birthDate")} value={formatBirthDate(state.birthDate, format.date, format.number)} href="/panel/nutrition/prescribe/birth-date?edit=1" />
            <InfoRow icon={<Ruler className="h-5 w-5" />} label={t("panelNutritionPrescribeReview.label.height")} value={state.heightCm ? t("panelNutritionPrescribeReview.cmValue", { value: formatMetric(state.heightCm) }) : emptyText} href="/panel/nutrition/prescribe/height?edit=1" />
            <InfoRow icon={<Scale className="h-5 w-5" />} label={t("panelNutritionPrescribeReview.label.currentWeight")} value={state.weightKg ? t("panelNutritionPrescribeReview.kgValue", { value: formatMetric(state.weightKg) }) : emptyText} href="/panel/nutrition/prescribe/weight?edit=1" />
            <InfoRow icon={<Target className="h-5 w-5" />} label={t("panelNutritionPrescribeReview.label.targetWeight")} value={state.targetWeightKg ? t("panelNutritionPrescribeReview.kgValue", { value: formatMetric(state.targetWeightKg) }) : emptyText} href="/panel/nutrition/prescribe/target-weight?edit=1" />
            <InfoRow icon={<Target className="h-5 w-5" />} label={t("panelNutritionPrescribeReview.label.weeklyRate")} value={state.weeklyWeightChangeKg ? t("panelNutritionPrescribeReview.weeklyKgValue", { value: formatMetric(state.weeklyWeightChangeKg) }) : emptyText} href="/panel/nutrition/prescribe/weekly-rate?edit=1" />
            <InfoRow
              icon={<ClipboardPlus className="h-5 w-5" />}
              label={t("panelNutritionPrescribeReview.label.medicalConditions")}
              value={<MedicalConditionsSummary items={state.medicalConditionsItems} />}
              href="/panel/nutrition/prescribe/medical-conditions?edit=1"
            />
            <InfoRow icon={<Pill className="h-5 w-5" />} label={t("panelNutritionPrescribeReview.label.medications")} value={state.medicationsAndSupplements?.trim() || missingText} href="/panel/nutrition/prescribe/medications-and-supplements?edit=1" />
            <InfoRow icon={<ShieldAlert className="h-5 w-5" />} label={t("panelNutritionPrescribeReview.label.allergies")} value={state.foodAllergies?.trim() || missingText} href="/panel/nutrition/prescribe/allergies?edit=1" />
            <InfoRow icon={<Ban className="h-5 w-5" />} label={t("panelNutritionPrescribeReview.label.dislikedFoods")} value={state.dislikedFoods?.trim() || missingText} href="/panel/nutrition/prescribe/disliked-foods?edit=1" />
          </div>
        </section>

        <section className="rounded-[32px] border border-white/10 bg-[linear-gradient(160deg,rgba(18,34,49,0.95),rgba(11,22,35,0.9))] p-5">
          <div className="text-sm font-bold text-amber-300">{t("panelNutritionPrescribeReview.mindsetAnswers")}</div>
          <div className="mt-4 grid gap-3">
            {PANEL_PRESCRIBE_QUESTION_STEPS.map((item, index) => (
              <InfoRow
                key={item.key}
                icon={<Target className="h-5 w-5" />}
                label={t(item.titleKey)}
                value={state.mindsetAnswers?.[item.key] || "—"}
                href={`/panel/nutrition/prescribe/mindset/${index + 1}?edit=1`}
              />
            ))}
          </div>
        </section>

        <Button type="button" onClick={() => setLocation(primaryActionHref)} className="h-14 w-full rounded-[18px] bg-amber-400 font-black text-slate-950">
          {primaryActionLabel}
          <ArrowLeft className={cn("h-5 w-5", isRtl ? "ms-2" : "me-2 rotate-180")} />
        </Button>
      </div>
    </div>
  );
}
