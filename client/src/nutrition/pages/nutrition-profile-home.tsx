import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Calculator,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Dumbbell,
  Flame,
  Home,
  Loader2,
  Menu,
  MessageCircleMore,
  MessageSquareQuote,
  Package2,
  Plus,
  Sparkles,
  Store,
  UtensilsCrossed,
  UserRound,
  Zap,
  X,
} from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { CancelModal } from "@/components/cancel-modal";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MobileSiteMenu } from "@/components/mobile-site-menu";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { NotificationBell } from "@/components/notification-bell";
import type { Appointment, NutritionDietPrescription, NutritionDietRequest, NutritionPackageCheckoutSummaryPayload, NutritionProfile, NutritionProfileDashboardPayload } from "@/lib/types";
import { NutritionTopbar } from "@/nutrition/components/nutrition-topbar";
import { getNutritionFormState, updateNutritionFormState } from "@/nutrition/lib/nutrition-form-state";
import { getFirstIncompleteNutritionDraftHref, getFirstIncompleteNutritionProfileHref, hasStartedNutritionMembership, isNutritionProfileComplete, syncNutritionProfileFormState } from "@/nutrition/lib/profile-completion";
import { subscribeNutritionDietRequestUpdates, subscribeOnlineChatUserUpdates, subscribeUserNotificationInboxUpdates } from "@/lib/realtime";
import { playChatNotificationSound } from "@/lib/chat-notification-sound";
import { isAppointmentBookingDisabled } from "@/lib/audience";
import { usePublicSiteMenuItems } from "@/hooks/use-public-site-menu-items";
import { formatIsoDateInTimeZone } from "@/i18n/format";
import { useFormat, useLocale, useT } from "@/i18n/locale";

const NUTRITION_TIME_ZONE = "Asia/Tehran";
const DIET_REQUEST_SUCCESS_MODAL_KEY = "nutrition:diet-request-success-modal";

type DailyNutritionSummary = {
  loggedMeals: number;
  loggedExercises: number;
  calories: number;
  burnedCalories: number;
  netCalories: number;
  carbohydrateGrams: number;
  proteinGrams: number;
  fatGrams: number;
  fiberGrams: number;
};

type ProfileMealShortcutItem = {
  key: string;
  title: string;
  state: "done" | "idle";
};

type Translator = ReturnType<typeof useT>;
type LocaleFormatter = ReturnType<typeof useFormat>;

function formatGoalLabel(goal: NutritionProfile["dietGoal"] | null | undefined, t: Translator) {
  if (goal === "lose-weight") {
    return t("nutritionProfileHome.goal.loseWeight");
  }
  if (goal === "gain-weight") {
    return t("nutritionProfileHome.goal.gainWeight");
  }
  if (goal === "maintain-weight") {
    return t("nutritionProfileHome.goal.maintainWeight");
  }
  return t("nutritionProfileHome.goal.incomplete");
}

function getGoalDistanceLabel(goal: NutritionProfile["dietGoal"] | null | undefined, t: Translator) {
  if (goal === "gain-weight") {
    return t("nutritionProfileHome.goalDistance.toTarget");
  }

  if (goal === "maintain-weight") {
    return t("nutritionProfileHome.goalDistance.difference");
  }

  return t("nutritionProfileHome.goalDistance.extraWeight");
}

function formatProfileNumber(format: LocaleFormatter, value?: number | string | null, options: Intl.NumberFormatOptions = { maximumFractionDigits: 1 }) {
  if (value === undefined || value === null || value === "") {
    return "—";
  }

  const numeric = typeof value === "number" ? value : Number(value);
  if (Number.isFinite(numeric)) {
    return format.number(numeric, options);
  }

  return String(value);
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) {
    return 64;
  }

  return Math.max(8, Math.min(92, Math.round(value)));
}

function estimateWeeksToTarget(
  currentWeight: number | null | undefined,
  targetWeight: number | null | undefined,
  weeklyWeightChange: number | undefined,
  t: Translator,
  format: LocaleFormatter,
) {
  if (!currentWeight || !targetWeight || !weeklyWeightChange || weeklyWeightChange <= 0) {
    return t("common.unknown");
  }

  const distance = Math.abs(currentWeight - targetWeight);
  if (distance === 0) {
    return t("nutritionProfileHome.weeksValue", { count: format.number(0, { maximumFractionDigits: 0 }) });
  }

  const roundedWeeks = Math.ceil(distance / weeklyWeightChange);

  return t("nutritionProfileHome.weeksValue", { count: format.number(roundedWeeks, { maximumFractionDigits: 0 }) });
}

function formatAppointmentDate(date: string | null | undefined, format: LocaleFormatter) {
  if (!date) {
    return "—";
  }

  const value = new Date(`${date}T12:00:00`);

  if (Number.isNaN(value.getTime())) {
    return "—";
  }

  return format.date(value, {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });
}

