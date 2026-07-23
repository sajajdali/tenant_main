import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useRoute } from "wouter";
import { ArrowLeft, ArrowRight, BadgeCheck, CalendarClock, Dumbbell, ImageIcon, Loader2, TriangleAlert, UtensilsCrossed } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import type { NutritionDietRequest } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PhoneText } from "@/i18n/ltr-text";
import { useFormat, useLocale, useT } from "@/i18n/locale";

type Translator = ReturnType<typeof useT>;
type LocaleFormatter = ReturnType<typeof useFormat>;

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function toDisplayNumber(value: number | string | null | undefined, format?: LocaleFormatter) {
  if (value === null || value === undefined || value === "") {
    return "۰";
  }

  const numberValue = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numberValue)) {
    return String(value);
  }

  return format ? format.number(numberValue, { maximumFractionDigits: 1 }) : String(numberValue);
}

function toLocalIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function normalizeIsoDate(value?: string | null) {
  const raw = String(value ?? "").trim();
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);

  return match?.[1] ?? "";
}

function dateFromIso(value?: string | null) {
  const iso = normalizeIsoDate(value);

  return iso ? new Date(`${iso}T00:00:00`) : null;
}

function datesBetween(startIso?: string | null, endIso?: string | null, fallbackDurationDays = 1) {
  const start = dateFromIso(startIso);
  const end = dateFromIso(endIso);

  if (!start) {
    return [];
  }

  const dates: string[] = [];
  const cursor = new Date(start);
  const maxDate = end && end >= start
    ? end
    : new Date(start);

  if (!end || end < start) {
    maxDate.setDate(maxDate.getDate() + Math.max(1, fallbackDurationDays) - 1);
  }

  while (cursor <= maxDate) {
    dates.push(toLocalIsoDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

function defaultTrackingDate(days: DayTracking[]) {
  const today = toLocalIsoDate(new Date());
  const todayOption = days.find((day) => day.date === today)?.date;

  if (todayOption) {
    return todayOption;
  }

  const first = days[0]?.date ?? "";
  const last = days[days.length - 1]?.date ?? "";

  return today < first ? first : last;
}

function mealSlotLabel(slotKey: string | null | undefined, t: Translator) {
  switch ((slotKey ?? "").trim()) {
    case "breakfast":
      return t("panelNutritionTracking.mealSlot.breakfast");
    case "morning_snack":
      return t("panelNutritionTracking.mealSlot.morningSnack");
    case "lunch":
      return t("panelNutritionTracking.mealSlot.lunch");
    case "afternoon_snack":
      return t("panelNutritionTracking.mealSlot.afternoonSnack");
    case "dinner":
      return t("panelNutritionTracking.mealSlot.dinner");
    case "night_snack":
      return t("panelNutritionTracking.mealSlot.nightSnack");
    case "snack":
      return t("panelNutritionTracking.mealSlot.snack");
    default:
      return slotKey || t("panelNutritionTracking.mealSlot.meal");
  }
}

function normalizeSlotKey(value?: string | null) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^A-Za-z0-9_\u0600-\u06FF-]+/g, "")
    .replace(/_+/g, "_");
}

function cleanTrackingNote(value?: string | null) {
  const raw = String(value ?? "").trim();
  if (raw === "") {
    return "";
  }

  return raw
    .replace(/slot:[^|]+/gi, "")
    .replace(/note:manual/gi, "")
    .replace(/calories:\d+/gi, "")
    .replace(/(?:protein_grams|fat_grams|carbohydrate_grams|fiber_grams):[0-9]+(?:\.[0-9]+)?/gi, "")
    .replace(/\|\s*\|/g, "|")
    .replace(/^\s*\|\s*|\s*\|\s*$/g, "")
    .trim();
}

function extractLoggedCalories(value?: string | null) {
  const raw = String(value ?? "");
  const match = raw.match(/(?:^|\|)\s*calories:(\d+)/);

  return match ? Number(match[1]) : 0;
}

function extractLoggedMacro(value: string | null | undefined, key: "protein_grams" | "fat_grams" | "carbohydrate_grams" | "fiber_grams") {
  const raw = String(value ?? "");
  const match = raw.match(new RegExp(`(?:^|\\|)\\s*${key}:([0-9]+(?:\\.[0-9]+)?)`));

  return match ? Number(match[1]) : 0;
}

function mealLogCalories(log: {
  calories?: number | null;
  notes?: string | null;
}) {
  return Number(log.calories ?? 0) > 0 ? Number(log.calories ?? 0) : extractLoggedCalories(log.notes);
}

function mealLogMacro(
  log: {
    proteinGrams?: number | null;
    fatGrams?: number | null;
    carbohydrateGrams?: number | null;
    fiberGrams?: number | null;
    notes?: string | null;
  },
  key: "protein_grams" | "fat_grams" | "carbohydrate_grams" | "fiber_grams",
) {
  const directValue = key === "protein_grams"
    ? log.proteinGrams
    : key === "fat_grams"
      ? log.fatGrams
      : key === "carbohydrate_grams"
        ? log.carbohydrateGrams
        : log.fiberGrams;

  return Number(directValue ?? 0) > 0 ? Number(directValue ?? 0) : extractLoggedMacro(log.notes, key);
}

function compactMealMetaItems(log: {
  calories?: number | null;
  proteinGrams?: number | null;
  fatGrams?: number | null;
  carbohydrateGrams?: number | null;
  fiberGrams?: number | null;
  notes?: string | null;
}, t: Translator, format: LocaleFormatter) {
  const calories = mealLogCalories(log);
  const protein = mealLogMacro(log, "protein_grams");
  const carbohydrate = mealLogMacro(log, "carbohydrate_grams");
  const fat = mealLogMacro(log, "fat_grams");
  const fiber = mealLogMacro(log, "fiber_grams");
  const formatNumber = (value: number) => format.number(value, { maximumFractionDigits: 1 });

  return [
    calories > 0 ? { key: "calories", label: t("panelNutritionTracking.units.kcal", { value: formatNumber(calories) }), tone: "border-emerald-300/20 bg-emerald-300/10 text-emerald-100" } : null,
    protein > 0 ? { key: "protein", label: t("panelNutritionTracking.macro.proteinValue", { value: formatNumber(protein) }), tone: "border-emerald-300/15 bg-emerald-300/8 text-emerald-100/90" } : null,
    carbohydrate > 0 ? { key: "carb", label: t("panelNutritionTracking.macro.carbohydrateValue", { value: formatNumber(carbohydrate) }), tone: "border-amber-300/15 bg-amber-300/8 text-amber-100/90" } : null,
    fat > 0 ? { key: "fat", label: t("panelNutritionTracking.macro.fatValue", { value: formatNumber(fat) }), tone: "border-rose-300/15 bg-rose-300/8 text-rose-100/90" } : null,
    fiber > 0 ? { key: "fiber", label: t("panelNutritionTracking.macro.fiberValue", { value: formatNumber(fiber) }), tone: "border-sky-300/15 bg-sky-300/8 text-sky-100/90" } : null,
  ].filter(Boolean) as Array<{ key: string; label: string; tone: string }>;
}

type TrackingMealSummary = {
  loggedMeals: number;
  calories: number;
  carbohydrateGrams: number;
  proteinGrams: number;
  fatGrams: number;
  fiberGrams: number;
};

function buildMealSummary(logs: Array<{ notes?: string | null }>): TrackingMealSummary {
  return logs.reduce<TrackingMealSummary>((summary, log) => ({
    loggedMeals: summary.loggedMeals + 1,
    calories: summary.calories + mealLogCalories(log),
    carbohydrateGrams: summary.carbohydrateGrams + mealLogMacro(log, "carbohydrate_grams"),
    proteinGrams: summary.proteinGrams + mealLogMacro(log, "protein_grams"),
    fatGrams: summary.fatGrams + mealLogMacro(log, "fat_grams"),
    fiberGrams: summary.fiberGrams + mealLogMacro(log, "fiber_grams"),
  }), {
    loggedMeals: 0,
    calories: 0,
    carbohydrateGrams: 0,
    proteinGrams: 0,
    fatGrams: 0,
    fiberGrams: 0,
  });
}