function getDaysUntilAppointment(date?: string | null) {
  if (!date) {
    return null;
  }

  const target = new Date(`${date}T00:00:00`);
  const today = new Date();
  const current = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  if (Number.isNaN(target.getTime())) {
    return null;
  }

  return Math.ceil((target.getTime() - current.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDaysUntilLabel(daysUntil: number | null, t: Translator, format: LocaleFormatter) {
  if (daysUntil === null) {
    return t("nutritionProfileHome.appointment.unknownTime");
  }

  if (daysUntil <= 0) {
    return t("common.today");
  }

  if (daysUntil === 1) {
    return t("nutritionProfileHome.appointment.oneDayLeft");
  }

  return t("nutritionProfileHome.appointment.daysLeft", { count: format.number(daysUntil, { maximumFractionDigits: 0 }) });
}

function toTehranIsoDate(date: Date) {
  return formatIsoDateInTimeZone(date, NUTRITION_TIME_ZONE);
}

function formatProfileDate(value: string | null | undefined, format: LocaleFormatter) {
  if (!value) {
    return "—";
  }

  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime())
    ? "—"
    : format.date(date, { timeZone: NUTRITION_TIME_ZONE });
}

function resolveProfileActiveDate(prescription: NutritionDietPrescription | null) {
  const today = toTehranIsoDate(new Date());
  const start = String(prescription?.startedAt ?? "").trim();
  const end = String(prescription?.endsAt ?? "").trim();

  if (start && today < start) {
    return start;
  }

  if (end && today > end) {
    return end;
  }

  return today;
}

function parseIsoDate(value?: string | null) {
  const raw = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return null;
  }

  const [year, month, day] = raw.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysUntilPrescriptionEnds(value?: string | null) {
  const end = parseIsoDate(value);

  if (!end) {
    return null;
  }

  const today = parseIsoDate(toTehranIsoDate(new Date()));

  if (!today) {
    return null;
  }

  return Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function resolvePrescriptionProgressLabel(
  prescription: NutritionDietPrescription | null,
  activeDate: string,
  t: Translator,
  format: LocaleFormatter,
) {
  if (!prescription) {
    return null;
  }

  const start = parseIsoDate(prescription.startedAt);
  const end = parseIsoDate(prescription.endsAt);
  const current = parseIsoDate(activeDate);
  const content = typeof prescription.contentSnapshot === "object" && prescription.contentSnapshot
    ? (prescription.contentSnapshot as Record<string, unknown>)
    : {};
  const dayPlans = Array.isArray(content["day_plans"]) ? content["day_plans"] : [];
  const rangeDuration = start && end && end >= start
    ? Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1
    : 0;
  const totalDays = Math.max(1, Number(prescription.durationDays ?? 0), dayPlans.length || 0, rangeDuration);

  if (!start || !current || totalDays <= 0) {
    return null;
  }

  const diffDays = Math.floor((current.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const dayNumber = Math.min(totalDays, Math.max(1, diffDays + 1));

  return t("nutritionProfileHome.dailyOverview.progress", {
    current: format.number(dayNumber, { maximumFractionDigits: 0 }),
    total: format.number(totalDays, { maximumFractionDigits: 0 }),
  });
}

function extractLoggedCalories(value?: string | null) {
  const raw = String(value ?? "").trim();
  const match = raw.match(/(?:^|\|)\s*calories:(\d+)/);

  return match ? Number(match[1]) : 0;
}

function extractLoggedMacro(value: string | null | undefined, key: "protein_grams" | "fat_grams" | "carbohydrate_grams" | "fiber_grams") {
  const raw = String(value ?? "").trim();
  const match = raw.match(new RegExp(`(?:^|\\|)\\s*${key}:(\\d+(?:\\.\\d+)?)`));

  return match ? Number(match[1]) : 0;
}

function resolveLoggedCalories(log?: NonNullable<NutritionDietPrescription["mealLogs"]>[number] | null) {
  const value = Number(log?.calories ?? 0);
  return Number.isFinite(value) && value > 0 ? value : extractLoggedCalories(log?.notes);
}

function resolveLoggedMacro(
  log: NonNullable<NutritionDietPrescription["mealLogs"]>[number] | null | undefined,
  field: "proteinGrams" | "fatGrams" | "carbohydrateGrams" | "fiberGrams",
  noteKey: "protein_grams" | "fat_grams" | "carbohydrate_grams" | "fiber_grams",
) {
  const value = Number(log?.[field] ?? 0);
  return Number.isFinite(value) && value > 0 ? value : extractLoggedMacro(log?.notes, noteKey);
}

function buildDailyNutritionSummary(prescription: NutritionDietPrescription | null, activeDate: string): DailyNutritionSummary {
  const mealLogs = (prescription?.mealLogs ?? []).filter((log) => log.consumedDate === activeDate);
  const exerciseLogs = (prescription?.exerciseLogs ?? []).filter((log) => log.consumedDate === activeDate);
  const burnedCalories = exerciseLogs.reduce((sum, log) => sum + Number(log.caloriesBurned ?? 0), 0);

  const totals = mealLogs.reduce((summary, log) => ({
    loggedMeals: summary.loggedMeals + 1,
    calories: summary.calories + resolveLoggedCalories(log),
    carbohydrateGrams: summary.carbohydrateGrams + resolveLoggedMacro(log, "carbohydrateGrams", "carbohydrate_grams"),
    proteinGrams: summary.proteinGrams + resolveLoggedMacro(log, "proteinGrams", "protein_grams"),
    fatGrams: summary.fatGrams + resolveLoggedMacro(log, "fatGrams", "fat_grams"),
    fiberGrams: summary.fiberGrams + resolveLoggedMacro(log, "fiberGrams", "fiber_grams"),
  }), {
    loggedMeals: 0,
    calories: 0,
    carbohydrateGrams: 0,
    proteinGrams: 0,
    fatGrams: 0,
    fiberGrams: 0,
  });

  return {
    ...totals,
    loggedExercises: exerciseLogs.length,
    burnedCalories,
    netCalories: totals.calories - burnedCalories,
  };
}

function resolveDailyCalorieTarget(prescription: NutritionDietPrescription | null) {
  const plan = prescription?.contentSnapshot?.calorie_plan;

  if (!plan || typeof plan !== "object") {
    return 0;
  }

  const record = plan as Record<string, unknown>;
  return Number(record["prescribed_calories"] ?? record["base_calories"] ?? 0);
}

function asProfileRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function asProfileArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function normalizeProfileMealKey(value?: unknown) {
  const raw = String(value ?? "").trim();
  if (raw === "") {
    return "";
  }

  return raw
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^A-Za-z0-9_\u0600-\u06FF-]+/g, "")
    .replace(/_+/g, "_");
}

function mealShortcutLabel(slotKey: string | null | undefined, t: Translator) {
  switch ((slotKey ?? "").trim()) {
    case "breakfast":
      return t("nutritionProfileHome.meal.breakfast");
    case "morning_snack":
      return t("nutritionProfileHome.meal.morningSnack");
    case "lunch":
      return t("nutritionProfileHome.meal.lunch");
    case "afternoon_snack":
      return t("nutritionProfileHome.meal.afternoonSnack");
    case "dinner":
      return t("nutritionProfileHome.meal.dinner");
    case "night_snack":
      return t("nutritionProfileHome.meal.nightSnack");
    default:
      return slotKey ? String(slotKey) : t("nutritionProfileHome.meal.default");
  }
}

function buildProfileMealShortcutItems(
  prescription: NutritionDietPrescription | null,
  activeDate: string,
  t: Translator,
  format: LocaleFormatter,
): ProfileMealShortcutItem[] {
  if (!prescription || !activeDate) {
    return [];
  }

  const content = asProfileRecord(prescription.contentSnapshot);
  const selectedMealLogKeys = new Set(
    (prescription.mealLogs ?? [])
      .filter((log) => log.consumedDate === activeDate && !log.isManual)
      .map((log) => normalizeProfileMealKey(log.mealSlotKey))
      .filter(Boolean),
  );

  if (prescription.prescriptionMode === "user_choice") {
    return asProfileArray(content["meal_slots"])
      .map((slotValue, index) => {
        const slot = asProfileRecord(slotValue);
        const key = normalizeProfileMealKey(slot["slot_key"] ?? slot["key"] ?? slot["title"] ?? `meal_${index + 1}`);

        if (key === "") {
          return null;
        }

        return {
          key,
          title: String(slot["title"] ?? mealShortcutLabel(key, t) ?? t("nutritionProfileHome.meal.numbered", { count: format.number(index + 1, { maximumFractionDigits: 0 }) })),
          state: selectedMealLogKeys.has(key) ? "done" : "idle",
        } satisfies ProfileMealShortcutItem;
      })
      .filter((item): item is ProfileMealShortcutItem => item !== null);
  }

  if (prescription.prescriptionMode === "daily_prescription") {
    const dayPlans = asProfileArray(content["day_plans"]);
    const normalizedPlans = dayPlans
      .map((planValue, index) => {
        const plan = asProfileRecord(planValue);
        const dayNumber = Number(plan["day_number"] ?? 0);
        const resolvedDayNumber = Number.isFinite(dayNumber) && dayNumber > 0 ? dayNumber : index + 1;

        return {
          plan,
          iso: prescription.startedAt
            ? (() => {
              const start = parseIsoDate(prescription.startedAt);
              if (!start) {
                return "";
              }
              const next = new Date(start.getTime());
              next.setUTCDate(next.getUTCDate() + (resolvedDayNumber - 1));
              return next.toISOString().slice(0, 10);
            })()
            : "",
        };
      });
    const activePlan = normalizedPlans.find((item) => item.iso === activeDate)?.plan ?? null;

    return asProfileArray(activePlan?.["meals"])
      .map((mealValue, index) => {
        const meal = asProfileRecord(mealValue);
        const key = normalizeProfileMealKey(meal["slot_key"] ?? meal["title"] ?? `meal_${index + 1}`);

        if (key === "") {
          return null;
        }

        return {
          key,
          title: String(meal["title"] ?? mealShortcutLabel(key, t) ?? t("nutritionProfileHome.meal.numbered", { count: format.number(index + 1, { maximumFractionDigits: 0 }) })),
          state: selectedMealLogKeys.has(key) ? "done" : "idle",
        } satisfies ProfileMealShortcutItem;
      })
      .filter((item): item is ProfileMealShortcutItem => item !== null);
  }

  return [];
}

function NutritionProfileDailyOverviewCard({
  summary,
  activeDate,
  dailyCalorieTarget,
  progressLabel,
  t,
  format,
}: {
  summary: DailyNutritionSummary;
  activeDate: string;
  dailyCalorieTarget: number;
  progressLabel?: string | null;
  t: Translator;
  format: LocaleFormatter;
}) {
  const [macrosOpen, setMacrosOpen] = useState(false);
  const chartItems = [
    { key: "carbohydrate", label: t("nutritionProfileHome.dailyOverview.macro.carbohydrate"), value: summary.carbohydrateGrams, color: "#fbbf24", shellClassName: "border-amber-300/18 bg-amber-300/10 text-amber-100" },
    { key: "protein", label: t("nutritionProfileHome.dailyOverview.macro.protein"), value: summary.proteinGrams, color: "#34d399", shellClassName: "border-emerald-300/18 bg-emerald-300/10 text-emerald-100" },
    { key: "fat", label: t("nutritionProfileHome.dailyOverview.macro.fat"), value: summary.fatGrams, color: "#fb7185", shellClassName: "border-rose-300/18 bg-rose-300/10 text-rose-100" },
    { key: "fiber", label: t("nutritionProfileHome.dailyOverview.macro.fiber"), value: summary.fiberGrams, color: "#38bdf8", shellClassName: "border-sky-300/18 bg-sky-300/10 text-sky-100" },
  ];
  const total = chartItems.reduce((sum, item) => sum + item.value, 0);
  const consumedPercent = dailyCalorieTarget > 0 ? Math.round((summary.calories / dailyCalorieTarget) * 100) : 0;
  const remainingCalories = dailyCalorieTarget > 0 ? Math.max(dailyCalorieTarget - summary.calories, 0) : 0;
  const progressPercent = Math.max(0, Math.min(100, consumedPercent));
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
    <section className="space-y-3">
      <div className="overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(160deg,#191b16,#11130f)] p-4 shadow-[0_30px_80px_-54px_rgba(0,0,0,0.95)]">
        <div className="grid grid-cols-[72px_1fr] items-center gap-3">
          <div className="relative flex h-[68px] w-[68px] items-center justify-center rounded-full border border-white/8 bg-white/[0.035] shadow-[inset_0_0_0_7px_rgba(255,255,255,0.035)]">
            <div className="absolute inset-2 rounded-full" style={{ background: `conic-gradient(${gradient})` }} />
            <div className="absolute inset-[13px] rounded-full border border-white/10 bg-[#191b16]" />
            <div className="relative text-center">
              <div className="text-sm font-black text-white">{formatProfileNumber(format, summary.calories)}</div>
              <div className="text-[9px] font-bold text-slate-400">kcal</div>
            </div>
          </div>

          <div className="min-w-0">
            <div className="flex items-center justify-between gap-3 text-[11px] font-bold text-slate-300">
              <span>{t("nutritionProfileHome.dailyOverview.remainingCalories")}</span>
              <span className="text-white">{t("nutritionProfileHome.dailyOverview.remainingValue", {
                remaining: formatProfileNumber(format, remainingCalories),
                total: formatProfileNumber(format, dailyCalorieTarget || 0),
              })}</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.08]">
              <div
                className="h-full rounded-full bg-amber-300 shadow-[0_0_18px_rgba(251,191,36,0.3)] transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-[10px] font-bold text-slate-500">
              <span>{t("nutritionProfileHome.dailyOverview.consumedCalories", { count: formatProfileNumber(format, summary.calories) })}</span>
              <span>{t("nutritionProfileHome.dailyOverview.consumedPercent", { percent: formatProfileNumber(format, consumedPercent, { maximumFractionDigits: 0 }) })}</span>
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <div className="rounded-[16px] border border-white/10 bg-white/[0.04] px-3 py-3">
            <div className="text-[10px] font-bold text-slate-400">{t("nutritionProfileHome.dailyOverview.exerciseCalories")}</div>
            <div className="mt-2 text-xs font-black text-emerald-300">{t("nutritionProfileHome.kcalValue", { count: formatProfileNumber(format, summary.burnedCalories) })}</div>
          </div>
          <div className="rounded-[16px] border border-white/10 bg-white/[0.04] px-3 py-3">
            <div className="text-[10px] font-bold text-slate-400">{t("nutritionProfileHome.dailyOverview.netToday")}</div>
            <div className="mt-2 text-xs font-black text-white">{t("nutritionProfileHome.kcalValue", { count: formatProfileNumber(format, summary.netCalories) })}</div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-[18px] border border-[#2c2f28] bg-[#171914] shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]">
        <button
          type="button"
          onClick={() => setMacrosOpen((current) => !current)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-start"
          aria-expanded={macrosOpen}
        >
          <span className="text-xs font-black text-stone-200">{t("nutritionProfileHome.dailyOverview.macrosToggle")}</span>
          <ChevronDown className={`h-4 w-4 text-amber-300 transition-transform ${macrosOpen ? "rotate-180" : ""}`} />
        </button>

        {macrosOpen ? (
          <div className="grid grid-cols-2 gap-2.5 border-t border-white/8 p-3">
            {chartItems.map((item) => (
              <div key={item.key} className="rounded-[15px] border border-[#2c2f28] bg-black/10 px-3 py-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-black text-white">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    {item.label}
                  </div>
                  <div className="text-xs font-black text-stone-400">
                    {formatProfileNumber(format, item.value)}
                    <span className="ms-1 text-[10px] font-bold text-stone-500">g</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

    </section>
  );
}

function NutritionProfileActiveDietCta({ onOpenDiet, t, isRtl }: { onOpenDiet: () => void; t: Translator; isRtl: boolean }) {
  const ForwardArrow = isRtl ? ArrowLeft : ArrowRight;
  return (
    <button
      type="button"
      onClick={onOpenDiet}
      className="group relative flex w-full items-center justify-between overflow-hidden rounded-[28px] bg-[linear-gradient(145deg,#f7c756,#eba01c_58%,#d98710)] p-4 text-start text-slate-950 shadow-[0_24px_58px_-34px_rgba(251,191,36,0.95)] transition hover:-translate-y-0.5"
    >
      <div className="absolute inset-y-0 end-0 w-28 rounded-full bg-white/16 blur-2xl" />
      <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] bg-slate-950/15 text-slate-950">
        <Bot className="h-7 w-7" />
      </div>
      <div className="relative min-w-0 flex-1 px-3">
        <div className="text-xl font-black">{t("nutritionProfileHome.primary.readyTitle")}</div>
        <div className="mt-1 text-xs font-bold leading-6 text-slate-900/75">{t("nutritionProfileHome.primary.readyDescription")}</div>
      </div>
      <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-[17px] bg-slate-950 text-amber-300 transition group-hover:translate-x-[-2px]">
        <ForwardArrow className="h-5 w-5" />
      </div>
    </button>
  );
}

function NutritionProfileExerciseCard({
  summary,
  activeDate,
  logs,
  onOpen,
  t,
  format,
}: {
  summary: DailyNutritionSummary;
  activeDate: string;
  logs: NonNullable<NutritionDietPrescription["exerciseLogs"]>;
  onOpen: () => void;
  t: Translator;
  format: LocaleFormatter;
}) {
  return (
    <section className="space-y-3">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 text-start">
            <div className="text-[11px] font-bold text-slate-500">{t("nutritionProfileHome.exercise.eyebrow")}</div>
            <div className="mt-1 text-[17px] font-black text-white">{t("nutritionProfileHome.exercise.title")}</div>
          </div>
          <button
            type="button"
            onClick={onOpen}
            className="shrink-0 rounded-[14px] bg-emerald-400 px-3 py-2.5 text-[11px] font-black text-slate-950 shadow-[0_18px_40px_-25px_rgba(52,211,153,0.85)] transition hover:bg-emerald-300"
          >
            <span className="flex items-center gap-2">
              <Dumbbell className="h-4 w-4" />
              {t("nutritionProfileHome.exercise.open")}
            </span>
          </button>
        </div>
        <div className="w-full text-start text-xs leading-7 text-slate-400">
          {t("nutritionProfileHome.exercise.description", { date: formatProfileDate(activeDate, format) })}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        <div className="rounded-[20px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.025))] px-3 py-4">
          <div className="text-[10px] font-bold text-slate-400">{t("nutritionProfileHome.exercise.burnedCalories")}</div>
          <div className="mt-3 text-sm font-black text-emerald-300">{t("nutritionProfileHome.kcalValue", { count: formatProfileNumber(format, summary.burnedCalories) })}</div>
        </div>
        <div className="rounded-[20px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.025))] px-3 py-4">
          <div className="text-[10px] font-bold text-slate-400">{t("nutritionProfileHome.exercise.count")}</div>
          <div className="mt-3 text-sm font-black text-white">{formatProfileNumber(format, summary.loggedExercises, { maximumFractionDigits: 0 })}</div>
        </div>
        <div className="rounded-[20px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.025))] px-3 py-4">
          <div className="text-[10px] font-bold text-slate-400">{t("nutritionProfileHome.exercise.netCalories")}</div>
          <div className="mt-3 text-sm font-black text-white">{t("nutritionProfileHome.kcalValue", { count: formatProfileNumber(format, summary.netCalories) })}</div>
        </div>
      </div>

      <div className="rounded-[22px] border border-dashed border-white/12 bg-white/[0.02] px-4 py-4">
        {logs.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border border-emerald-300/20 bg-emerald-400/10 text-emerald-300">
                <Flame className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-black text-white">
                  {t("nutritionProfileHome.exercise.loggedSummary", {
                    exercises: formatProfileNumber(format, summary.loggedExercises, { maximumFractionDigits: 0 }),
                    calories: formatProfileNumber(format, summary.burnedCalories),
                  })}
                </div>
                <div className="mt-1 text-xs leading-6 text-slate-400">
                  {t("nutritionProfileHome.exercise.loggedDescription")}
                </div>
              </div>
            </div>

            <div className="grid gap-2">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-[18px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.055),rgba(255,255,255,0.025))] px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-black text-white">{log.title || t("nutritionProfileHome.exercise.defaultLogTitle")}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-bold text-slate-400">
                        {log.groupTitle ? <span>{log.groupTitle}</span> : null}
                        {log.intensity ? <span>{t("nutritionProfileHome.exercise.intensityValue", { value: String(log.intensity) })}</span> : null}
                        {log.durationMinutes ? <span>{t("nutritionProfileHome.minutesValue", { count: formatProfileNumber(format, log.durationMinutes, { maximumFractionDigits: 0 }) })}</span> : null}
                      </div>
                    </div>
                    <div className="shrink-0 rounded-full bg-emerald-400/12 px-3 py-1 text-xs font-black text-emerald-300">
                      {t("nutritionProfileHome.kcalValue", { count: formatProfileNumber(format, log.caloriesBurned) })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-sm leading-7 text-slate-400">
            {t("nutritionProfileHome.exercise.empty")}
          </div>
        )}
      </div>
    </section>
  );
}

function NutritionProfileMealShortcutsCard({
  items,
  onOpenMeal,
  t,
  isRtl,
}: {
  items: ProfileMealShortcutItem[];
  onOpenMeal: (mealKey: string) => void;
  t: Translator;
  isRtl: boolean;
}) {
  const ForwardArrow = isRtl ? ArrowLeft : ArrowRight;
  return (
    <section className="space-y-4">
      <div className="grid grid-cols-1 gap-2.5">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onOpenMeal(item.key)}
            className={`group relative flex min-h-[96px] items-center justify-between overflow-hidden rounded-[22px] border px-5 py-4 text-start transition hover:-translate-y-0.5 ${
              item.state === "done"
                ? "border-transparent bg-[linear-gradient(145deg,#1b2921,#151d18)] shadow-[0_0_0_1px_rgba(110,231,183,0.07),inset_0_3px_14px_rgba(0,0,0,0.3),0_18px_42px_-38px_rgba(52,211,153,0.45)]"
                : "border-[#34362d] bg-[linear-gradient(145deg,#1b1d17,#151711)] shadow-[inset_0_1px_0_rgba(255,255,255,0.025),0_18px_45px_-38px_rgba(0,0,0,0.9)] hover:border-amber-300/24"
            }`}
          >
            {item.state === "done" ? <div className="pointer-events-none absolute inset-0 bg-[#07100b]/40" /> : null}
            {item.state === "done" ? <div className="pointer-events-none absolute inset-y-0 end-0 w-[44%] bg-[linear-gradient(90deg,transparent,rgba(16,78,55,0.08))]" /> : null}
            <div className="relative min-w-0">
              <div className="truncate text-[15px] font-black text-white">{item.title}</div>
              <div className={`mt-1.5 text-[10px] font-black no-underline transition ${item.state === "done" ? "text-emerald-300" : "text-amber-300 group-hover:text-amber-200"}`}>
                {item.state === "done" ? t("nutritionProfileHome.mealShortcuts.done") : t("nutritionProfileHome.mealShortcuts.viewMeal", { meal: item.title })}
              </div>
            </div>
            <div className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] border transition ${
              item.state === "done"
                ? "border-emerald-300/15 bg-emerald-300/[0.06] text-emerald-300/70"
                : "border-white/[0.035] bg-[#292b25] text-stone-200 group-hover:bg-[#303229] group-hover:text-white"
            }`}>
              {item.state === "done" ? <CheckCircle2 className="h-5 w-5" /> : <ForwardArrow className="h-4 w-4" />}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

export default function NutritionProfileHomePage() {
  const t = useT();
  const format = useFormat();
  const { dir, isRtl } = useLocale();
  const ForwardArrow = isRtl ? ArrowLeft : ArrowRight;
  const [, setLocation] = useLocation();
  const { user, isLoading, logout } = useAuth();
  const { toast } = useToast();
  const formState = useMemo(() => getNutritionFormState(), []);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<NutritionProfile | null>(null);
  const [summary, setSummary] = useState<NutritionPackageCheckoutSummaryPayload | null>(null);
  const [activeDietRequest, setActiveDietRequest] = useState<NutritionDietRequest | null>(null);
  const [latestDietRequest, setLatestDietRequest] = useState<NutritionDietRequest | null>(null);
  const [currentPrescription, setCurrentPrescription] = useState<NutritionDietPrescription | null>(null);
  const [dietRenewal, setDietRenewal] = useState<NutritionProfileDashboardPayload["dashboard"]["dietRenewal"]>(null);
  const [hasDietHistory, setHasDietHistory] = useState(false);
  const [dietRequestNextStep, setDietRequestNextStep] = useState<string | null>(null);
  const [nextAppointment, setNextAppointment] = useState<Appointment | null>(null);
  const [onlineChatUnreadCount, setOnlineChatUnreadCount] = useState(0);
  const [managerMessage, setManagerMessage] = useState<string | null>(null);
  const [managerMessageDismissed, setManagerMessageDismissed] = useState(false);
  const [profileAccessMessage, setProfileAccessMessage] = useState<string | null>(null);
  const [cancelAppointmentOpen, setCancelAppointmentOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [incompleteMembershipOpen, setIncompleteMembershipOpen] = useState(false);
  const [activeDietDashboardTab, setActiveDietDashboardTab] = useState<"nutrition" | "exercise" | "quick">("nutrition");
  const [dietTabsCompact, setDietTabsCompact] = useState(false);
  const dietTabsRef = useRef<HTMLDivElement | null>(null);
  const dietTabsStickyPointRef = useRef<number | null>(null);
  const [dietRequestSuccessOpen, setDietRequestSuccessOpen] = useState(() => (
    typeof window !== "undefined" && window.sessionStorage.getItem(DIET_REQUEST_SUCCESS_MODAL_KEY) === "1"
  ));
  const { tenantMeta, publicMenuItems } = usePublicSiteMenuItems({
    includeBooking: true,
    includeNutrition: false,
    onlineChatUnreadCount,
    showCustomerClub: !!user && user.role !== "admin" && user.role !== "barber",
  });
  const chatModuleActive = tenantMeta?.activeFeatureModules?.some((item) => item.slug === "online-chat") ?? false;
  const storeModuleActive =
    (tenantMeta?.activeFeatureModules?.some((item) => item.slug === "online-store") ?? false) &&
    tenantMeta?.storeEnabled !== false;
  const appointmentBookingDisabled = isAppointmentBookingDisabled(tenantMeta);
  const bookingShortcutActive =
    (tenantMeta?.setupCompleted ?? false) &&
    !(tenantMeta?.supportExpired ?? false) &&
    !appointmentBookingDisabled;
  const nutritionAudienceSupportsManagerMessage = ["nutritionists", "nutrition-doctors"].includes(tenantMeta?.audience?.slug ?? "");
  const managerMessageStorageKey = useMemo(
    () => (user?.id && managerMessage ? `nutrition-manager-message-dismissed:${user.id}:${managerMessage}` : null),
    [managerMessage, user?.id],
  );
  const profileAccessBlocked = user?.canBook === false;
  const navigateFromMenu = (href: string, onSelect?: () => void) => {
    setMenuOpen(false);
    if (onSelect) {
      onSelect();
      return;
    }
    setLocation(href);
  };

  useEffect(() => {
    const tabs = dietTabsRef.current;
    if (!tabs || !currentPrescription) {
      dietTabsStickyPointRef.current = null;
      setDietTabsCompact(false);
      return;
    }

    const measureStickyPoint = () => {
      dietTabsStickyPointRef.current = tabs.getBoundingClientRect().top + window.scrollY;
    };
    const handleScroll = () => {
      const stickyPoint = dietTabsStickyPointRef.current;
      if (stickyPoint === null) {
        return;
      }
      const shouldCompact = window.scrollY >= Math.max(0, stickyPoint - 1);
      setDietTabsCompact((current) => current === shouldCompact ? current : shouldCompact);
    };

    measureStickyPoint();
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [currentPrescription]);

  const loadDashboard = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setLoading(true);
    }

    const [dashboardResult, appointmentResult, dietRequestOptionsResult] = await Promise.all([
      api.nutrition.getProfileDashboard(),
      api.appointments.mine("upcoming", 1, 1),
      api.nutritionDietRequests.options(),
    ]);

    const nextProfile = dashboardResult.success ? dashboardResult.data.profile : null;
    const upcomingAppointment = appointmentResult.success
      ? appointmentResult.data.items.find((appointment) => appointment.status !== "cancelled") ?? null
      : null;

    if (!dashboardResult.success) {
      setProfileAccessMessage(dashboardResult.message || t("nutritionProfileHome.access.defaultApiMessage"));
      setLoading(false);
      return;
    }

    setProfileAccessMessage(null);
    setProfile(nextProfile);
    syncNutritionProfileFormState(nextProfile);
    if (!options?.silent && ((nextProfile && hasStartedNutritionMembership(nextProfile) && !isNutritionProfileComplete(nextProfile)) || (!nextProfile && getFirstIncompleteNutritionDraftHref(formState)))) {
      setIncompleteMembershipOpen(true);
    }
    setManagerMessage(dashboardResult.data.managerMessage ?? null);
    setSummary({
      subscription: dashboardResult.data.subscription ?? null,
      orders: {
        items: [],
        page: 1,
        perPage: 0,
        total: 0,
        lastPage: 1,
      },
    });
    setActiveDietRequest(dashboardResult.data.dietRequest.active ?? null);
    setLatestDietRequest(dashboardResult.data.dietRequest.latest ?? null);
    setCurrentPrescription(dashboardResult.data.prescription.current ?? null);
    setDietRenewal(dashboardResult.data.dashboard.dietRenewal ?? null);
    setHasDietHistory(Boolean(dashboardResult.data.prescription.hasHistory));
    setDietRequestNextStep(dietRequestOptionsResult.success ? dietRequestOptionsResult.data.nextStep : null);
    setNextAppointment(upcomingAppointment);

    if (nextProfile?.targetWeightKg) {
      updateNutritionFormState({ targetWeightKg: String(nextProfile.targetWeightKg) });
    }

    if (!options?.silent) {
      setLoading(false);
    }
  }, [formState, t]);

  const loadOnlineChatSummary = useCallback(async () => {
    if (!chatModuleActive || !user) {
      setOnlineChatUnreadCount(0);
      return;
    }

    const res = await api.onlineChat.summary();

    if (!res.success) {
      return;
    }

    setOnlineChatUnreadCount(res.data.conversation?.customerUnreadCount ?? 0);
  }, [chatModuleActive, user]);

  useEffect(() => {
    if (!dietRequestSuccessOpen || typeof window === "undefined") {
      return;
    }

    window.sessionStorage.removeItem(DIET_REQUEST_SUCCESS_MODAL_KEY);
  }, [dietRequestSuccessOpen]);

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/nutrition");
      return;
    }

    if (!user || profileAccessBlocked) {
      return;
    }

    void loadDashboard();
    void loadOnlineChatSummary();
  }, [isLoading, loadDashboard, loadOnlineChatSummary, profileAccessBlocked, setLocation, user]);

  useEffect(() => {
    if (!user || isLoading) {
      return;
    }

    if (profileAccessBlocked) {
      return;
    }

    const storageKey = `nutrition_diet_shown_notifications_${user.id}`;
    let cancelled = false;

    const showDietNotifications = async () => {
      const res = await api.notifications.list("unread", 1, 10);
      if (!res.success || cancelled) {
        return;
      }

      const shown = new Set<string>(JSON.parse(window.sessionStorage.getItem(storageKey) || "[]"));
      const pending = res.data.items.filter((item) => item.targetType === "nutrition_diet" && !shown.has(item.id));
      const readPromises: Promise<unknown>[] = [];

      pending.forEach((item) => {
        toast({
          title: item.title || t("nutritionProfileHome.toast.dietReady"),
          description: item.message,
        });
        shown.add(item.id);
        readPromises.push(api.notifications.markRead(item.id));
      });

      window.sessionStorage.setItem(storageKey, JSON.stringify(Array.from(shown).slice(-30)));

      if (readPromises.length > 0) {
        await Promise.allSettled(readPromises);
      }
    };

    void showDietNotifications();

    const unsubscribe = subscribeUserNotificationInboxUpdates(user.id, () => {
      void loadDashboard({ silent: true });
      void showDietNotifications();
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [isLoading, loadDashboard, profileAccessBlocked, t, toast, user]);

  useEffect(() => {
    if (!chatModuleActive || !user?.id) {
      return;
    }

    if (profileAccessBlocked) {
      return;
    }

    return subscribeOnlineChatUserUpdates(user.id, (payload) => {
      const nextUnread = Number((payload.conversation as { customerUnreadCount?: number })?.customerUnreadCount ?? 0);
      setOnlineChatUnreadCount(Number.isFinite(nextUnread) ? nextUnread : 0);

      if (payload.action === "message_sent_by_admin") {
        void playChatNotificationSound();
      }
    });
  }, [chatModuleActive, profileAccessBlocked, user?.id]);

  useEffect(() => {
    if (!managerMessageStorageKey) {
      setManagerMessageDismissed(false);
      return;
    }

    setManagerMessageDismissed(window.localStorage.getItem(managerMessageStorageKey) === "1");
  }, [managerMessageStorageKey]);

  useEffect(() => {
    if (!user?.id || profileAccessBlocked) {
      return;
    }

    return subscribeNutritionDietRequestUpdates(user.id, () => {
      void loadDashboard({ silent: true });
    });
  }, [loadDashboard, profileAccessBlocked, user?.id]);

  if (!isLoading && user && profileAccessBlocked) {
    return (
      <div className="relative isolate min-h-screen overflow-hidden bg-[#06131d] px-4 py-8 text-white" dir={dir}>
        <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(248,113,113,0.16),transparent_24%),linear-gradient(180deg,rgba(6,19,29,0.96),rgba(4,10,17,1))]" />
        <div className="relative z-10 mx-auto max-w-md space-y-5">
          <NutritionTopbar backHref="/booking" title={t("nutritionProfileHome.access.topbarTitle")} description={t("nutritionProfileHome.access.topbarDescription")} hideBack />

          <section className="rounded-[34px] border border-rose-300/20 bg-[linear-gradient(160deg,rgba(127,29,29,0.35),rgba(24,24,27,0.92))] p-6 shadow-[0_30px_90px_-50px_rgba(248,113,113,0.45)]">
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[24px] bg-rose-400/14 text-rose-200">
                <UserRound className="h-8 w-8" />
              </div>
              <div className="text-sm font-bold text-rose-200">{t("nutritionProfileHome.access.badge")}</div>
              <h1 className="text-3xl font-black leading-tight text-white">{t("nutritionProfileHome.access.title")}</h1>
              <p className="text-sm leading-8 text-slate-200">
                {profileAccessMessage || t("nutritionProfileHome.access.defaultMessage")}
              </p>
            </div>
          </section>
        </div>
      </div>
    );
  }

  if (!isLoading && user && profileAccessMessage) {
    return (
      <div className="relative isolate min-h-screen overflow-hidden bg-[#06131d] px-4 py-8 text-white" dir={dir}>
        <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(248,113,113,0.16),transparent_24%),linear-gradient(180deg,rgba(6,19,29,0.96),rgba(4,10,17,1))]" />
        <div className="relative z-10 mx-auto max-w-md space-y-5">
          <NutritionTopbar backHref="/booking" title={t("nutritionProfileHome.access.topbarTitle")} description={t("nutritionProfileHome.access.topbarDescription")} hideBack />

          <section className="rounded-[34px] border border-rose-300/20 bg-[linear-gradient(160deg,rgba(127,29,29,0.35),rgba(24,24,27,0.92))] p-6 shadow-[0_30px_90px_-50px_rgba(248,113,113,0.45)]">
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[24px] bg-rose-400/14 text-rose-200">
                <UserRound className="h-8 w-8" />
              </div>
              <div className="text-sm font-bold text-rose-200">{t("nutritionProfileHome.access.badge")}</div>
              <h1 className="text-3xl font-black leading-tight text-white">{t("nutritionProfileHome.access.title")}</h1>
              <p className="text-sm leading-8 text-slate-200">{profileAccessMessage}</p>
            </div>
          </section>
        </div>
      </div>
    );
  }

  if (isLoading || loading) {
    return (
      <div className="relative isolate min-h-screen bg-[#06131d] text-white" dir={dir}>
        <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.18),transparent_25%),radial-gradient(circle_at_bottom_left,rgba(56,189,248,0.12),transparent_30%),linear-gradient(180deg,rgba(6,19,29,0.96),rgba(4,10,17,1))]" />
        <div className="relative z-10 flex min-h-screen items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-amber-300" />
        </div>
      </div>
    );
  }

  const profileCompleted = isNutritionProfileComplete(profile);
  const firstIncompleteProfileHref = getFirstIncompleteNutritionProfileHref(profile);
  const incompleteMembershipHref = profile ? firstIncompleteProfileHref : getFirstIncompleteNutritionDraftHref(formState);
  const activeSubscription = summary?.subscription ?? null;
  const subscriptionEndTime = activeSubscription?.endsAt ? new Date(activeSubscription.endsAt).getTime() : Number.NaN;
  const hasValidSubscriptionDate = !activeSubscription?.endsAt || (!Number.isNaN(subscriptionEndTime) && subscriptionEndTime >= Date.now());
  const hasUsableSubscription = Boolean(
    activeSubscription
      && activeSubscription.status === "active"
      && hasValidSubscriptionDate
      && ((activeSubscription.onlineDietRemaining ?? 0) > 0 || (activeSubscription.offlineDietRemaining ?? 0) > 0),
  );
  const firstAutoDietAvailable = Boolean(profileCompleted && !hasDietHistory && dietRequestNextStep === "/nutrition/diet-request/confirm");
  const dietStartHref = !profileCompleted
    ? firstIncompleteProfileHref ?? "/nutrition/membership/goal"
    : hasUsableSubscription
      ? dietRequestNextStep ?? (!hasDietHistory && !profile?.mindsetCompletedAt
          ? "/nutrition/membership/mindset/1"
          : hasDietHistory
            ? "/nutrition/diet-followup/1"
            : "/nutrition/diet-type")
      : "/nutrition/membership/packages?direct_buy=1";
  const hasPendingDietRequest = Boolean(activeDietRequest) && !currentPrescription;
  const hasCurrentPrescription = Boolean(currentPrescription);
  const currentPrescriptionDaysLeft = daysUntilPrescriptionEnds(currentPrescription?.endsAt);
  const renewalDaysRemaining = dietRenewal?.hasActiveDiet ? dietRenewal.daysRemaining : currentPrescriptionDaysLeft;
  const newDietBlockedByActiveDiet = Boolean(dietRenewal?.blocked) || (currentPrescription !== null && currentPrescriptionDaysLeft !== null && currentPrescriptionDaysLeft > 2);
  const currentWeight = currentPrescription?.currentWeightKg ?? activeDietRequest?.currentWeightKg ?? profile?.weightKg ?? null;
  const targetWeight = currentPrescription?.targetWeightKg ?? activeDietRequest?.targetWeightKg ?? profile?.targetWeightKg ?? null;
  const weeklyWeightChangeKg = currentPrescription?.weeklyWeightChangeKg ?? activeDietRequest?.weeklyWeightChangeKg ?? formState.weeklyWeightChangeKg;
  const weightDistance = currentWeight && targetWeight ? Math.abs(currentWeight - targetWeight) : null;
  const targetDateLabel = estimateWeeksToTarget(currentWeight, targetWeight, weeklyWeightChangeKg, t, format);
  const nextAppointmentDaysUntil = getDaysUntilAppointment(nextAppointment?.date);
  const nextAppointmentDaysLabel = formatDaysUntilLabel(nextAppointmentDaysUntil, t, format);
  const shouldShowProfileInfoCard = !hasCurrentPrescription && !hasPendingDietRequest;
  const profileActiveDate = resolveProfileActiveDate(currentPrescription);
  const currentPrescriptionSupportsDailyOverview = currentPrescription?.prescriptionMode === "daily_prescription" || currentPrescription?.prescriptionMode === "user_choice";
  const profileDailySummary = buildDailyNutritionSummary(currentPrescription, profileActiveDate);
  const profileDailyCalorieTarget = resolveDailyCalorieTarget(currentPrescription);
  const prescriptionProgressLabel = resolvePrescriptionProgressLabel(currentPrescription, profileActiveDate, t, format);
  const profileExerciseHref = profileActiveDate
    ? `/nutrition/my-diet/exercises?date=${encodeURIComponent(profileActiveDate)}`
    : "/nutrition/my-diet/exercises";
  const exerciseLoggingEnabled = currentPrescription?.exerciseLoggingEnabled !== false;
  const profileExerciseLogs = (currentPrescription?.exerciseLogs ?? []).filter((log) => log.consumedDate === profileActiveDate);
  const profileMealShortcutItems = buildProfileMealShortcutItems(currentPrescription, profileActiveDate, t, format);
  const remainingOnlineDiets = activeSubscription?.onlineDietRemaining ?? 0;
  const remainingOfflineDiets = activeSubscription?.offlineDietRemaining ?? 0;
  const totalRemainingDiets = remainingOnlineDiets + remainingOfflineDiets;
  const currentWeightProgress = currentWeight && targetWeight
    ? clampPercent(targetWeight >= currentWeight ? (currentWeight / targetWeight) * 100 : (targetWeight / currentWeight) * 100)
    : 68;
  const primaryActionTitle = hasCurrentPrescription
    ? t("nutritionProfileHome.primary.readyTitle")
    : hasPendingDietRequest
      ? t("nutritionProfileHome.primary.pendingTitle")
      : !profileCompleted
        ? t("nutritionProfileHome.primary.incompleteMembershipTitle")
        : t("nutritionProfileHome.primary.startTitle");
  const primaryActionDescription = hasCurrentPrescription
    ? t("nutritionProfileHome.primary.readyDescription")
    : hasPendingDietRequest
    ? t("nutritionProfileHome.primary.pendingDescription")
    : !profileCompleted
    ? t("nutritionProfileHome.primary.incompleteProfileDescription")
    : !hasUsableSubscription
    ? t("nutritionProfileHome.primary.noPackageDescription")
    : t("nutritionProfileHome.primary.startDescription");
  const primaryActionHref = hasCurrentPrescription ? "/nutrition/my-diet" : hasPendingDietRequest ? "" : dietStartHref;
  const handleNewDietRequestNavigation = () => {
    if (hasPendingDietRequest) {
      toast({
        variant: "destructive",
        title: t("nutritionProfileHome.toast.newRequestBlockedTitle"),
        description: t("nutritionProfileHome.toast.newRequestBlockedDescription"),
      });
      return;
    }

    if (newDietBlockedByActiveDiet) {
      toast({
        variant: "destructive",
        title: t("nutritionProfileHome.toast.activeDietStillRunningTitle"),
        description: t("nutritionProfileHome.toast.activeDietStillRunningDescription", {
          days: format.number(Math.max(0, renewalDaysRemaining ?? 0), { maximumFractionDigits: 0 }),
        }),
      });
      return;
    }

    if (!profileCompleted && firstIncompleteProfileHref) {
      syncNutritionProfileFormState(profile);
      toast({
        title: t("nutritionProfileHome.toast.incompleteProfileTitle"),
        description: t("nutritionProfileHome.toast.incompleteProfileDescription"),
      });
    }

    if (firstAutoDietAvailable) {
      updateNutritionFormState({
        dietRequestMode: "ai",
        selectedDietTemplateId: undefined,
        selectedDietTemplateName: undefined,
        expertRequestDescription: undefined,
        repeatDietFlowRequired: false,
        repeatDietCheckinCompleted: undefined,
        repeatDietAnswers: undefined,
        repeatDietWeightKg: undefined,
        repeatDietMedicalNotes: undefined,
        repeatDietMedicalConditionsItems: undefined,
      });
    }

    setLocation(hasUsableSubscription ? dietStartHref : "/nutrition/membership/packages?direct_buy=1");
  };

  const shortcuts = [
    { title: t("nutritionProfileHome.shortcuts.myDiets"), href: "/nutrition/my-diets", icon: ClipboardList, active: Boolean(activeSubscription || currentPrescription || latestDietRequest) },
    ...(currentPrescription && exerciseLoggingEnabled
      ? [{ title: t("nutritionProfileHome.shortcuts.exercise"), href: profileExerciseHref, icon: Dumbbell, active: true }]
      : []),
    { title: "BMI", href: "/nutrition/bmi", icon: Calculator, active: true },
    ...(chatModuleActive
      ? [{ title: t("nutritionProfileHome.shortcuts.onlineChat"), href: "/support/chat", icon: MessageCircleMore, active: true, badge: onlineChatUnreadCount > 0 ? onlineChatUnreadCount : null }]
      : []),
    ...(storeModuleActive ? [{ title: t("nutritionProfileHome.shortcuts.store"), href: "/store", icon: Store, active: true }] : []),
    ...(bookingShortcutActive
      ? [{ title: t("nutritionProfileHome.shortcuts.booking"), href: "/booking", icon: CalendarDays, active: true }]
      : []),
  ].slice(0, 3);

  const bottomItems = [
    { title: t("nutritionProfileHome.bottom.home"), icon: Home, active: true, current: true, href: "/nutrition/profile" },
    { title: t("nutritionProfileHome.bottom.diets"), icon: ClipboardList, active: true, current: false, href: "/nutrition/my-diets" },
    { title: t("nutritionProfileHome.bottom.newDiet"), icon: Plus, active: true, href: dietStartHref, prominent: true, onSelect: handleNewDietRequestNavigation },
    { title: t("nutritionProfileHome.bottom.profile"), icon: UserRound, active: true, current: false, href: "/nutrition/membership/review?edit_only=1&from=profile_home" },
    { title: t("nutritionProfileHome.bottom.packages"), icon: Package2, active: true, current: false, href: "/nutrition/membership/my-package" },
  ];
  const profileMenuItems = [
    { key: "home", title: t("nutritionProfileHome.menu.home"), icon: Home, href: "/nutrition/profile" },
    { key: "diets", title: t("nutritionProfileHome.menu.diets"), icon: ClipboardList, href: "/nutrition/my-diets" },
    { key: "new-diet", title: t("nutritionProfileHome.menu.newDiet"), icon: Plus, href: dietStartHref, onSelect: handleNewDietRequestNavigation },
    { key: "profile", title: t("nutritionProfileHome.menu.editProfile"), icon: UserRound, href: "/nutrition/membership/review?edit_only=1&from=profile_home" },
    { key: "packages", title: t("nutritionProfileHome.menu.packages"), icon: Package2, href: "/nutrition/membership/my-package" },
    { key: "bmi", title: t("nutritionProfileHome.menu.bmi"), icon: Calculator, href: "/nutrition/bmi" },
    ...publicMenuItems,
  ].map((item) => ({
    ...item,
    onSelect: () => navigateFromMenu(item.href, "onSelect" in item ? item.onSelect : undefined),
  }));

  return (
    <div className="relative isolate min-h-screen overflow-x-clip bg-[#06131d] px-4 py-8 pb-44 text-white max-[430px]:px-3 max-[430px]:py-5 max-[430px]:pb-36" dir={dir}>
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.18),transparent_25%),radial-gradient(circle_at_bottom_left,rgba(56,189,248,0.12),transparent_30%),linear-gradient(180deg,rgba(6,19,29,0.96),rgba(4,10,17,1))]" />
      <div className="fixed start-[-18%] top-24 -z-10 h-64 w-64 rounded-full bg-amber-400/10 blur-3xl" />
      <div className="fixed bottom-24 end-[-20%] -z-10 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />

      <div className="relative z-10 mx-auto max-w-md space-y-4 max-[430px]:space-y-3">
        <header className="flex items-center justify-between gap-3">
          <div className="min-w-0 text-start">
            <div className="text-[11px] font-bold text-slate-400 max-[430px]:text-[10px]">{t("nutritionProfileHome.header.welcome")}</div>
            <div className="mt-1 truncate text-lg font-black text-white max-[430px]:text-base">{user?.name?.trim() || t("nutritionProfileHome.header.defaultUser")}</div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {user ? <NotificationBell onClick={() => setLocation("/notifications")} className="text-white" /> : null}
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="flex h-11 w-11 items-center justify-center rounded-[18px] border border-white/12 bg-white/[0.045] text-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition hover:border-amber-300/20 hover:text-white max-[430px]:h-10 max-[430px]:w-10 max-[430px]:rounded-[16px]"
              title={t("common.menu")}
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </header>

        <MobileSiteMenu
          open={menuOpen}
          onOpenChange={setMenuOpen}
          title={t("nutritionProfileHome.access.topbarTitle")}
          user={user}
          items={profileMenuItems}
          logoutAction={user ? async () => {
            setMenuOpen(false);
            await logout();
            setLocation("/nutrition");
          } : null}
        />

        <section className="rounded-[34px] border border-white/10 bg-[linear-gradient(160deg,rgba(17,24,39,0.98),rgba(9,14,22,0.98))] p-5 shadow-[0_35px_90px_-52px_rgba(0,0,0,0.95)] max-[430px]:rounded-[28px] max-[430px]:p-4">
          <div className="flex items-start justify-between gap-3 max-[430px]:items-center max-[430px]:gap-2">
            <button
              type="button"
              onClick={() => setLocation("/nutrition/membership/review?edit_only=1&from=profile_home")}
              className="inline-flex items-center gap-2 rounded-full border border-emerald-300/24 bg-emerald-300/12 px-4 py-2 text-[11px] font-black text-emerald-200 max-[430px]:gap-1.5 max-[430px]:px-3 max-[430px]:py-1.5 max-[430px]:text-[10px]"
            >
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-300 shadow-[0_0_16px_rgba(52,211,153,0.75)] max-[430px]:h-2 max-[430px]:w-2" />
              {t("nutritionProfileHome.summary.goal", { goal: formatGoalLabel(profile?.dietGoal, t) })}
            </button>
            <div className="inline-flex min-w-0 items-center gap-2 rounded-full px-2 py-1 text-[13px] font-black text-slate-300 max-[430px]:gap-1.5 max-[430px]:text-[11px]">
              <Sparkles className="h-4 w-4 shrink-0 fill-amber-300 text-amber-300 max-[430px]:h-3.5 max-[430px]:w-3.5" />
              {activeSubscription?.package?.name
                ? t("nutritionProfileHome.summary.activePackage", { name: activeSubscription.package.name })
                : t("nutritionProfileHome.summary.noActivePackage")}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-[minmax(0,1fr)_132px] items-center gap-5 max-[430px]:mt-4 max-[430px]:grid-cols-[minmax(0,1fr)_102px] max-[430px]:gap-3">
            <div className="space-y-1">
              <div className="grid grid-cols-[auto_1fr] items-center gap-x-6 border-b border-white/8 py-3 max-[430px]:gap-x-3 max-[430px]:py-2">
                <div className="text-lg font-black text-white max-[430px]:text-[15px]">{t("nutritionProfileHome.kgValue", { count: formatProfileNumber(format, weightDistance) })}</div>
                <div className="text-[13px] font-bold text-slate-400 max-[430px]:text-[10px]">{getGoalDistanceLabel(profile?.dietGoal, t)}</div>
              </div>
              <div className="grid grid-cols-[auto_1fr] items-center gap-x-6 border-b border-white/8 py-3 max-[430px]:gap-x-3 max-[430px]:py-2">
                <div className="text-lg font-black text-white max-[430px]:text-[15px]">{targetDateLabel}</div>
                <div className="text-[13px] font-bold text-slate-400 max-[430px]:text-[10px]">{t("nutritionProfileHome.summary.toTargetWeight")}</div>
              </div>
              <div className="grid grid-cols-[auto_1fr] items-center gap-x-6 py-3 max-[430px]:gap-x-3 max-[430px]:py-2">
                <div className="text-lg font-black text-amber-300 max-[430px]:text-[15px]">{format.number(totalRemainingDiets, { maximumFractionDigits: 0 })}</div>
                <div className="text-[13px] font-bold text-slate-400 max-[430px]:text-[10px]">{t("nutritionProfileHome.summary.remainingDiets")}</div>
              </div>
            </div>

            <div className="mx-auto flex h-32 w-32 items-center justify-center rounded-full bg-[conic-gradient(#f4ad22_var(--weight-progress),rgba(255,255,255,0.08)_0)] p-3 max-[430px]:h-24 max-[430px]:w-24 max-[430px]:p-2" style={{ "--weight-progress": `${currentWeightProgress}%` } as CSSProperties}>
              <div className="flex h-full w-full min-w-0 flex-col items-center justify-center overflow-hidden rounded-full border border-white/10 bg-[#111821] px-2 text-center shadow-[inset_0_0_0_10px_rgba(255,255,255,0.035)] max-[430px]:shadow-[inset_0_0_0_7px_rgba(255,255,255,0.035)]">
                <div className="max-w-full whitespace-nowrap text-[22px] font-black leading-none text-white max-[430px]:text-base">{formatProfileNumber(format, currentWeight)}</div>
                <div className="mt-1 text-[10px] font-bold text-slate-400 max-[430px]:text-[8px]">{t("nutritionProfileHome.summary.currentKg")}</div>
                <div className="mt-1 max-w-[92px] truncate whitespace-nowrap text-[10px] font-black text-amber-300 max-[430px]:max-w-[66px] max-[430px]:text-[8px]">{t("nutritionProfileHome.summary.toTargetKg", { count: formatProfileNumber(format, weightDistance) })}</div>
              </div>
            </div>
          </div>
        </section>

        {hasCurrentPrescription ? (
          <NutritionProfileActiveDietCta onOpenDiet={() => setLocation("/nutrition/my-diet")} t={t} isRtl={isRtl} />
        ) : (
          <button
            type="button"
            onClick={() => {
              if (hasPendingDietRequest) {
                toast({
                  variant: "destructive",
                  title: t("nutritionProfileHome.toast.newRequestBlockedTitle"),
                  description: t("nutritionProfileHome.toast.newRequestBlockedDescription"),
                });
                return;
              }

              if (!profileCompleted && firstIncompleteProfileHref && primaryActionHref === firstIncompleteProfileHref) {
                syncNutritionProfileFormState(profile);
                toast({
                  title: t("nutritionProfileHome.toast.incompleteProfileTitle"),
                  description: t("nutritionProfileHome.toast.incompleteProfileDescription"),
                });
              }

              if (primaryActionHref) {
                setLocation(primaryActionHref);
              }
            }}
            className="group flex w-full items-center justify-between gap-4 rounded-[30px] bg-[linear-gradient(145deg,#f7c756,#eba01c_58%,#d98710)] p-4 text-start text-slate-950 shadow-[0_26px_70px_-42px_rgba(251,191,36,0.95)] transition hover:-translate-y-0.5 max-[430px]:gap-3 max-[430px]:rounded-[24px] max-[430px]:p-3"
          >
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[20px] bg-slate-950/18 text-slate-950 max-[430px]:h-12 max-[430px]:w-12 max-[430px]:rounded-[16px]">
              <Bot className="h-8 w-8 max-[430px]:h-6 max-[430px]:w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-lg font-black max-[430px]:text-base">{primaryActionTitle}</div>
              <div className="mt-1 text-[11px] font-bold leading-6 text-slate-900/75 max-[430px]:text-[10px] max-[430px]:leading-5">{primaryActionDescription}</div>
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-slate-950 text-amber-300 transition group-hover:translate-x-[-2px] max-[430px]:h-10 max-[430px]:w-10 max-[430px]:rounded-[15px]">
              <ForwardArrow className="h-5 w-5 max-[430px]:h-4 max-[430px]:w-4" />
            </div>
          </button>
        )}

        {hasCurrentPrescription ? (
          <div ref={dietTabsRef} className="h-[81px]">
            <nav
              className={`z-50 grid border border-white/10 bg-[#11140f]/95 shadow-[0_14px_36px_-24px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl transition-[height,border-radius,padding] duration-200 ${exerciseLoggingEnabled ? "grid-cols-3" : "grid-cols-2"} ${dietTabsCompact ? "fixed left-1/2 top-0 w-[calc(100%-24px)] max-w-md -translate-x-1/2 gap-0 rounded-b-[16px] border-t-0 p-1" : "relative w-full gap-1 rounded-[24px] p-1.5"}`}
              aria-label={t("nutritionProfileHome.quickAccess.title")}
            >
            <button
              type="button"
              onClick={() => setActiveDietDashboardTab("nutrition")}
              className={`flex w-full flex-col items-center justify-center font-black transition-all ${dietTabsCompact ? "h-10 gap-0.5 rounded-[11px] text-[8px]" : "h-[68px] gap-1.5 rounded-[21px] text-[11px]"} ${activeDietDashboardTab === "nutrition" ? "bg-[#292a23] text-amber-300" : "text-stone-500 hover:text-stone-300"}`}
            >
              <UtensilsCrossed className={dietTabsCompact ? "h-3.5 w-3.5" : "h-5 w-5"} />
              {t("nutritionProfileHome.section.food")}
            </button>
            {exerciseLoggingEnabled ? (
              <button
                type="button"
                onClick={() => setActiveDietDashboardTab("exercise")}
                className={`flex w-full flex-col items-center justify-center font-black transition-all ${dietTabsCompact ? "h-10 gap-0.5 rounded-[11px] text-[8px]" : "h-[68px] gap-1.5 rounded-[21px] text-[11px]"} ${activeDietDashboardTab === "exercise" ? "bg-[#292a23] text-amber-300" : "text-stone-500 hover:text-stone-300"}`}
              >
                <Dumbbell className={dietTabsCompact ? "h-3.5 w-3.5" : "h-5 w-5"} />
                {t("nutritionProfileHome.section.exercise")}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setActiveDietDashboardTab("quick")}
              className={`flex w-full flex-col items-center justify-center font-black transition-all ${dietTabsCompact ? "h-10 gap-0.5 rounded-[11px] text-[8px]" : "h-[68px] gap-1.5 rounded-[21px] text-[11px]"} ${activeDietDashboardTab === "quick" ? "bg-[#292a23] text-amber-300" : "text-stone-500 hover:text-stone-300"}`}
            >
              <Zap className={dietTabsCompact ? "h-3.5 w-3.5" : "h-5 w-5"} />
              {t("nutritionProfileHome.quickAccess.title")}
            </button>
            </nav>
          </div>
        ) : null}

        {nextAppointment && (!hasCurrentPrescription || activeDietDashboardTab === "quick") ? (
          <section className="rounded-[32px] border border-cyan-300/18 bg-[linear-gradient(160deg,rgba(34,211,238,0.14),rgba(255,255,255,0.04))] p-5 shadow-[0_30px_80px_-48px_rgba(34,211,238,0.4)]">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-[11px] font-black text-cyan-100">
                  <CalendarDays className="h-3.5 w-3.5 text-cyan-300" />
                  {t("nutritionProfileHome.appointment.badge")}
                </div>
                <div className="text-xl font-black text-white">{nextAppointmentDaysLabel}</div>
                <div className="text-sm leading-7 text-cyan-50/85">
                  {t("nutritionProfileHome.appointment.description")}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCancelAppointmentOpen(true)}
                className="rounded-[18px] border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm font-black text-red-100 disabled:opacity-60"
              >
                {t("nutritionProfileHome.appointment.cancel")}
              </button>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="rounded-[22px] bg-white/5 px-3 py-3">
                <div className="text-[11px] font-bold text-slate-400">{t("nutritionProfileHome.appointment.date")}</div>
                <div className="mt-2 text-sm font-black leading-7 text-white">{formatAppointmentDate(nextAppointment.date, format)}</div>
              </div>
              <div className="rounded-[22px] bg-white/5 px-3 py-3">
                <div className="text-[11px] font-bold text-slate-400">{t("nutritionProfileHome.appointment.section")}</div>
                <div className="mt-2 text-sm font-black leading-7 text-white">{nextAppointment.sectionName || t("common.notSet")}</div>
              </div>
              <div className="rounded-[22px] bg-white/5 px-3 py-3">
                <div className="text-[11px] font-bold text-slate-400">{t("nutritionProfileHome.appointment.time")}</div>
                <div className="mt-2 text-sm font-black leading-7 text-white">
                  <bdi>{nextAppointment.startTime}</bdi>
                  {t("common.rangeTo")}
                  <bdi>{nextAppointment.endTime}</bdi>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {currentPrescription && currentPrescriptionSupportsDailyOverview && activeDietDashboardTab === "nutrition" ? (
          <>
            <NutritionProfileDailyOverviewCard
              summary={profileDailySummary}
              activeDate={profileActiveDate}
              dailyCalorieTarget={profileDailyCalorieTarget}
              progressLabel={prescriptionProgressLabel}
              t={t}
              format={format}
            />
          </>
        ) : null}

        {currentPrescription && currentPrescriptionSupportsDailyOverview && profileMealShortcutItems.length > 0 && activeDietDashboardTab === "nutrition" ? (
          <NutritionProfileMealShortcutsCard
            items={profileMealShortcutItems}
            onOpenMeal={(mealKey) => setLocation(`/nutrition/my-diet?mea=${encodeURIComponent(mealKey)}`)}
            t={t}
            isRtl={isRtl}
          />
        ) : null}

        {currentPrescription && exerciseLoggingEnabled && activeDietDashboardTab === "exercise" ? (
          <NutritionProfileExerciseCard
              summary={profileDailySummary}
              activeDate={profileActiveDate}
              logs={profileExerciseLogs}
              onOpen={() => setLocation(profileExerciseHref)}
              t={t}
              format={format}
          />
        ) : null}

        {nutritionAudienceSupportsManagerMessage && managerMessage && !managerMessageDismissed && (!hasCurrentPrescription || activeDietDashboardTab === "quick") ? (
          <section className="rounded-[32px] border border-cyan-300/15 bg-[linear-gradient(160deg,rgba(34,211,238,0.12),rgba(255,255,255,0.04))] p-5 shadow-[0_30px_80px_-48px_rgba(34,211,238,0.42)]">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-[11px] font-black text-cyan-100">
                  <MessageSquareQuote className="h-3.5 w-3.5 text-cyan-300" />
                  {t("nutritionProfileHome.managerMessage.badge")}
                </div>
                <div className="text-sm leading-8 text-slate-200">{managerMessage}</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (managerMessageStorageKey) {
                    window.localStorage.setItem(managerMessageStorageKey, "1");
                  }
                  setManagerMessageDismissed(true);
                }}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10"
                title={t("nutritionProfileHome.managerMessage.close")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </section>
        ) : null}

        {shouldShowProfileInfoCard ? (
          <section className="overflow-hidden rounded-[34px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-5 shadow-[0_28px_80px_-52px_rgba(0,0,0,0.95)] backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-cyan-300">{t("nutritionProfileHome.profileInfo.title")}</div>
                <div className="mt-1 text-xs text-slate-400">{t("nutritionProfileHome.profileInfo.description")}</div>
              </div>
              <button
                type="button"
                onClick={() => setLocation("/nutrition/membership/review?edit_only=1&from=profile_home")}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-bold text-white/70"
              >
                {t("nutritionProfileHome.profileInfo.edit")}
              </button>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3">
              <div className="rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.09),rgba(255,255,255,0.05))] p-3.5">
                <div className="text-[11px] font-bold text-slate-400">{t("nutritionProfileHome.profileInfo.currentWeight")}</div>
                <div className="mt-3 text-xl font-black">{formatProfileNumber(format, currentWeight)}</div>
                <div className="mt-1 text-[11px] text-slate-400">{t("nutritionProfileHome.kgUnit")}</div>
              </div>
              <div className="rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.09),rgba(255,255,255,0.05))] p-3.5">
                <div className="text-[11px] font-bold text-slate-400">{t("nutritionProfileHome.profileInfo.extraWeight")}</div>
                <div className="mt-3 text-xl font-black">{formatProfileNumber(format, weightDistance)}</div>
                <div className="mt-1 text-[11px] text-slate-400">{t("nutritionProfileHome.kgUnit")}</div>
              </div>
              <div className="rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.09),rgba(255,255,255,0.05))] p-3.5">
                <div className="text-[11px] font-bold text-slate-400">{t("nutritionProfileHome.profileInfo.targetTime")}</div>
                <div className="mt-3 text-sm font-black leading-6">{targetDateLabel}</div>
              </div>
            </div>
          </section>
        ) : null}

        {(!hasCurrentPrescription || activeDietDashboardTab === "quick") ? <section className="mb-3">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[17px] font-black text-white">{t("nutritionProfileHome.quickAccess.title")}</h2>
            <button
              type="button"
              onClick={() => setLocation("/nutrition/membership/review?edit_only=1&from=profile_home")}
              className="text-[11px] font-black text-slate-400 transition hover:text-white"
            >
              {t("nutritionProfileHome.profileInfo.edit")}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {shortcuts.map((shortcut) => {
              const Icon = shortcut.icon;
              return (
                <button
                  key={shortcut.title}
                  type="button"
                  onClick={() => {
                    if (shortcut.active && shortcut.href) {
                      setLocation(shortcut.href);
                    }
                  }}
                  className={`flex h-[94px] w-full flex-col items-center justify-center rounded-[20px] border p-2.5 text-center transition ${
                    shortcut.active
                      ? "border-white/10 bg-[linear-gradient(160deg,rgba(255,255,255,0.085),rgba(255,255,255,0.035))] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_22px_55px_-45px_rgba(0,0,0,0.95)] hover:-translate-y-0.5 hover:border-amber-300/30"
                      : "border-white/6 bg-white/[0.03] opacity-60"
                  }`}
                >
                  <div className="relative inline-flex">
                    <div className="flex h-11 w-11 items-center justify-center rounded-[15px] bg-amber-300/10 text-amber-300">
                      <Icon className="h-5 w-5" />
                    </div>
                    {shortcut.badge ? (
                      <div className="absolute -start-2 -top-2 inline-flex min-w-5 items-center justify-center rounded-full border border-[#06131d] bg-rose-500 px-1.5 py-0.5 text-[10px] font-black text-white shadow-[0_10px_24px_-14px_rgba(244,63,94,0.95)]">
                        {format.number(Number(shortcut.badge), { maximumFractionDigits: 0 })}
                      </div>
                      ) : null}
                  </div>
                  <div className="mt-2 text-[10px] font-black leading-4 text-white/95">{shortcut.title}</div>
                </button>
              );
            })}
          </div>
        </section> : null}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 px-4 pb-4 sm:inset-x-auto sm:left-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:px-0 max-[430px]:px-3 max-[430px]:pb-3">
        <div className="mx-auto max-w-md">
          <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(20,27,34,0.92),rgba(9,14,20,0.98))] px-4 py-3 shadow-[0_24px_60px_-28px_rgba(0,0,0,0.95)] backdrop-blur-2xl max-[430px]:rounded-[24px] max-[430px]:px-2.5 max-[430px]:py-2">
            <div className="grid grid-cols-5 items-end gap-1">
              {bottomItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.title}
                    type="button"
                    onClick={() => {
                      if (item.active && item.href) {
                        if (item.onSelect) {
                          item.onSelect();
                          return;
                        }
                        setLocation(item.href);
                      }
                    }}
                    className={`relative rounded-[20px] px-1 py-2 text-center transition max-[430px]:py-1 ${
                      item.prominent
                        ? "-mt-8 text-amber-300 max-[430px]:-mt-7"
                        : item.current
                        ? "text-amber-300"
                        : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    <div className={`mx-auto flex items-center justify-center ${
                      item.prominent
                        ? "h-16 w-16 rounded-[22px] bg-[linear-gradient(145deg,#f7c756,#e79b18)] text-slate-950 shadow-[0_18px_42px_-22px_rgba(251,191,36,0.95)] max-[430px]:h-[52px] max-[430px]:w-[52px] max-[430px]:rounded-[18px]"
                        : "h-10 w-10 rounded-[16px] bg-white/5 max-[430px]:h-8 max-[430px]:w-8 max-[430px]:rounded-[13px]"
                    }`}>
                      <Icon className={item.prominent ? "h-7 w-7 max-[430px]:h-5 max-[430px]:w-5" : "h-5 w-5 max-[430px]:h-4 max-[430px]:w-4"} />
                    </div>
                    <div className={`mt-2 font-bold max-[430px]:mt-1 ${item.prominent ? "text-[11px] max-[430px]:text-[9px]" : "text-[10px] max-[430px]:text-[8px]"}`}>{item.title}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <CancelModal
        isOpen={cancelAppointmentOpen}
        onClose={async () => {
          setCancelAppointmentOpen(false);
          await loadDashboard({ silent: true });
        }}
        appointment={nextAppointment}
      />

      <Dialog open={incompleteMembershipOpen} onOpenChange={setIncompleteMembershipOpen}>
        <DialogContent
          dir={dir}
          className="max-w-[calc(100vw-32px)] overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(155deg,#101d2b_0%,#09131f_55%,#07101a_100%)] p-0 text-white shadow-[0_36px_100px_-34px_rgba(14,165,233,0.42)] sm:max-w-[390px] [&>button[data-dialog-close]]:!left-4 [&>button[data-dialog-close]]:!right-auto [&>button[data-dialog-close]]:!top-4 [&>button[data-dialog-close]]:flex [&>button[data-dialog-close]]:h-10 [&>button[data-dialog-close]]:w-10 [&>button[data-dialog-close]]:items-center [&>button[data-dialog-close]]:justify-center [&>button[data-dialog-close]]:rounded-full [&>button[data-dialog-close]]:border [&>button[data-dialog-close]]:border-white/10 [&>button[data-dialog-close]]:bg-white/[0.06] [&>button[data-dialog-close]]:text-slate-300 [&>button[data-dialog-close]]:opacity-100 [&>button[data-dialog-close]]:backdrop-blur-md [&>button[data-dialog-close]]:hover:bg-white/10 [&>button[data-dialog-close]_svg]:h-5 [&>button[data-dialog-close]_svg]:w-5"
        >
          <div className="relative px-6 pb-6 pt-7">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.18),transparent_56%),radial-gradient(circle_at_top_left,rgba(251,191,36,0.1),transparent_48%)]" />
            <div className="relative mx-auto flex h-[68px] w-[68px] items-center justify-center rounded-[22px] border border-cyan-300/20 bg-cyan-300/10 text-cyan-200 shadow-[0_20px_50px_-28px_rgba(34,211,238,0.85)]">
              <UserRound className="h-8 w-8" />
              <span className="absolute -bottom-1 -end-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#0d1825] bg-amber-300 text-[15px] font-black text-slate-950">!</span>
            </div>
            <DialogHeader className="relative mt-5 items-center text-center sm:text-center">
              <DialogTitle className="text-center text-[21px] font-black leading-8 text-white">
                {t("nutritionWebAppEntry.incompleteProfile.title")}
              </DialogTitle>
            </DialogHeader>
            <p className="relative mx-auto mt-3 max-w-[315px] text-center text-[12px] font-semibold leading-7 text-slate-300">
              {t("nutritionWebAppEntry.incompleteProfile.description")}
            </p>
            <Button
              type="button"
              className="group relative mt-6 h-[54px] w-full overflow-hidden rounded-[18px] border border-amber-200/45 bg-[linear-gradient(135deg,#f5d477_0%,#eab84f_52%,#d99a2b_100%)] px-4 text-[14px] font-black text-[#251804] shadow-[0_20px_44px_-24px_rgba(245,183,63,0.8)] transition hover:brightness-105"
              onClick={() => setLocation(incompleteMembershipHref ?? "/nutrition/membership/goal")}
            >
              {t("nutritionWebAppEntry.incompleteProfile.action")}
              <span className="absolute end-3 flex h-9 w-9 items-center justify-center rounded-[12px] bg-[#7a4b0f]/12 ring-1 ring-[#6b410d]/10 transition-transform group-hover:-translate-x-0.5">
                <ForwardArrow className="h-4 w-4" />
              </span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dietRequestSuccessOpen} onOpenChange={setDietRequestSuccessOpen}>
        <DialogContent
          dir={dir}
          className="max-w-[calc(100vw-32px)] overflow-hidden rounded-[26px] border-emerald-300/25 bg-[#0b1720] p-0 text-white shadow-[0_35px_100px_-35px_rgba(52,211,153,0.45)] sm:max-w-[380px]"
        >
          <div className="relative p-5 pt-7 text-center">
            <div className="absolute inset-x-0 top-0 h-32 bg-[radial-gradient(circle_at_top,rgba(52,211,153,0.22),transparent_68%)]" />
            <DialogHeader className="relative z-10 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] border border-emerald-300/25 bg-emerald-300/12 text-emerald-300 shadow-[0_20px_55px_-30px_rgba(52,211,153,0.9)]">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <DialogTitle className="mt-4 text-center text-[20px] font-black leading-8 text-white">
                {t("nutritionProfileHome.dietRequestSuccess.title")}
              </DialogTitle>
            </DialogHeader>

            <p className="relative z-10 mt-3 text-[12px] font-bold leading-7 text-slate-300">
              {t("nutritionProfileHome.dietRequestSuccess.description")}
            </p>

            <Button
              type="button"
              onClick={() => setDietRequestSuccessOpen(false)}
              className="relative z-10 mt-5 h-12 w-full rounded-[16px] bg-[linear-gradient(135deg,#34d399,#10b981)] text-[13px] font-black text-emerald-950 shadow-[0_24px_55px_-28px_rgba(52,211,153,0.95)] hover:opacity-95"
            >
              {t("nutritionProfileHome.dietRequestSuccess.confirm")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