function DailyExpertNutritionOverviewCard({
  summary,
  dateLabel,
  dailyCalorieTarget,
  burnedCalories,
}: {
  summary: TrackingMealSummary;
  dateLabel: string;
  dailyCalorieTarget: number;
  burnedCalories: number;
}) {
  const t = useT();
  const format = useFormat();
  const formatNumber = (value: number) => format.number(value, { maximumFractionDigits: 1 });
  const chartItems = [
    { key: "carbohydrate", label: t("panelNutritionTracking.macro.carbohydrate"), value: summary.carbohydrateGrams, unit: "g", color: "#fbbf24", softClass: "border-amber-300/20 bg-amber-300/10 text-amber-100" },
    { key: "protein", label: t("panelNutritionTracking.macro.protein"), value: summary.proteinGrams, unit: "g", color: "#34d399", softClass: "border-emerald-300/20 bg-emerald-300/10 text-emerald-100" },
    { key: "fat", label: t("panelNutritionTracking.macro.fat"), value: summary.fatGrams, unit: "g", color: "#fb7185", softClass: "border-rose-300/20 bg-rose-300/10 text-rose-100" },
    { key: "fiber", label: t("panelNutritionTracking.macro.fiber"), value: summary.fiberGrams, unit: "g", color: "#38bdf8", softClass: "border-sky-300/20 bg-sky-300/10 text-sky-100" },
  ];
  const total = chartItems.reduce((sum, item) => sum + item.value, 0);
  const consumedPercent = dailyCalorieTarget > 0 ? Math.round((summary.calories / dailyCalorieTarget) * 100) : 0;
  const progressPercent = Math.min(100, consumedPercent);
  const overTargetCalories = dailyCalorieTarget > 0 ? Math.max(summary.calories - dailyCalorieTarget, 0) : 0;
  const compensatedCalories = Math.min(overTargetCalories, burnedCalories);
  const remainingOverTargetCalories = Math.max(overTargetCalories - burnedCalories, 0);
  const extraBurnedCalories = overTargetCalories > 0 ? Math.max(burnedCalories - overTargetCalories, 0) : burnedCalories;
  const netCalories = summary.calories - burnedCalories;
  const overTargetPercent = Math.max(consumedPercent - 100, 0);
  const remainingCalories = dailyCalorieTarget > 0 ? Math.max(dailyCalorieTarget - summary.calories, 0) : 0;
  const isOverTarget = overTargetCalories > 0;
  const overTargetBarPercent = Math.min(28, Math.max(10, overTargetPercent));
  let cursor = 0;
  const gradient = total > 0
    ? chartItems.map((item) => {
      const start = cursor;
      const end = cursor + (item.value / total) * 100;
      cursor = end;
      return `${item.color} ${start}% ${end}%`;
    }).join(", ")
    : "rgba(255,255,255,0.08) 0% 100%";

  return (
    <section className="overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.13),transparent_34%),linear-gradient(160deg,rgba(13,29,43,0.98),rgba(7,16,27,0.96))] p-4 text-white shadow-[0_34px_90px_-56px_rgba(0,0,0,0.98)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold text-amber-100/70">{t("panelNutritionTracking.overview.eyebrow")}</div>
          <div className="mt-1 text-xl font-black">{t("panelNutritionTracking.overview.title")}</div>
          <div className="mt-1 text-[11px] leading-6 text-slate-400">
            {t("panelNutritionTracking.overview.description", { date: dateLabel, count: format.number(summary.loggedMeals, { maximumFractionDigits: 0 }) })}
          </div>
        </div>
        <div className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] shadow-[inset_0_0_0_10px_rgba(255,255,255,0.035)]">
          <div className="absolute inset-2 rounded-full" style={{ background: `conic-gradient(${gradient})` }} />
          <div className="absolute inset-[18px] rounded-full border border-white/10 bg-[#081521]" />
          <div className="relative text-center">
            <div className="text-lg font-black">{formatNumber(summary.calories)}</div>
            <div className="text-[9px] font-bold text-slate-400">kcal</div>
          </div>
        </div>
      </div>

      {dailyCalorieTarget > 0 ? (
        <div className={`mt-4 rounded-[20px] border bg-white/[0.045] p-3 ${isOverTarget ? "border-rose-300/25" : "border-white/10"}`}>
          <div className="flex items-center justify-between gap-3 text-[11px] font-bold text-slate-300">
            <span>{isOverTarget ? t("panelNutritionTracking.overview.overTarget") : t("panelNutritionTracking.overview.remainingTarget")}</span>
            <span className={isOverTarget ? "text-rose-200" : "text-amber-100"}>
              {t("panelNutritionTracking.overview.targetRatio", {
                value: formatNumber(isOverTarget ? overTargetCalories : remainingCalories),
                total: formatNumber(dailyCalorieTarget),
              })}
            </span>
          </div>
          <div className="relative mt-3 h-2 overflow-hidden rounded-full bg-white/[0.08]">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,#fbbf24,#34d399)] shadow-[0_0_18px_rgba(251,191,36,0.28)] transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
            {isOverTarget ? (
              <div
                className="absolute inset-y-0 start-0 rounded-full bg-rose-400 shadow-[0_0_18px_rgba(251,113,133,0.42)]"
                style={{ width: `${overTargetBarPercent}%` }}
              />
            ) : null}
          </div>
          <div className="mt-2 text-[10px] font-bold text-slate-500">
            {t("panelNutritionTracking.overview.consumed", { value: formatNumber(summary.calories) })}
          </div>
          {isOverTarget ? (
            <div className="mt-3 rounded-[16px] border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-[11px] font-bold leading-6 text-rose-100">
              {remainingOverTargetCalories > 0
                ? compensatedCalories > 0
                  ? t("panelNutritionTracking.overview.overCompensatedPartial", {
                      over: formatNumber(overTargetCalories),
                      compensated: formatNumber(compensatedCalories),
                      remaining: formatNumber(remainingOverTargetCalories),
                    })
                  : t("panelNutritionTracking.overview.overNoExercise", {
                      over: formatNumber(overTargetCalories),
                      percent: format.number(overTargetPercent, { maximumFractionDigits: 0 }),
                    })
                : extraBurnedCalories > 0
                  ? t("panelNutritionTracking.overview.overFullyCompensatedExtra", {
                      over: formatNumber(overTargetCalories),
                      extra: formatNumber(extraBurnedCalories),
                    })
                  : t("panelNutritionTracking.overview.overFullyCompensated", { over: formatNumber(overTargetCalories) })}
            </div>
          ) : null}

          {burnedCalories > 0 ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-[14px] border border-cyan-300/20 bg-cyan-300/10 px-3 py-2">
                <div className="text-[10px] font-bold text-cyan-100/75">{t("panelNutritionTracking.overview.exerciseCalories")}</div>
                <div className="mt-1 text-sm font-black text-cyan-100">{t("panelNutritionTracking.units.kcal", { value: formatNumber(burnedCalories) })}</div>
              </div>
              <div className="rounded-[14px] border border-emerald-300/20 bg-emerald-300/10 px-3 py-2">
                <div className="text-[10px] font-bold text-emerald-100/75">{t("panelNutritionTracking.overview.netDay")}</div>
                <div className="mt-1 text-sm font-black text-emerald-100">{t("panelNutritionTracking.units.kcal", { value: formatNumber(netCalories) })}</div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-2">
        {chartItems.map((item) => (
          <div key={item.key} className={`rounded-[18px] border px-3 py-3 ${item.softClass}`}>
            <div className="flex items-center justify-between gap-2">
              <div className="text-[11px] font-bold opacity-75">{item.label}</div>
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
            </div>
            <div className="mt-2 text-lg font-black text-white">
              {formatNumber(item.value)}
              <span className="ms-1 text-[10px] font-bold text-white/55">{item.unit}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

type DayTracking = {
  date: string;
  dateLabel: string;
  progressPercent: number;
  waterGlasses: number;
  status: string;
  expectedSlots: Array<{ key: string; title: string }>;
  completedLogs: Array<{
    id: string;
    slotKey?: string | null;
    slotTitle: string;
    foodTitle?: string | null;
    photoUrl?: string | null;
    quantityText?: string | null;
    foodDescription?: string | null;
    calories?: number | null;
    proteinGrams?: number | null;
    fatGrams?: number | null;
    carbohydrateGrams?: number | null;
    fiberGrams?: number | null;
    notes?: string | null;
  }>;
  manualLogs: Array<{
    id: string;
    slotKey?: string | null;
    slotTitle: string;
    foodTitle?: string | null;
    photoUrl?: string | null;
    quantityText?: string | null;
    foodDescription?: string | null;
    calories?: number | null;
    proteinGrams?: number | null;
    fatGrams?: number | null;
    carbohydrateGrams?: number | null;
    fiberGrams?: number | null;
    notes?: string | null;
  }>;
  exerciseLogs: Array<{
    id: string;
    title?: string | null;
    groupTitle?: string | null;
    intensity?: string | null;
    durationMinutes: number;
    distanceKm?: number | null;
    speedKmh?: number | null;
    weightKg?: number | null;
    caloriesBurned: number;
    notes?: string | null;
  }>;
  missedSlots: Array<{ key: string; title: string }>;
};

type TrackingMealLog = NonNullable<NonNullable<NutritionDietRequest["currentPrescription"]>["mealLogs"]>[number];
type TrackingWaterLog = NonNullable<NonNullable<NutritionDietRequest["currentPrescription"]>["waterLogs"]>[number];
type TrackingExerciseLog = NonNullable<NonNullable<NutritionDietRequest["currentPrescription"]>["exerciseLogs"]>[number];

function isManualMealLog(log: TrackingMealLog) {
  return Boolean(log.isManual) || log.consumptionType === "manual";
}

function logsForTrackingDate(logs: TrackingMealLog[], date: string, manual: boolean) {
  return logs.filter((log) => normalizeIsoDate(log.consumedDate) === date && isManualMealLog(log) === manual);
}

function waterForTrackingDate(logs: TrackingWaterLog[], date: string) {
  return logs.find((log) => normalizeIsoDate(log.consumedDate) === date) ?? null;
}

function exerciseLogsForTrackingDate(logs: TrackingExerciseLog[], date: string) {
  return logs.filter((log) => normalizeIsoDate(log.consumedDate) === date);
}

function exerciseIntensityLabel(value: string | null | undefined, t: Translator) {
  switch (value) {
    case "light":
      return t("panelNutritionTracking.exerciseIntensity.light");
    case "vigorous":
      return t("panelNutritionTracking.exerciseIntensity.vigorous");
    case "moderate":
    default:
      return t("panelNutritionTracking.exerciseIntensity.moderate");
  }
}

function buildTrackingDays(item: NutritionDietRequest | null, t: Translator, formatDateLabel: (value?: string | null) => string): DayTracking[] {
  const prescription = item?.currentPrescription;
  if (!prescription) {
    return [];
  }

  const prescriptionRecord = prescription as unknown as Record<string, unknown>;
  const content = asRecord(prescription.contentSnapshot);
  const mealLogs = prescription.mealLogs ?? [];
  const waterLogs = prescription.waterLogs ?? [];
  const exerciseLogs = prescription.exerciseLogs ?? [];
  const progressDays = prescription.progress?.days ?? [];
  const startedAt = typeof prescriptionRecord["startedAt"] === "string" ? normalizeIsoDate(String(prescriptionRecord["startedAt"])) : "";
  const endsAt = typeof prescriptionRecord["endsAt"] === "string" ? normalizeIsoDate(String(prescriptionRecord["endsAt"])) : "";
  const durationValue = Number(prescriptionRecord["durationDays"] ?? 0);
  const durationDays = Math.max(1, (Number.isFinite(durationValue) && durationValue > 0 ? durationValue : 0) || progressDays.length || 1);

  const mealSlots = asArray(content.meal_slots).map((slotValue) => {
    const slot = asRecord(slotValue);
    return {
      key: normalizeSlotKey(String(slot.slot_key ?? slot.key ?? slot.title ?? "")),
      title: String(slot.title ?? mealSlotLabel(String(slot.slot_key ?? ""), t)),
    };
  }).filter((slot) => slot.key || slot.title);

  const dayPlans = asArray(content.day_plans).map((planValue) => asRecord(planValue));

  const dates = Array.from(new Set([
    ...(startedAt ? datesBetween(startedAt, endsAt, durationDays) : []),
    ...progressDays.map((day) => normalizeIsoDate(day.date)).filter(Boolean),
    ...mealLogs.map((log) => normalizeIsoDate(log.consumedDate)).filter(Boolean),
    ...waterLogs.map((log) => normalizeIsoDate(log.consumedDate)).filter(Boolean),
    ...exerciseLogs.map((log) => normalizeIsoDate(log.consumedDate)).filter(Boolean),
  ])).sort((a, b) => a.localeCompare(b));

  return dates.map((date, index) => {
    const progress = progressDays.find((day) => normalizeIsoDate(day.date) === date);
    const scheduledLogs = logsForTrackingDate(mealLogs, date, false);
    const manualLogs = logsForTrackingDate(mealLogs, date, true);
    const waterLog = waterForTrackingDate(waterLogs, date);
    const dailyExerciseLogs = exerciseLogsForTrackingDate(exerciseLogs, date);

    const expectedSlots = prescription.prescriptionMode === "daily_prescription"
      ? (() => {
          const plan = dayPlans.find((planValue) => Number(planValue.day_number ?? 0) === index + 1) ?? dayPlans[index] ?? null;
          const meals = plan ? asArray(plan.meals) : [];
          return meals.map((mealValue, mealIndex) => {
            const meal = asRecord(mealValue);
            const slotKey = normalizeSlotKey(String(meal.slot_key ?? meal.title ?? `meal_${mealIndex + 1}`));
            const fallbackTitle = t("panelNutritionTracking.mealSlot.numberedMeal", { number: String(mealIndex + 1) });
            const rawTitle = String(meal.title ?? mealSlotLabel(slotKey, t) ?? fallbackTitle);
            return {
              key: slotKey || `meal_${mealIndex + 1}`,
              title: rawTitle.trim() || fallbackTitle,
            };
          });
        })()
      : mealSlots.map((slot) => ({ key: slot.key || slot.title, title: slot.title }));

    const completedSlotKeys = new Set(
      scheduledLogs.map((log) => normalizeSlotKey(log.mealSlotKey)).filter(Boolean),
    );
    const expectedCount = expectedSlots.length;
    const progressPercent = expectedCount > 0
      ? Math.min(100, Math.round((completedSlotKeys.size / expectedCount) * 100))
      : Number(progress?.progressPercent ?? 0);
    const status = completedSlotKeys.size >= expectedCount && expectedCount > 0
      ? "complete"
      : completedSlotKeys.size > 0
        ? "partial"
        : String(progress?.status ?? "none");

    const missedSlots = expectedSlots.filter((slot) => !completedSlotKeys.has(slot.key));

    const expectedSlotsMap = new Map(expectedSlots.map((slot) => [slot.key, slot.title]));

    return {
      date,
      dateLabel: formatDateLabel(date),
      progressPercent,
      waterGlasses: Number(waterLog?.glasses ?? progress?.waterGlasses ?? 0),
      status,
      expectedSlots,
      completedLogs: scheduledLogs.map((log) => ({
        id: log.id,
        slotKey: log.mealSlotKey,
        slotTitle:
          expectedSlotsMap.get(normalizeSlotKey(log.mealSlotKey))
          ?? mealSlots.find((slot) => slot.key === normalizeSlotKey(log.mealSlotKey))?.title
          ?? mealSlotLabel(log.mealSlotKey, t),
        foodTitle: log.foodTitle,
        photoUrl: log.photoUrl,
        quantityText: log.quantityText,
        foodDescription: log.foodDescription,
        calories: log.calories,
        proteinGrams: log.proteinGrams,
        fatGrams: log.fatGrams,
        carbohydrateGrams: log.carbohydrateGrams,
        fiberGrams: log.fiberGrams,
        notes: log.notes,
      })),
      manualLogs: manualLogs.map((log) => ({
        id: log.id,
        slotKey: log.mealSlotKey,
        slotTitle:
          expectedSlotsMap.get(normalizeSlotKey(log.mealSlotKey))
          ?? mealSlots.find((slot) => slot.key === normalizeSlotKey(log.mealSlotKey))?.title
          ?? mealSlotLabel(log.mealSlotKey, t),
        foodTitle: log.foodTitle,
        photoUrl: log.photoUrl,
        quantityText: log.quantityText,
        foodDescription: log.foodDescription,
        calories: log.calories,
        proteinGrams: log.proteinGrams,
        fatGrams: log.fatGrams,
        carbohydrateGrams: log.carbohydrateGrams,
        fiberGrams: log.fiberGrams,
        notes: log.notes,
      })),
      exerciseLogs: dailyExerciseLogs.map((log) => ({
        id: log.id,
        title: log.title,
        groupTitle: log.groupTitle,
        intensity: log.intensity,
        durationMinutes: Number(log.durationMinutes ?? 0),
        distanceKm: log.distanceKm ?? null,
        speedKmh: log.speedKmh ?? null,
        weightKg: log.weightKg ?? null,
        caloriesBurned: Number(log.caloriesBurned ?? 0),
        notes: log.notes,
      })),
      missedSlots,
    };
  });
}

export default function PanelNutritionRequestTrackingPage() {
  const { isAdmin, isLoading } = useAuth();
  const { toast } = useToast();
  const t = useT();
  const format = useFormat();
  const { dir, isRtl } = useLocale();
  const [match, params] = useRoute("/panel/nutrition/requests/:requestId/tracking");
  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState<NutritionDietRequest | null>(null);
  const [mealPhotoPreview, setMealPhotoPreview] = useState<{ url: string; title: string } | null>(null);

  const requestId = match ? params.requestId : null;
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;
  const formatCount = (value: number | null | undefined) => format.number(Number(value ?? 0), { maximumFractionDigits: 0 });
  const formatFlexibleNumber = (value: number | string | null | undefined) => toDisplayNumber(value, format);
  const formatDateLabel = useCallback((value?: string | null) => (value ? format.date(value) : "—"), [format]);

  useEffect(() => {
    if (isLoading || !isAdmin || !requestId) {
      return;
    }

    setLoading(true);
    api.nutritionDietRequests.adminShow(requestId).then((result) => {
      if (result.success) {
        setItem(result.data.item);
      } else {
        toast({ variant: "destructive", title: t("panelNutritionTracking.toast.loadFailed"), description: result.message });
      }
      setLoading(false);
    });
  }, [isAdmin, isLoading, requestId, t, toast]);

  const trackingDays = useMemo(() => buildTrackingDays(item, t, formatDateLabel), [formatDateLabel, item, t]);
  const trackingSummary = useMemo(() => {
    const loggedMeals = trackingDays.reduce((sum, day) => sum + day.completedLogs.length, 0);
    const expectedMeals = trackingDays.reduce((sum, day) => sum + day.expectedSlots.length, 0);

    return {
      loggedMeals,
      expectedMeals,
      progressPercent: expectedMeals > 0 ? Math.min(100, Math.round((loggedMeals / expectedMeals) * 100)) : 0,
    };
  }, [trackingDays]);
  const overallProgress = trackingSummary.progressPercent;
  const totalLoggedMeals = trackingSummary.loggedMeals;
  const totalExpectedMeals = trackingSummary.expectedMeals;
  const [selectedDate, setSelectedDate] = useState<string>("");

  useEffect(() => {
    if (trackingDays.length === 0) {
      setSelectedDate("");
      return;
    }

    setSelectedDate((current) => (
      current && trackingDays.some((day) => day.date === current)
        ? current
        : defaultTrackingDate(trackingDays)
    ));
  }, [trackingDays]);

  const selectedDay = useMemo(
    () => trackingDays.find((day) => day.date === selectedDate) ?? trackingDays[trackingDays.length - 1] ?? null,
    [selectedDate, trackingDays],
  );
  const selectedDayNutritionSummary = useMemo(
    () => buildMealSummary([
      ...(selectedDay?.completedLogs ?? []),
      ...(selectedDay?.manualLogs ?? []),
    ]),
    [selectedDay],
  );
  const dailyCalorieTarget = useMemo(() => {
    const content = asRecord(item?.currentPrescription?.contentSnapshot);
    const caloriePlan = asRecord(content.calorie_plan);
    const prescribedCalories = Number(caloriePlan.prescribed_calories ?? 0);
    const baseCalories = Number(caloriePlan.base_calories ?? 0);
    const expertFileCalories = Number(item?.currentPrescription?.expertFile?.calories ?? 0);

    return prescribedCalories > 0 ? prescribedCalories : baseCalories > 0 ? baseCalories : expertFileCalories > 0 ? expertFileCalories : 0;
  }, [item?.currentPrescription?.contentSnapshot, item?.currentPrescription?.expertFile?.calories]);

  if (isLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground" dir={dir}>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          {t("panelNutritionTracking.loading")}
        </div>
      </div>
    );
  }

  if (!isAdmin || !item?.currentPrescription) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground" dir={dir}>
        <div className="w-full max-w-md space-y-4 text-center">
          <h1 className="text-xl font-bold">{t("panelNutritionTracking.empty.title")}</h1>
          <p className="leading-7 text-muted-foreground">{t("panelNutritionTracking.empty.description")}</p>
          <Link href="/panel/nutrition/requests">
            <Button>{t("panelNutritionTracking.empty.back")}</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 text-foreground" dir={dir}>
      <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between gap-4 px-4 py-4">
          <div className="space-y-1">
            <h1 className="text-xl font-black">{t("panelNutritionTracking.header.title", { id: item.id })}</h1>
            <p className="text-sm text-muted-foreground">{t("panelNutritionTracking.header.description")}</p>
          </div>
          <Link href={`/panel/nutrition/requests/${item.id}`}>
            <Button variant="outline" size="icon" className="h-10 w-10 rounded-2xl">
              <BackIcon className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-7xl space-y-6 px-4 py-6">
        <section className="grid gap-4 md:grid-cols-3">
          <Card className="border-border/70 bg-card/60">
            <CardHeader>
              <CardTitle className="text-sm">{t("panelNutritionTracking.stats.progress")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black">{t("panelNutritionTracking.units.percent", { value: formatCount(overallProgress) })}</div>
            </CardContent>
          </Card>
          <Card className="border-border/70 bg-card/60">
            <CardHeader>
              <CardTitle className="text-sm">{t("panelNutritionTracking.stats.loggedMeals")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black">{formatCount(totalLoggedMeals)}</div>
              <div className="mt-2 text-xs text-muted-foreground">{t("panelNutritionTracking.stats.expectedMeals", { count: formatCount(totalExpectedMeals) })}</div>
            </CardContent>
          </Card>
          <Card className="border-border/70 bg-card/60">
            <CardHeader>
              <CardTitle className="text-sm">{t("panelNutritionTracking.stats.user")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-black">{item.user?.name || "—"}</div>
              <div className="mt-2 text-xs text-muted-foreground">{item.user?.mobile ? <PhoneText>{item.user.mobile}</PhoneText> : "—"}</div>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-4">
          <Card className="border-border/70 bg-card/60">
            <CardHeader>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="text-base">{t("panelNutritionTracking.filter.title")}</CardTitle>
                  <CardDescription className="mt-1">
                    {t("panelNutritionTracking.filter.description")}
                  </CardDescription>
                </div>
                <div className="w-full md:w-72">
                  <select
                    value={selectedDate}
                    onChange={(event) => setSelectedDate(event.target.value)}
                    className="h-12 w-full rounded-2xl border border-border/70 bg-background/60 px-4 text-sm font-bold text-foreground outline-none transition focus:border-primary"
                  >
                    {trackingDays.map((day) => (
                      <option key={day.date} value={day.date}>
                        {day.dateLabel}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </CardHeader>
          </Card>

          {selectedDay ? (
            <Card key={selectedDay.date} className="border-border/70 bg-card/60">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <CalendarClock className="h-5 w-5 text-primary" />
                      {selectedDay.dateLabel}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {selectedDay.status === "complete"
                        ? t("panelNutritionTracking.dayStatus.completeDescription")
                        : selectedDay.status === "partial"
                          ? t("panelNutritionTracking.dayStatus.partialDescription")
                          : t("panelNutritionTracking.dayStatus.emptyDescription")}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={selectedDay.status === "complete" ? "default" : selectedDay.status === "partial" ? "secondary" : "outline"}>
                      {t("panelNutritionTracking.units.percent", { value: formatCount(selectedDay.progressPercent) })}
                    </Badge>
                    <Badge variant="outline">{t("panelNutritionTracking.units.waterGlasses", { value: formatCount(selectedDay.waterGlasses) })}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <DailyExpertNutritionOverviewCard
                  summary={selectedDayNutritionSummary}
                  dateLabel={selectedDay.dateLabel}
                  dailyCalorieTarget={dailyCalorieTarget}
                  burnedCalories={selectedDay.exerciseLogs.reduce((sum, log) => sum + Number(log.caloriesBurned ?? 0), 0)}
                />

                <div className="grid gap-4 xl:grid-cols-3">
                  <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/5 p-4">
                    <div className="flex items-center gap-2 text-sm font-bold text-emerald-300">
                      <BadgeCheck className="h-4 w-4" />
                      {t("panelNutritionTracking.sections.completed")}
                    </div>
                    <div className="mt-3 space-y-3">
                      {selectedDay.completedLogs.length ? selectedDay.completedLogs.map((log) => (
                        <div key={log.id} className="rounded-xl border border-border/70 bg-background/40 p-3">
                          <div className="text-xs text-muted-foreground">{log.slotTitle}</div>
                          <div className="mt-1 font-black">{log.foodTitle ?? "—"}</div>
                          {String(log.quantityText ?? "").trim() !== "" ? <div className="mt-1 text-xs text-muted-foreground">{String(log.quantityText)}</div> : null}
                          {log.photoUrl ? (
                            <div className="mt-3 rounded-xl border border-emerald-400/15 bg-emerald-500/5 p-2">
                              <div className="mb-2 text-[11px] font-bold text-emerald-300">{t("panelNutritionTracking.photo.loggedForMeal")}</div>
                              <button
                                type="button"
                                onClick={() => setMealPhotoPreview({ url: log.photoUrl ?? "", title: log.foodTitle ?? t("panelNutritionTracking.photo.title") })}
                                className="flex w-full items-center gap-3 rounded-lg text-start transition hover:bg-white/5"
                              >
                                <img src={log.photoUrl} alt={log.foodTitle ?? t("panelNutritionTracking.photo.title")} className="h-16 w-16 rounded-lg object-cover ring-1 ring-white/10" />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1 text-xs font-bold text-white">
                                    <ImageIcon className="h-3.5 w-3.5 text-emerald-300" />
                                    {t("panelNutritionTracking.photo.viewLarge")}
                                  </div>
                                  <div className="mt-1 text-[11px] leading-5 text-muted-foreground">{t("panelNutritionTracking.photo.viewLargeHint")}</div>
                                </div>
                              </button>
                            </div>
                          ) : null}
                          {compactMealMetaItems(log, t, format).length ? (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {compactMealMetaItems(log, t, format).map((item) => (
                                <span key={`${log.id}-${item.key}`} className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${item.tone}`}>
                                  {item.label}
                                </span>
                              ))}
                            </div>
                          ) : null}
                          {String(log.foodDescription ?? "").trim() !== "" ? <div className="mt-2 text-sm leading-7">{String(log.foodDescription)}</div> : null}
                          {cleanTrackingNote(log.notes) !== "" ? <div className="mt-2 text-xs leading-6 text-slate-400">{cleanTrackingNote(log.notes)}</div> : null}
                        </div>
                      )) : (
                        <div className="rounded-xl border border-dashed border-border/70 bg-background/20 p-4 text-sm text-muted-foreground">{t("panelNutritionTracking.sections.completedEmpty")}</div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-amber-400/20 bg-amber-500/5 p-4">
                    <div className="flex items-center gap-2 text-sm font-bold text-amber-300">
                      <UtensilsCrossed className="h-4 w-4" />
                      {t("panelNutritionTracking.sections.missed")}
                    </div>
                    <div className="mt-3 space-y-3">
                      {selectedDay.missedSlots.length ? selectedDay.missedSlots.map((slot) => (
                        <div key={`${selectedDay.date}-${slot.key}`} className="rounded-xl border border-border/70 bg-background/40 p-3">
                          <div className="font-black">{slot.title}</div>
                          <div className="mt-1 text-xs text-muted-foreground">{t("panelNutritionTracking.sections.missedItemHint")}</div>
                        </div>
                      )) : (
                        <div className="rounded-xl border border-dashed border-border/70 bg-background/20 p-4 text-sm text-muted-foreground">{t("panelNutritionTracking.sections.missedEmpty")}</div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-rose-400/20 bg-rose-500/5 p-4">
                    <div className="flex items-center gap-2 text-sm font-bold text-rose-300">
                      <TriangleAlert className="h-4 w-4" />
                      {t("panelNutritionTracking.sections.manual")}
                    </div>
                    <div className="mt-3 space-y-3">
                      {selectedDay.manualLogs.length ? selectedDay.manualLogs.map((log) => (
                        <div key={log.id} className="rounded-xl border border-border/70 bg-background/40 p-3">
                          <div className="text-xs text-muted-foreground">{log.slotTitle}</div>
                          <div className="mt-1 font-black">{log.foodTitle ?? "—"}</div>
                          {String(log.quantityText ?? "").trim() !== "" ? <div className="mt-1 text-xs text-muted-foreground">{String(log.quantityText)}</div> : null}
                          {log.photoUrl ? (
                            <div className="mt-3 rounded-xl border border-emerald-400/15 bg-emerald-500/5 p-2">
                              <div className="mb-2 text-[11px] font-bold text-emerald-300">{t("panelNutritionTracking.photo.loggedForMeal")}</div>
                              <button
                                type="button"
                                onClick={() => setMealPhotoPreview({ url: log.photoUrl ?? "", title: log.foodTitle ?? t("panelNutritionTracking.photo.title") })}
                                className="flex w-full items-center gap-3 rounded-lg text-start transition hover:bg-white/5"
                              >
                                <img src={log.photoUrl} alt={log.foodTitle ?? t("panelNutritionTracking.photo.title")} className="h-16 w-16 rounded-lg object-cover ring-1 ring-white/10" />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1 text-xs font-bold text-white">
                                    <ImageIcon className="h-3.5 w-3.5 text-emerald-300" />
                                    {t("panelNutritionTracking.photo.viewLarge")}
                                  </div>
                                  <div className="mt-1 text-[11px] leading-5 text-muted-foreground">{t("panelNutritionTracking.photo.viewLargeHint")}</div>
                                </div>
                              </button>
                            </div>
                          ) : null}
                          {compactMealMetaItems(log, t, format).length ? (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {compactMealMetaItems(log, t, format).map((item) => (
                                <span key={`${log.id}-${item.key}`} className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${item.tone}`}>
                                  {item.label}
                                </span>
                              ))}
                            </div>
                          ) : null}
                          {String(log.foodDescription ?? "").trim() !== "" ? <div className="mt-2 text-sm leading-7">{String(log.foodDescription)}</div> : null}
                          {cleanTrackingNote(log.notes) !== "" ? <div className="mt-2 text-xs leading-6 text-rose-200">{cleanTrackingNote(log.notes)}</div> : null}
                        </div>
                      )) : (
                        <div className="rounded-xl border border-dashed border-border/70 bg-background/20 p-4 text-sm text-muted-foreground">{t("panelNutritionTracking.sections.manualEmpty")}</div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm font-bold text-cyan-300">
                      <Dumbbell className="h-4 w-4" />
                      {t("panelNutritionTracking.sections.exercise")}
                    </div>
                    <Badge variant="outline">
                      {t("panelNutritionTracking.sections.exerciseSummary", {
                        count: formatCount(selectedDay.exerciseLogs.length),
                        calories: formatFlexibleNumber(selectedDay.exerciseLogs.reduce((sum, log) => sum + Number(log.caloriesBurned ?? 0), 0)),
                      })}
                    </Badge>
                  </div>
                  <div className="mt-3 space-y-3">
                    {selectedDay.exerciseLogs.length ? selectedDay.exerciseLogs.map((log) => (
                      <div key={log.id} className="rounded-xl border border-border/70 bg-background/40 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-black">{log.title ?? t("panelNutritionTracking.exercise.defaultTitle")}</div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {t("panelNutritionTracking.exercise.meta", {
                                group: log.groupTitle || t("panelNutritionTracking.exercise.defaultGroup"),
                                intensity: exerciseIntensityLabel(log.intensity, t),
                              })}
                            </div>
                          </div>
                          <div className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-black text-cyan-100">
                            {t("panelNutritionTracking.units.kcal", { value: formatFlexibleNumber(log.caloriesBurned) })}
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-bold text-white/85">
                            {t("panelNutritionTracking.units.minutes", { value: formatFlexibleNumber(log.durationMinutes) })}
                          </span>
                          {log.speedKmh ? <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-bold text-white/85">{t("panelNutritionTracking.units.speed", { value: formatFlexibleNumber(log.speedKmh) })}</span> : null}
                          {log.distanceKm ? <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-bold text-white/85">{t("panelNutritionTracking.units.distance", { value: formatFlexibleNumber(log.distanceKm) })}</span> : null}
                          {log.weightKg ? <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-bold text-white/85">{t("panelNutritionTracking.units.weight", { value: formatFlexibleNumber(log.weightKg) })}</span> : null}
                        </div>
                        {String(log.notes ?? "").trim() !== "" ? (
                          <div className="mt-2 rounded-xl border border-white/10 bg-background/30 px-3 py-2 text-xs leading-6 text-slate-300">
                            {String(log.notes)}
                          </div>
                        ) : null}
                      </div>
                    )) : (
                      <div className="rounded-xl border border-dashed border-border/70 bg-background/20 p-4 text-sm text-muted-foreground">
                        {t("panelNutritionTracking.sections.exerciseEmpty")}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </section>
      </main>

      <Dialog open={Boolean(mealPhotoPreview)} onOpenChange={(open) => !open && setMealPhotoPreview(null)}>
        <DialogContent dir={dir} className="max-w-3xl border-border/70 bg-background text-foreground">
          <DialogHeader>
            <DialogTitle>{mealPhotoPreview?.title ?? t("panelNutritionTracking.photo.title")}</DialogTitle>
            <DialogDescription>{t("panelNutritionTracking.photo.description")}</DialogDescription>
          </DialogHeader>
          {mealPhotoPreview?.url ? (
            <div className="overflow-hidden rounded-2xl border border-border/70 bg-black/20">
              <img src={mealPhotoPreview.url} alt={mealPhotoPreview.title ?? t("panelNutritionTracking.photo.title")} className="max-h-[75vh] w-full object-contain" />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
