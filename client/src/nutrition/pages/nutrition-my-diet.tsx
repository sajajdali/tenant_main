import { Apple, ArrowDown, ArrowLeft, ArrowRight, BadgeCheck, Bell, CalendarRange, Camera, CheckCircle2, ChevronDown, CircleMinus, Clock3, Download, Droplets, Dumbbell, FileArchive, FileText, Flame, Frown, ImagePlus, List, Loader2, MoonStar, Paperclip, PencilLine, Pill, PlusCircle, RefreshCcw, Sparkles, Sun, Trash2, Utensils, Volume2, X } from "lucide-react";
import { Fragment, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { NutritionDietPrescription, NutritionMealPhotoAnalysis } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { exerciseIntensityLabel, getNutritionExerciseIcon } from "@/nutrition/lib/exercise-helpers";
import { subscribeNutritionMealReplacementSuggestionUpdates, subscribeUserNotificationInboxUpdates } from "@/lib/realtime";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { formatIsoDateInTimeZone } from "@/i18n/format";
import { useFormat, useLocale, useT } from "@/i18n/locale";

type ChangeFoodOption = {
  id: string;
  title: string;
  description: string;
  preparationText: string;
  quantityText: string;
  grams: number;
  calories: number;
  matchReason?: string | null;
};

type MealReplacementSuggestionState = NonNullable<NutritionDietPrescription["mealReplacementSuggestions"]>[number];
type Translator = ReturnType<typeof useT>;
type LocaleFormatter = ReturnType<typeof useFormat>;
type QuantityFormatContext = {
  t: Translator;
  format: LocaleFormatter;
};

type RegisteredMealConfirmation = {
  foodTitle: string;
  slotTitle: string;
  consumedDate: string;
  mode: "planned" | "extra" | "replacement";
};

function getModeLabel(mode: string | null | undefined, t: Translator) {
  if (mode === "user_choice") {
    return t("nutritionMyDiet.mode.userChoice");
  }
  if (mode === "fixed_text") {
    return t("nutritionMyDiet.mode.fixedText");
  }

  return t("nutritionMyDiet.mode.dailyPrescription");
}

function mealSlotLabel(slotKey: string | null | undefined, t: Translator) {
  switch (slotKey) {
    case "breakfast":
      return t("nutritionMyDiet.mealSlot.breakfast");
    case "morning_snack":
      return t("nutritionMyDiet.mealSlot.morningSnack");
    case "lunch":
      return t("nutritionMyDiet.mealSlot.lunch");
    case "afternoon_snack":
      return t("nutritionMyDiet.mealSlot.afternoonSnack");
    case "dinner":
      return t("nutritionMyDiet.mealSlot.dinner");
    case "night_snack":
      return t("nutritionMyDiet.mealSlot.nightSnack");
    default:
      return slotKey ? String(slotKey) : t("nutritionMyDiet.mealCard.defaultMeal");
  }
}

function normalizeMealSlotKey(value?: unknown) {
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

function mealSlotIcon(slotKey?: string | null, index = 0) {
  switch ((slotKey ?? "").trim()) {
    case "breakfast":
      return Sun;
    case "morning_snack":
    case "afternoon_snack":
    case "night_snack":
      return Sparkles;
    case "lunch":
      return Flame;
    case "dinner":
      return MoonStar;
    default:
      return index === 0 ? Sun : index === 1 ? Flame : MoonStar;
  }
}

function formatManualMetaText(value: unknown, t: Translator) {
  const raw = String(value ?? "").trim();
  if (raw === "") {
    return "";
  }

  return raw
    .split("|")
    .map((segment) => {
      const part = segment.trim();
      if (part === "") {
        return "";
      }
      if (/^(calories|protein_grams|fat_grams|carbohydrate_grams|fiber_grams):/.test(part)) {
        return "";
      }
      if (part.startsWith("ai_nutrition_reason:")) {
        return t("nutritionMyDiet.manualLog.aiEstimate", { value: part.slice("ai_nutrition_reason:".length).trim() });
      }
      if (part.startsWith("slot:")) {
        return t("nutritionMyDiet.manualLog.slot", { value: mealSlotLabel(part.slice(5).trim(), t) });
      }
      if (part.startsWith("note:replacement:")) {
        return t("nutritionMyDiet.manualLog.replacementNote", { value: part.slice("note:replacement:".length).trim() });
      }
      if (part.startsWith("note:manual:")) {
        return t("nutritionMyDiet.manualLog.note", { value: part.slice("note:manual:".length).trim() });
      }
      if (part.startsWith("note:")) {
        return t("nutritionMyDiet.manualLog.note", { value: part.slice(5).trim() });
      }
      if (part.startsWith("manual:")) {
        return t("nutritionMyDiet.manualLog.manual", { value: part.slice(7).trim() });
      }
      return part;
    })
    .filter(Boolean)
    .join(" | ");
}

function buildPreparationText(input: {
  title?: unknown;
  quantityText?: unknown;
  explicitPreparation?: unknown;
  description?: unknown;
  t: Translator;
  format: LocaleFormatter;
}) {
  const explicit = String(input.explicitPreparation ?? "").trim();
  if (explicit !== "") {
    return explicit;
  }

  const description = String(input.description ?? "").trim();
  if (description !== "") {
    return description;
  }

  const title = String(input.title ?? "").trim();
  const quantity = formatQuantityText(input.quantityText, { t: input.t, format: input.format });

  if (title === "" && quantity === "") {
    return "";
  }

  if (quantity !== "") {
    return input.t("nutritionMyDiet.mealDetails.prepareWithQuantity", { quantity, title }).trim();
  }

  return input.t("nutritionMyDiet.mealDetails.prepareTitle", { title }).trim();
}

function extractReplacementLabel(value?: string | null) {
  const raw = String(value ?? "").trim();
  const match = raw.match(/(?:^|\|)\s*note:replacement:([^|]+)/);

  return match ? match[1].trim() : "";
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

type MealLogView = {
  id: string;
  foodTitle?: string | null;
  quantityText?: string | null;
  foodDescription?: string | null;
  notes?: string | null;
  isManual?: boolean;
  manualEntryMethod?: string | null;
  photoUrl?: string | null;
  calories?: number | null;
  proteinGrams?: number | null;
  fatGrams?: number | null;
  carbohydrateGrams?: number | null;
  fiberGrams?: number | null;
  aiNutritionStatus?: string | null;
  aiNutritionError?: string | null;
};

function loggedCalories(log?: MealLogView | null) {
  const value = Number(log?.calories ?? 0);
  return Number.isFinite(value) && value > 0 ? value : extractLoggedCalories(log?.notes);
}

function loggedMacro(log: MealLogView | null | undefined, field: "proteinGrams" | "fatGrams" | "carbohydrateGrams" | "fiberGrams", noteKey: "protein_grams" | "fat_grams" | "carbohydrate_grams" | "fiber_grams") {
  const value = Number(log?.[field] ?? 0);
  return Number.isFinite(value) && value > 0 ? value : extractLoggedMacro(log?.notes, noteKey);
}

function macroValue(source: Record<string, unknown>, key: "protein_grams" | "fat_grams" | "carbohydrate_grams" | "fiber_grams") {
  const value = Number(source[key] ?? 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function macroMetrics(source: Record<string, unknown> | null | undefined, notes: string | null | undefined, t: Translator) {
  const record = source ?? {};

  return [
    { key: "protein_grams" as const, label: t("nutritionMyDiet.overview.macro.protein"), value: macroValue(record, "protein_grams") || extractLoggedMacro(notes, "protein_grams") },
    { key: "fat_grams" as const, label: t("nutritionMyDiet.overview.macro.fat"), value: macroValue(record, "fat_grams") || extractLoggedMacro(notes, "fat_grams") },
    { key: "carbohydrate_grams" as const, label: t("nutritionMyDiet.overview.macro.carbohydrate"), value: macroValue(record, "carbohydrate_grams") || extractLoggedMacro(notes, "carbohydrate_grams") },
    { key: "fiber_grams" as const, label: t("nutritionMyDiet.overview.macro.fiber"), value: macroValue(record, "fiber_grams") || extractLoggedMacro(notes, "fiber_grams") },
  ].filter((item) => item.value > 0);
}

function MacroNutrientPills({ source, notes, compact = false }: { source?: Record<string, unknown> | null; notes?: string | null; compact?: boolean }) {
  const t = useT();
  const format = useFormat();
  const items = macroMetrics(source, notes, t);

  if (items.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex flex-wrap gap-1.5", compact ? "mt-2" : "mt-3")}>
      {items.map((item) => (
        <span
          key={item.key}
          className="inline-flex rounded-full border border-white/10 bg-white/[0.045] px-2.5 py-1 text-[10px] font-black text-slate-200"
        >
          {item.label}: {format.number(item.value, { maximumFractionDigits: 1 })}g
        </span>
      ))}
    </div>
  );
}

function NutritionMealChoiceBadge({ index, selected = false }: { index: number; selected?: boolean }) {
  const t = useT();
  const format = useFormat();

  return (
    <div
      className={cn(
        "flex h-[44px] w-[44px] shrink-0 flex-col items-center justify-center rounded-[14px] leading-none shadow-[0_16px_32px_-26px_rgba(0,0,0,0.95)]",
        selected
          ? "bg-emerald-400/16 text-emerald-200"
          : "bg-amber-300/12 text-amber-300",
      )}
    >
      <span className="text-[9px] font-extrabold leading-3">{t("nutritionMyDiet.mealCard.choice")}</span>
      <span className="text-[20px] font-extrabold leading-5">{format.number(index, { maximumFractionDigits: 0 })}</span>
    </div>
  );
}

function NutritionMealNumberBadge({ index, selected = false }: { index: number; selected?: boolean }) {
  const format = useFormat();

  return (
    <div
      className={cn(
        "flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[14px] text-[17px] font-extrabold shadow-[0_16px_32px_-26px_rgba(0,0,0,0.95)]",
        selected
          ? "bg-emerald-400/16 text-emerald-200"
          : "bg-amber-300/12 text-amber-300",
      )}
    >
      {format.number(index, { maximumFractionDigits: 0 })}
    </div>
  );
}

function NutritionMealMacroGrid({
  source,
  notes,
  calories,
}: {
  source?: Record<string, unknown> | null;
  notes?: string | null;
  calories?: number | string | null;
}) {
  const record = source ?? {};
  const t = useT();
  const format = useFormat();
  const [open, setOpen] = useState(false);
  const calorieValue = Number(calories ?? record["calories"] ?? 0);
  const items = [
    Number.isFinite(calorieValue) && calorieValue > 0
      ? { key: "calories", label: t("nutritionMyDiet.mealDetails.calories"), value: calorieValue, tone: "amber" as const, unit: "kcal", icon: <Flame className="h-4 w-4" /> }
      : null,
    ...macroMetrics(source, notes, t).map((item) => ({
      ...item,
      tone: item.key === "protein_grams" ? "emerald" as const : item.key === "fat_grams" ? "rose" as const : item.key === "fiber_grams" ? "cyan" as const : "yellow" as const,
      unit: "g",
      icon: item.key === "protein_grams"
        ? <Dumbbell className="h-4 w-4" />
        : item.key === "fat_grams"
          ? <Droplets className="h-4 w-4" />
          : item.key === "fiber_grams"
            ? <List className="h-4 w-4" />
            : <Sparkles className="h-4 w-4" />,
    })),
  ].filter(Boolean) as Array<{ key: string; label: string; value: number; tone: "amber" | "emerald" | "rose" | "cyan" | "yellow"; unit: string; icon: ReactNode }>;

  if (items.length === 0) {
    return null;
  }

  const toneClass = {
    amber: "border-amber-300/28 bg-amber-300/10 text-amber-200",
    emerald: "border-emerald-300/20 bg-white/[0.045] text-slate-200",
    rose: "border-rose-300/20 bg-white/[0.045] text-slate-200",
    cyan: "border-cyan-300/20 bg-white/[0.045] text-slate-200",
    yellow: "border-yellow-300/20 bg-white/[0.045] text-slate-200",
  };
  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-[14px] border border-white/10 bg-white/[0.055] px-4 text-[11px] font-extrabold text-slate-200 transition hover:border-amber-300/24 hover:bg-white/[0.08]"
        aria-expanded={open}
      >
        <span className="inline-flex items-center gap-2">
          <Flame className="h-3.5 w-3.5 text-rose-300" />
          {t("nutritionMyDiet.mealDetails.nutritionTable")}
        </span>
        <ChevronDown className={cn("h-4 w-4 transition-transform", open ? "rotate-180" : "")} />
      </button>

      {open ? (
        <div className="mt-2.5 overflow-hidden rounded-[16px] border border-white/10 bg-slate-950/35">
          <div className="grid grid-cols-[1fr_auto] gap-4 border-b border-white/10 bg-white/[0.045] px-4 py-2.5 text-[10px] font-bold text-slate-400">
            <span>{t("nutritionMyDiet.mealDetails.nutrient")}</span>
            <span>{t("nutritionMyDiet.mealDetails.amount")}</span>
          </div>
          {items.map((item, index) => (
            <div key={item.key} className={cn("grid grid-cols-[1fr_auto] items-center gap-4 px-4 py-3", index > 0 && "border-t border-white/[0.07]")}>
              <span className="inline-flex items-center gap-2.5 text-[12px] font-bold text-slate-200">
                <span className={cn("flex h-8 w-8 items-center justify-center rounded-[10px] border", toneClass[item.tone])}>{item.icon}</span>
                {item.label}
              </span>
              <span dir="ltr" className="text-[13px] font-black tabular-nums text-white">
                {format.number(item.value, { maximumFractionDigits: 1 })} <span className="text-[10px] text-slate-400">{item.unit}</span>
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function NutritionMealDetailsBlock({
  title,
  description,
  descriptionTone = "default",
  preparationText,
  quantityText,
  rawQuantityText,
  source,
  notes,
  calories,
  action,
}: {
  title?: unknown;
  description?: unknown;
  descriptionTone?: "default" | "foodTitle";
  preparationText?: string;
  quantityText?: ReactNode;
  rawQuantityText?: unknown;
  source?: Record<string, unknown> | null;
  notes?: string | null;
  calories?: number | string | null;
  action?: ReactNode;
}) {
  const t = useT();
  const format = useFormat();
  const [preparationOpen, setPreparationOpen] = useState(false);
  const [ingredientsOpen, setIngredientsOpen] = useState(false);
  const resolvedPreparation = preparationText ?? buildPreparationText({
    title,
    quantityText,
    explicitPreparation: source?.["preparation_text"],
    description,
    t,
    format,
  });
  const resolvedQuantity =
    typeof quantityText === "string" || typeof quantityText === "number"
      ? formatQuantityText(quantityText, { t, format })
      : quantityText;
  const hasResolvedQuantity =
    resolvedQuantity !== null &&
    resolvedQuantity !== undefined &&
    typeof resolvedQuantity !== "boolean" &&
    !(typeof resolvedQuantity === "string" && resolvedQuantity.trim() === "");
  const resolvedDescription = String(description ?? "").trim();
  const ingredientRows = ingredientTableRows(rawQuantityText, { t, format });
  const toggleButtonClass = "flex min-h-11 w-full items-center justify-between gap-2 rounded-[14px] border border-white/10 bg-white/[0.055] px-4 text-[11px] font-extrabold text-slate-200 transition hover:border-amber-300/24 hover:bg-white/[0.08]";

  return (
    <div className="mt-4">
      {resolvedDescription !== "" ? (
        <div className="rounded-[16px] border border-emerald-300/20 bg-[linear-gradient(145deg,rgba(16,185,129,0.11),rgba(255,255,255,0.035))] px-3.5 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.055)]">
          <div className="inline-flex items-center gap-2 text-[11px] font-extrabold text-emerald-200">
            <Apple className="h-4 w-4" />
            {t("nutritionMyDiet.mealDetails.foodsInMeal")}
          </div>
          <div
            className={cn(
              "mt-2 border-t border-emerald-200/10 pt-2.5 font-semibold leading-7",
              descriptionTone === "foodTitle" ? "text-[14px] text-white" : "text-[13px] text-slate-200",
            )}
          >
            {resolvedDescription}
          </div>
        </div>
      ) : null}

      {resolvedPreparation !== "" ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setPreparationOpen((open) => !open);
            }}
            className={toggleButtonClass}
          >
            <span className="inline-flex items-center gap-2">
              <Utensils className="h-3.5 w-3.5 text-cyan-300" />
              {t("nutritionMyDiet.mealDetails.viewPreparation")}
            </span>
            <ChevronDown className={cn("h-4 w-4 transition-transform", preparationOpen ? "rotate-180" : "")} />
          </button>
          {preparationOpen ? (
          <div className="mt-2.5 rounded-[16px] border border-cyan-300/20 bg-cyan-300/10 px-3.5 py-3 text-[13px] font-semibold leading-7 text-cyan-50/90">
            {resolvedPreparation}
          </div>
          ) : null}
        </div>
      ) : null}

      {hasResolvedQuantity ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setIngredientsOpen((open) => !open);
            }}
            className={toggleButtonClass}
          >
            <span className="inline-flex items-center gap-2">
              <List className="h-3.5 w-3.5 text-amber-300" />
              {t("nutritionMyDiet.mealDetails.viewIngredients")}
            </span>
            <ChevronDown className={cn("h-4 w-4 transition-transform", ingredientsOpen ? "rotate-180" : "")} />
          </button>
          {ingredientsOpen ? (
            ingredientRows.length > 0 ? (
              <div className="mt-2.5 overflow-hidden rounded-[15px] border border-white/10 bg-white/[0.035]">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-b border-white/10 bg-white/[0.045] px-3.5 py-2.5 text-[10px] font-extrabold text-slate-400">
                  <span>{t("nutritionMyDiet.mealDetails.ingredientName")}</span>
                  <span>{t("nutritionMyDiet.mealDetails.amount")}</span>
                </div>
                {ingredientRows.map((row, index) => (
                  <div key={`${row.name}-${index}`} className={cn("grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-3.5 py-3 text-[12px]", index % 2 === 1 && "bg-white/[0.025]", index > 0 && "border-t border-white/[0.06]")}>
                    <span className="font-bold leading-6 text-slate-200">{row.name}</span>
                    <span className="whitespace-nowrap font-black text-amber-200">{row.amount}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-2.5 rounded-[15px] border border-white/10 bg-white/[0.045] px-3.5 py-3 text-center text-[12px] font-semibold leading-6 text-slate-200">
                {resolvedQuantity}
              </div>
            )
          ) : null}
        </div>
      ) : null}

      <NutritionMealMacroGrid source={source} notes={notes} calories={calories} />
      {action}
    </div>
  );
}

function NutritionOtherMealButton({
  manualCount,
  photoEnabled,
  hasScheduledMeal = false,
  onClick,
}: {
  manualCount: number;
  photoEnabled: boolean;
  hasScheduledMeal?: boolean;
  onClick: () => void;
}) {
  const t = useT();
  const format = useFormat();

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t("nutritionMyDiet.manualLog.addAria")}
      className="group mt-3 flex min-h-[58px] w-full items-center justify-between rounded-[18px] border border-dashed border-amber-300/38 bg-amber-300/[0.035] px-3.5 py-2.5 text-start text-amber-200 transition hover:border-amber-200/55 hover:bg-amber-300/[0.07] active:scale-[0.995]"
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <PlusCircle className="h-4.5 w-4.5 shrink-0 text-amber-300" />
        <div className="truncate text-[15px] font-extrabold">{hasScheduledMeal ? t("nutritionMyDiet.manualLog.addAnother") : t("nutritionMyDiet.manualLog.addOne")}</div>
      </div>
      <div className="shrink-0 text-xs font-extrabold text-amber-200/70">
        {manualCount > 0
          ? t("nutritionMyDiet.manualLog.count", { count: format.number(manualCount, { maximumFractionDigits: 0 }) })
          : photoEnabled
            ? t("nutritionMyDiet.manualLog.manualOrPhoto")
            : t("nutritionMyDiet.manualLog.manualOnly")}
      </div>
    </button>
  );
}

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

function DailyNutritionOverviewCard({
  summary,
  dailyCalorieTarget,
  showExercise = true,
}: {
  summary: DailyNutritionSummary;
  activeDate: string;
  dailyCalorieTarget: number;
  showExercise?: boolean;
}) {
  const t = useT();
  const format = useFormat();
  const formatOverviewNumber = (value?: number | string | null) => {
    if (value === undefined || value === null || value === "") {
      return "—";
    }

    const numeric = typeof value === "number" ? value : Number(value);
    return Number.isFinite(numeric) ? format.number(numeric, { maximumFractionDigits: 1 }) : String(value);
  };
  const chartItems = [
    { key: "carbohydrate", label: t("nutritionMyDiet.overview.macro.carbohydrate"), value: summary.carbohydrateGrams, unit: "g", color: "#fbbf24", softClass: "bg-amber-300/10 text-amber-100 border-amber-300/18" },
    { key: "protein", label: t("nutritionMyDiet.overview.macro.protein"), value: summary.proteinGrams, unit: "g", color: "#34d399", softClass: "bg-emerald-300/10 text-emerald-100 border-emerald-300/18" },
    { key: "fat", label: t("nutritionMyDiet.overview.macro.fat"), value: summary.fatGrams, unit: "g", color: "#fb7185", softClass: "bg-rose-300/10 text-rose-100 border-rose-300/18" },
    { key: "fiber", label: t("nutritionMyDiet.overview.macro.fiber"), value: summary.fiberGrams, unit: "g", color: "#38bdf8", softClass: "bg-sky-300/10 text-sky-100 border-sky-300/18" },
  ];
  const total = chartItems.reduce((sum, item) => sum + item.value, 0);
  const consumedPercent = dailyCalorieTarget > 0 ? Math.round((summary.calories / dailyCalorieTarget) * 100) : 0;
  const progressPercent = Math.min(100, consumedPercent);
  const overTargetCalories = dailyCalorieTarget > 0 ? Math.max(summary.calories - dailyCalorieTarget, 0) : 0;
  const overTargetPercent = Math.max(consumedPercent - 100, 0);
  const remainingCalories = dailyCalorieTarget > 0 ? Math.max(dailyCalorieTarget - summary.calories, 0) : 0;
  const isOverTarget = overTargetCalories > 0;
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
    <section className="overflow-hidden rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(17,19,24,0.98),rgba(10,12,17,0.99))] p-3 shadow-[0_24px_70px_-52px_rgba(0,0,0,0.98)]">
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="relative flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-white/[0.055]">
            <div
              className="absolute inset-0 rounded-full"
              style={{ background: `conic-gradient(${gradient})` }}
            />
            <div className="absolute inset-[7px] rounded-full bg-[#111318]" />
            <div className="relative text-center text-[14px] font-extrabold leading-none text-white">
              {formatOverviewNumber(summary.calories)}
            </div>
          </div>
          <div className="min-w-0">
            <div className="text-[16px] font-extrabold leading-6 text-white">{t("nutritionMyDiet.overview.title")}</div>
            <div className="mt-0.5 text-[11px] font-extrabold leading-5 text-slate-500">
              {dailyCalorieTarget > 0
                ? t(isOverTarget ? "nutritionMyDiet.overview.overTarget" : "nutritionMyDiet.overview.remaining", {
                    count: formatOverviewNumber(isOverTarget ? overTargetCalories : remainingCalories),
                    total: formatOverviewNumber(dailyCalorieTarget),
                  })
                : t("nutritionMyDiet.overview.consumed", { count: formatOverviewNumber(summary.calories) })}
            </div>
          </div>
        </div>
        <ChevronDown className="h-5 w-5 rotate-180 text-slate-400" />
      </div>

      {dailyCalorieTarget > 0 ? (
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/[0.08]">
          <div
            className={cn(
              "h-full rounded-full shadow-[0_0_18px_rgba(94,211,225,0.36)] transition-all duration-500",
              isOverTarget ? "bg-rose-400" : "bg-cyan-300",
            )}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-2.5">
        {chartItems.map((item) => (
          <div key={item.key} className="rounded-[15px] border border-white/10 bg-white/[0.035] px-3 py-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-slate-300">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                {item.label}
              </div>
              <div className="text-[15px] font-extrabold text-white">
                {formatOverviewNumber(item.value)}
                <span className="ms-0.5 text-[10px] font-extrabold text-white/70">{item.unit}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showExercise ? (
        <div className="mt-3 flex min-h-[50px] items-center justify-between rounded-[15px] border border-emerald-300/20 bg-emerald-300/[0.07] px-3 text-emerald-100">
          <div className="text-[12px] font-extrabold">{t("nutritionMyDiet.overview.exerciseCalories")}</div>
          <div className="text-[15px] font-extrabold text-emerald-200">{t("nutritionProfileHome.kcalValue", { count: formatOverviewNumber(summary.burnedCalories) })}</div>
        </div>
      ) : null}

      {summary.loggedMeals === 0 ? (
        <div className="mt-3 rounded-[14px] border border-amber-300/30 bg-amber-300/[0.10] px-3 py-3 text-start text-[12px] font-extrabold leading-6 text-amber-100 shadow-[inset_0_1px_0_rgba(251,191,36,0.08)]">
          {t("nutritionMyDiet.overview.empty")}
        </div>
      ) : null}
    </section>
  );
}

function NutritionDietViewerHeader({
  backHref,
  onBack,
}: {
  backHref: string;
  onBack: () => void;
}) {
  const t = useT();
  const { isRtl } = useLocale();
  const BackArrow = isRtl ? ArrowRight : ArrowLeft;

  return (
    <header className="flex items-center justify-between pt-1">
      <button
        type="button"
        onClick={onBack}
        className="flex h-10 w-10 items-center justify-center rounded-[15px] border border-white/10 bg-white/[0.055] text-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition hover:bg-white/[0.08]"
        aria-label={t("common.back")}
      >
        <BackArrow className="h-4 w-4" />
      </button>
      <div className="text-center">
        <div className="text-[11px] font-black text-white">{t("nutritionMyDiet.header.title")}</div>
      </div>
      <button
        type="button"
        className="relative flex h-10 w-10 items-center justify-center rounded-[15px] border border-white/10 bg-white/[0.055] text-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
        aria-label={t("nutritionMyDiet.header.notifications")}
      >
        <Bell className="h-4 w-4" />
        <span className="absolute end-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.8)]" />
      </button>
    </header>
  );
}

function NutritionDietSectionTitle({
  title,
  caption,
  icon,
  className,
}: {
  title: string;
  caption?: string;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        {caption ? <div className="text-[11px] font-bold text-slate-500">{caption}</div> : null}
        <div className="mt-1 text-xl font-black text-white">{title}</div>
      </div>
      {icon ? (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-cyan-300/14 bg-cyan-300/10 text-cyan-300">
          {icon}
        </div>
      ) : null}
    </div>
  );
}

function NutritionDietInfoRow({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  tone?: "default" | "amber" | "emerald" | "rose" | "cyan";
}) {
  const toneClass = {
    default: "border-white/10 bg-white/[0.04] text-slate-100",
    amber: "border-amber-300/18 bg-amber-300/[0.08] text-amber-50",
    emerald: "border-emerald-300/18 bg-emerald-300/[0.08] text-emerald-50",
    rose: "border-rose-300/18 bg-rose-300/[0.08] text-rose-50",
    cyan: "border-cyan-300/18 bg-cyan-300/[0.08] text-cyan-50",
  }[tone];

  return (
    <div className={cn("flex items-center justify-between gap-3 rounded-[16px] border px-3 py-3", toneClass)}>
      <span className="text-[11px] font-bold text-slate-400">{label}</span>
      <span className="text-xs font-black leading-6">{value}</span>
    </div>
  );
}

function NutritionDietMealShell({
  id,
  selected,
  expanded,
  children,
}: {
  id?: string;
  selected?: boolean;
  expanded?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className={cn(
        "scroll-mt-24 overflow-hidden border shadow-[0_24px_65px_-48px_rgba(0,0,0,0.98)] transition",
        expanded
          ? "rounded-[22px] border-amber-300/20 bg-[linear-gradient(180deg,rgba(32,30,25,0.98),rgba(12,13,15,0.995))]"
          : "rounded-[20px] border-white/10 bg-[linear-gradient(180deg,rgba(17,19,24,0.98),rgba(9,10,13,0.99))]",
        selected && !expanded ? "border-emerald-300/28 bg-[linear-gradient(180deg,rgba(16,185,129,0.10),rgba(9,10,13,0.99))]" : "",
      )}
    >
      {children}
    </section>
  );
}

function NutritionDietDayStrip({
  days,
  activeDate,
  todayIso,
  isFinished,
  hasUserSelectedDate,
  onSelectDate,
  onSelectFinished,
}: {
  days: Array<{ index: number; iso: string; label: string; shortDateLabel: string }>;
  activeDate: string;
  todayIso: string;
  isFinished: boolean;
  hasUserSelectedDate: boolean;
  onSelectDate: (iso: string) => void;
  onSelectFinished: () => void;
}) {
  const t = useT();
  const format = useFormat();
  const activeButtonRef = useRef<HTMLButtonElement | null>(null);
  const finishedButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (days.length === 0) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      const target = isFinished && !hasUserSelectedDate ? finishedButtonRef.current : activeButtonRef.current;
      target?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }, 80);

    return () => window.clearTimeout(timer);
  }, [activeDate, days.length, hasUserSelectedDate, isFinished]);

  if (days.length === 0) {
    return null;
  }

  return (
    <section className="space-y-2">
      <h2 className="text-start text-[15px] font-black leading-6 text-white">{t("nutritionMyDiet.dayStrip.title")}</h2>
      <div className="-mx-4 w-[calc(100%+2rem)] overflow-x-auto overscroll-x-contain px-4 pb-1 touch-pan-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex w-max min-w-full flex-nowrap gap-2">
          {days.map((day) => {
            const active = day.iso === activeDate;
            const passed = isFinished || day.iso < todayIso;
            const isToday = day.iso === todayIso;

            return (
              <button
                ref={active ? activeButtonRef : undefined}
                key={day.iso}
                type="button"
                onClick={() => onSelectDate(day.iso)}
                className={cn(
                  "flex min-h-[62px] min-w-[50px] shrink-0 flex-col items-center justify-between rounded-[14px] border px-1.5 py-2 text-center transition",
                  active
                    ? "border-amber-300/55 bg-[linear-gradient(180deg,rgba(251,191,36,0.18),rgba(251,191,36,0.06))] text-white shadow-[0_18px_42px_-34px_rgba(251,191,36,0.75)]"
                    : "border-white/10 bg-white/[0.045] text-slate-300 hover:border-white/16 hover:bg-white/[0.065]",
                  passed && !active ? "opacity-60 saturate-75 hover:opacity-80" : "",
                )}
              >
                <span className="text-[8px] font-bold leading-3 text-slate-300">{day.label}</span>
                <span className={cn("text-[13px] font-black", active ? "text-amber-200" : "text-white")}>{format.number(day.index, { maximumFractionDigits: 0 })}</span>
                {passed ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
                ) : isToday ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-white/18" />
                )}
              </button>
            );
          })}
          {isFinished ? (
            <button
              ref={finishedButtonRef}
              type="button"
              onClick={onSelectFinished}
              className={cn(
                "flex min-h-[62px] min-w-[82px] shrink-0 flex-col items-center justify-between rounded-[14px] border px-2 py-2 text-center text-white transition",
                hasUserSelectedDate
                  ? "border-rose-300/25 bg-rose-300/8 opacity-70"
                  : "border-rose-300/55 bg-[linear-gradient(180deg,rgba(244,63,94,0.22),rgba(127,29,29,0.16))] shadow-[0_18px_42px_-34px_rgba(244,63,94,0.85)]",
              )}
            >
              <span className="text-[8px] font-bold leading-3 text-rose-100/85">{t("nutritionMyDiet.dayStrip.finishedBadge")}</span>
              <span className="text-[11px] font-black leading-4 text-rose-100">{t("nutritionMyDiet.dayStrip.finishedTitle")}</span>
              <CheckCircle2 className="h-3.5 w-3.5 text-rose-200" />
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function NutritionDietExpiredNotice({ onNewDiet }: { onNewDiet: () => void }) {
  const t = useT();
  const { isRtl } = useLocale();
  const ForwardArrow = isRtl ? ArrowLeft : ArrowRight;

  return (
    <section className="rounded-[24px] border border-amber-300/24 bg-[linear-gradient(135deg,rgba(251,191,36,0.14),rgba(255,255,255,0.035))] p-4 shadow-[0_24px_70px_-48px_rgba(251,191,36,0.55)]">
      <div className="text-lg font-black text-white">{t("nutritionMyDiet.expired.title")}</div>
      <div className="mt-2 text-xs leading-6 text-slate-300">
        {t("nutritionMyDiet.expired.description")}
      </div>
      <Button
        type="button"
        onClick={onNewDiet}
        className="mt-4 h-11 w-full rounded-[16px] bg-amber-400 text-sm font-black text-slate-950 hover:bg-amber-300"
      >
        {t("nutritionMyDiet.expired.newDiet")}
        <ForwardArrow className="ms-2 h-4 w-4" />
      </Button>
    </section>
  );
}

function getDietStatusLabelKey(startedAt?: string | null, endsAt?: string | null) {
  const current = buildUtcDateFromIso(toTehranIsoDate(new Date()))?.getTime() ?? Date.now();
  const start = buildUtcDateFromIso(startedAt)?.getTime() ?? null;
  const end = buildUtcDateFromIso(endsAt)?.getTime() ?? null;

  if (start !== null && current < start) {
    return "nutritionMyDiet.status.notStarted" as const;
  }

  if (end !== null && current > end) {
    return "nutritionMyDiet.status.finished" as const;
  }

  return "nutritionMyDiet.status.running" as const;
}

function isMealReplacementLog(
  log: { foodTitle?: string | null; foodDescription?: string | null; quantityText?: string | null; notes?: string | null } | undefined,
  originalMeal: Record<string, unknown>,
) {
  if (!log) {
    return false;
  }

  if (extractReplacementLabel(log.notes) !== "") {
    return true;
  }

  const originalTitle = String(originalMeal["title"] ?? "").trim();
  const originalMealText = String(originalMeal["meal_text"] ?? "").trim();
  const originalQuantityText = formatQuantityText(originalMeal["quantity_text"]);

  const loggedTitle = String(log.foodTitle ?? "").trim();
  const loggedDescription = String(log.foodDescription ?? "").trim();
  const loggedQuantityText = String(log.quantityText ?? "").trim();

  return (
    (loggedTitle !== "" && originalTitle !== "" && loggedTitle !== originalTitle)
    || (loggedDescription !== "" && originalMealText !== "" && loggedDescription !== originalMealText)
    || (loggedQuantityText !== "" && originalQuantityText !== "" && loggedQuantityText !== originalQuantityText)
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function guidanceAccent(accent?: string | null) {
  switch (accent) {
    case "cyan":
      return "border-cyan-400/20 bg-cyan-400/10 shadow-[0_28px_70px_-48px_rgba(34,211,238,0.65)] text-cyan-100";
    case "violet":
      return "border-violet-400/20 bg-violet-400/10 shadow-[0_28px_70px_-48px_rgba(167,139,250,0.5)] text-violet-100";
    case "emerald":
      return "border-emerald-400/20 bg-emerald-400/10 shadow-[0_28px_70px_-48px_rgba(16,185,129,0.5)] text-emerald-100";
    default:
      return "border-amber-400/20 bg-[linear-gradient(160deg,rgba(251,191,36,0.12),rgba(255,255,255,0.03))] shadow-[0_28px_70px_-48px_rgba(251,191,36,0.45)] text-amber-100";
  }
}

const NUTRITION_TIME_ZONE = "Asia/Tehran";

function parseIsoDateParts(value?: string | null) {
  const raw = String(value ?? "").trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return null;
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function buildUtcDateFromIso(value?: string | null) {
  const parts = parseIsoDateParts(value);
  if (!parts) {
    return null;
  }

  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12, 0, 0));
}

function toIsoFromParts(parts: { year: number; month: number; day: number }) {
  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function addIsoDays(value: string, offset: number) {
  const parts = parseIsoDateParts(value);
  if (!parts) {
    return "";
  }

  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + offset, 12, 0, 0));
  return toIsoFromParts({
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  });
}

function toTehranIsoDate(date: Date) {
  return formatIsoDateInTimeZone(date, NUTRITION_TIME_ZONE);
}

function normalizeFaDigits(value: string) {
  return value.replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));
}

function estimateSegmentGrams(segmentText: string) {
  const quantity = normalizeFaDigits(segmentText.trim());
  if (!quantity || /(گرم|gram)/i.test(quantity)) {
    return 0;
  }

  const countMatch = quantity.match(/(\d+(?:\.\d+)?)/);
  const count = countMatch ? Number(countMatch[1]) : 1;

  if (quantity.includes("گردو") && quantity.includes("عدد")) {
    return Math.round(count * 4.5);
  }
  if (quantity.includes("بادام") && quantity.includes("عدد")) {
    return Math.round(count * 1.2);
  }
  if (quantity.includes("فندق") && quantity.includes("عدد")) {
    return Math.round(count * 1.5);
  }
  if (quantity.includes("پسته") && quantity.includes("عدد")) {
    return Math.round(count * 1);
  }
  if (quantity.includes("تخم مرغ") && quantity.includes("عدد")) {
    return Math.round(count * 50);
  }
  if (quantity.includes("خرما") && quantity.includes("عدد")) {
    return Math.round(count * 8);
  }
  if (quantity.includes("برش")) {
    return Math.round(count * 30);
  }
  if (quantity.includes("قاشق چای")) {
    return Math.round(count * 5);
  }
  if (quantity.includes("قاشق مربا")) {
    return Math.round(count * 10);
  }
  if (quantity.includes("قاشق")) {
    return Math.round(count * 15);
  }
  if (quantity.includes("پیمانه")) {
    return Math.round(count * 80);
  }
  if (quantity.includes("لیوان")) {
    return Math.round(count * 250);
  }
  if (quantity.includes("عدد")) {
    return Math.round(count * 30);
  }

  return 0;
}

function resolveDisplayGrams(quantityText?: string, grams?: unknown) {
  const explicitGrams = Number(grams ?? 0);
  const quantity = String(quantityText ?? "").trim();
  const estimated = estimateSegmentGrams(quantity);

  if (explicitGrams <= 0) {
    return estimated;
  }

  if (!quantity || /(گرم|gram)/i.test(quantity)) {
    return explicitGrams;
  }

  if (estimated <= 0) {
    return explicitGrams;
  }

  if (explicitGrams > estimated * 2 || explicitGrams < estimated * 0.4) {
    return estimated;
  }

  return explicitGrams;
}

function formatQuantityText(value?: unknown, context?: QuantityFormatContext): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    const text = value.trim();
    return text === "[object Object]" ? "" : text;
  }

  if (typeof value === "number") {
    return Number.isFinite(value)
      ? context
        ? context.format.number(value, { maximumFractionDigits: 1 })
        : String(value)
      : "";
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => formatQuantityText(item, context))
      .filter(Boolean)
      .join(" | ");
  }

  if (typeof value !== "object") {
    return String(value).trim();
  }

  const record = value as Record<string, unknown>;
  const nestedItems = record["ingredients"] ?? record["items"] ?? record["foods"] ?? record["parts"];
  if (Array.isArray(nestedItems)) {
    return formatQuantityText(nestedItems, context);
  }

  const title = formatQuantityText(record["title"] ?? record["name"] ?? record["ingredient"] ?? record["food"] ?? record["label"], context);
  const amount = formatQuantityText(record["quantity"] ?? record["amount"] ?? record["value"] ?? record["text"] ?? record["quantity_text"], context);
  const unit = formatQuantityText(record["unit"], context);
  const grams = Number(record["grams"] ?? record["gram"] ?? 0);
  const amountWithUnit = [amount, unit].filter(Boolean).join(" ").trim();

  if (title !== "" || amountWithUnit !== "" || grams > 0) {
    const gramText = grams > 0
      ? context
        ? context.t("nutritionMyDiet.quantity.gramValue", { grams: context.format.number(grams, { maximumFractionDigits: 0 }) })
        : `${grams}g`
      : "";
    return [amountWithUnit || gramText, title].filter(Boolean).join(" ").trim();
  }

  const ignoredKeys = new Set([
    "calories",
    "protein_grams",
    "fat_grams",
    "carbohydrate_grams",
    "fiber_grams",
    "preparation_text",
    "description",
  ]);

  return Object.entries(record)
    .filter(([key]) => !ignoredKeys.has(key))
    .map(([, item]) => formatQuantityText(item, context))
    .filter(Boolean)
    .join(" | ");
}

function ingredientTableRows(value: unknown, context: QuantityFormatContext): Array<{ name: string; amount: string }> {
  const nested = value && typeof value === "object" && !Array.isArray(value)
    ? ((value as Record<string, unknown>)["ingredients"] ?? (value as Record<string, unknown>)["items"] ?? (value as Record<string, unknown>)["foods"] ?? value)
    : value;

  if (Array.isArray(nested)) {
    return nested.flatMap((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return ingredientTableRows(item, context);
      const record = item as Record<string, unknown>;
      const name = formatQuantityText(record["title"] ?? record["name"] ?? record["ingredient"] ?? record["food"] ?? record["label"], context);
      const amount = formatQuantityText(record["quantity"] ?? record["amount"] ?? record["value"] ?? record["text"] ?? record["quantity_text"], context);
      const unit = formatQuantityText(record["unit"], context);
      return name ? [{ name, amount: [amount, unit].filter(Boolean).join(" ") || "—" }] : [];
    });
  }

  return formatQuantityText(nested, context).split(/\s*[|،,+]\s*|\s+و\s+/).map((part) => part.trim()).filter(Boolean).map((part) => {
    const colon = part.match(/^(.+?)\s*[:：]\s*(.+)$/);
    if (colon) return { name: colon[1].trim(), amount: colon[2].trim() };
    const amountFirst = part.match(/^((?:[۰-۹٠-٩\d./½¼¾]+|یک|نصف)\s*(?:گرم|کیلوگرم|میلی[‌ ]?لیتر|لیتر|عدد|قاشق(?:\s+(?:غذاخوری|چای[‌ ]?خوری))?|پیمانه|لیوان|فنجان|برش|تکه|کف\s+دست|واحد)?)\s+(.+)$/i);
    return amountFirst ? { name: amountFirst[2].trim(), amount: amountFirst[1].trim() } : { name: part, amount: "—" };
  });
}

function quantityWithGrams(quantityText: unknown, grams: unknown, format: LocaleFormatter, t: Translator) {
  const quantity = formatQuantityText(quantityText, { t, format });
  const explicitGrams = resolveDisplayGrams(quantity, grams);
  const gramValue = (value: number) => t("nutritionMyDiet.quantity.gramValue", { grams: format.number(value, { maximumFractionDigits: 0 }) });

  if (!quantity && explicitGrams > 0) {
    return (
      <>
        {t("nutritionMyDiet.quantity.oneServing")}
        <span className="ms-1 align-middle text-[9px] font-medium tracking-tight text-slate-300/65">
          ({gramValue(explicitGrams)})
        </span>
      </>
    );
  }

  if (!quantity) {
    return t("nutritionMyDiet.quantity.oneServing");
  }

  if (explicitGrams > 0 && !/[،,]| و /.test(quantity) && !/(گرم|gram)/i.test(quantity)) {
    return (
      <>
        {quantity}
        <span className="ms-1 align-middle text-[9px] font-medium tracking-tight text-slate-300/65">
          ({gramValue(explicitGrams)})
        </span>
      </>
    );
  }

  const segments = quantity
    .split(/\s+و\s+|،|,/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length <= 1) {
    const estimated = estimateSegmentGrams(quantity);
    if (estimated > 0) {
      return (
        <>
          {quantity}
          <span className="ms-1 align-middle text-[9px] font-medium tracking-tight text-slate-300/65">
            ({gramValue(estimated)})
          </span>
        </>
      );
    }

    return quantity;
  }

  return (
    <>
      {segments.map((segment, index) => {
        const estimated = estimateSegmentGrams(segment);
        const hasExplicitGrams = /(گرم|gram)/i.test(segment);

        return (
          <Fragment key={`${segment}-${index}`}>
            {index > 0 ? <span className="mx-1.5 text-slate-400/75">|</span> : null}
            <span>{segment}</span>
            {!hasExplicitGrams && estimated > 0 ? (
              <span className="ms-1 align-middle text-[9px] font-medium tracking-tight text-slate-300/65">
                ({gramValue(estimated)})
              </span>
            ) : null}
          </Fragment>
        );
      })}
    </>
  );
}

function userFacingTitle(mode: string, summaryText: string | null | undefined, t: Translator) {
  const raw = String(summaryText ?? "").trim();
  if (raw !== "" && raw.length <= 58) {
    return raw;
  }

  if (mode === "user_choice") {
    return t("nutritionMyDiet.title.userChoice");
  }
  if (mode === "fixed_text") {
    return t("nutritionMyDiet.title.fixedText");
  }

  return t("nutritionMyDiet.title.dailyPrescription");
}

function buildUserReminder(options: {
  mode: string;
  waterPlan: Record<string, unknown>;
  supplementPlan: Record<string, unknown>;
  durationDays?: number | null;
  t: Translator;
  format: ReturnType<typeof useFormat>;
}) {
  const parts: string[] = [];
  const duration = options.durationDays ?? 0;

  if (options.mode === "fixed_text") {
    if (duration > 0) {
      parts.push(options.t("nutritionMyDiet.reminder.fixedDuration", { days: options.format.number(duration, { maximumFractionDigits: 0 }) }));
    }
    parts.push(options.t("nutritionMyDiet.reminder.followExpert"));

    return `${parts.slice(0, 2).join("، ")}.`;
  }

  if (Number(options.waterPlan["daily_target_glasses"] ?? 0) > 0) {
    parts.push(options.t("nutritionMyDiet.reminder.water", { count: options.format.number(Number(options.waterPlan["daily_target_glasses"] ?? 0), { maximumFractionDigits: 0 }) }));
  }

  if (Boolean(options.supplementPlan["enabled"]) || asArray(options.supplementPlan["items"]).length > 0) {
    parts.push(options.t("nutritionMyDiet.reminder.supplements"));
  }

  if (options.mode === "user_choice") {
    parts.push(options.t("nutritionMyDiet.reminder.userChoice"));
  } else if (options.mode === "daily_prescription") {
    parts.push(options.t("nutritionMyDiet.reminder.dailyPrescription"));
  } else {
    parts.push(options.t("nutritionMyDiet.reminder.general"));
  }

  if (duration > 0) {
    parts.push(options.t("nutritionMyDiet.reminder.duration", { days: options.format.number(duration, { maximumFractionDigits: 0 }) }));
  }

  return `${parts.slice(0, 3).join("، ")}.`;
}

type SupplementItemViewModel = {
  title: string;
  usage: string;
  timing: string;
  notes: string;
};

function normalizeSupplementItems(plan: Record<string, unknown>, notes: string | null | undefined, t: Translator): SupplementItemViewModel[] {
  const items = asArray(plan["items"])
    .map((item) => asRecord(item))
    .map((item) => ({
      title: String(item["title"] ?? "").trim(),
      usage: String(item["usage"] ?? "").trim(),
      timing: String(item["timing"] ?? "").trim(),
      notes: String(item["notes"] ?? "").trim(),
    }))
    .filter((item) => item.title !== "" || item.usage !== "" || item.timing !== "" || item.notes !== "");

  if (items.length > 0) {
    return items.map((item) => ({
      title: item.title || t("nutritionMyDiet.supplement.defaultItemTitle"),
      usage: item.usage || t("nutritionMyDiet.supplement.defaultUsage"),
      timing: item.timing || t("nutritionMyDiet.supplement.defaultTiming"),
      notes: item.notes,
    }));
  }

  const fallback = String(notes ?? "").trim();
  if (fallback.includes("مکمل")) {
    return [{
      title: t("nutritionMyDiet.supplement.suggestedTitle"),
      usage: fallback,
      timing: t("nutritionMyDiet.supplement.defaultTiming"),
      notes: "",
    }];
  }

  return [];
}

function overallDietStatus(startedAt?: string | null, endsAt?: string | null) {
  const current = buildUtcDateFromIso(toTehranIsoDate(new Date()))?.getTime() ?? Date.now();
  const start = buildUtcDateFromIso(startedAt)?.getTime() ?? null;
  const end = buildUtcDateFromIso(endsAt)?.getTime() ?? null;

  if (start !== null && current < start) {
    return { labelKey: "nutritionMyDiet.status.notStarted" as const, tone: "text-slate-200 bg-white/[0.05] border-white/10" };
  }

  if (end !== null && current > end) {
    return { labelKey: "nutritionMyDiet.status.finished" as const, tone: "text-amber-100 bg-amber-300/10 border-amber-300/20" };
  }

  return { labelKey: "nutritionMyDiet.status.running" as const, tone: "text-emerald-100 bg-emerald-300/10 border-emerald-300/20" };
}

function countLoggedDays(historyDays: Array<{ logs: unknown[]; manualLogs: unknown[] }>) {
  return historyDays.filter((day) => day.logs.length > 0 || day.manualLogs.length > 0).length;
}

function matchesMealReplacementSuggestion(
  suggestion: MealReplacementSuggestionState,
  target: { sourceType: "meal_slot" | "daily_meal"; mealSlotKey: string; dayNumber?: number; mealIndex?: number },
) {
  if (suggestion.sourceType !== target.sourceType) {
    return false;
  }

  if (suggestion.mealSlotKey !== target.mealSlotKey) {
    return false;
  }

  if (target.sourceType === "daily_meal") {
    return suggestion.dayNumber === (target.dayNumber ?? null) && suggestion.mealIndex === (target.mealIndex ?? null);
  }

  return true;
}

type MealNavigationItem = {
  key: string;
  title: string;
  state?: "idle" | "done";
};

type OtherMealEntryMode = "choice" | "manual" | "photo";

function createOtherMealDraft(slotKey = "", slotTitle = "") {
  return {
    mealSlotKey: slotKey,
    slotTitle,
    foodTitle: "",
    quantityText: "",
    foodDescription: "",
    notes: "",
  };
}

function isUsableOtherMealPhotoAnalysis(analysis: NutritionMealPhotoAnalysis | null | undefined) {
  if (!analysis) {
    return false;
  }

  return analysis.foodTitle.trim() !== ""
    && analysis.suggestedQuantityText.trim() !== ""
    && Number.isFinite(analysis.suggestedCalories)
    && analysis.suggestedCalories > 0;
}

export default function NutritionMyDietPage() {
  const t = useT();
  const format = useFormat();
  const { dir, isRtl } = useLocale();
  const ForwardArrow = isRtl ? ArrowLeft : ArrowRight;
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/nutrition/my-diets/:prescriptionId");
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [prescription, setPrescription] = useState<NutritionDietPrescription | null>(null);
  const [currentPrescription, setCurrentPrescription] = useState<NutritionDietPrescription | null>(null);
  const [activeDate, setActiveDate] = useState<string>("");
  const [hasUserSelectedDate, setHasUserSelectedDate] = useState(false);
  const [savingMealKey, setSavingMealKey] = useState<string | null>(null);
  const [savingWater, setSavingWater] = useState(false);
  const [otherMealOpen, setOtherMealOpen] = useState(false);
  const [otherMealSaving, setOtherMealSaving] = useState(false);
  const [otherMealMode, setOtherMealMode] = useState<OtherMealEntryMode>("choice");
  const [deletingOtherMealId, setDeletingOtherMealId] = useState<string | null>(null);
  const [otherMealPhotoAnalyzing, setOtherMealPhotoAnalyzing] = useState(false);
  const [otherMealPhotoAnalysis, setOtherMealPhotoAnalysis] = useState<NutritionMealPhotoAnalysis | null>(null);
  const [otherMealPhotoFile, setOtherMealPhotoFile] = useState<File | null>(null);
  const [otherMealPhotoPreviewUrl, setOtherMealPhotoPreviewUrl] = useState<string>("");
  const [overLimitPromptOpen, setOverLimitPromptOpen] = useState(false);
  const [dismissedOverLimitDate, setDismissedOverLimitDate] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [mealPhotoPreview, setMealPhotoPreview] = useState<{ url: string; title: string } | null>(null);
  const [registeredMealConfirmation, setRegisteredMealConfirmation] = useState<RegisteredMealConfirmation | null>(null);
  const [mealNavigatorOpen, setMealNavigatorOpen] = useState(false);
  const hasUserSelectedDateRef = useRef(false);
  const [expandedChoiceKeys, setExpandedChoiceKeys] = useState<string[]>([]);
  const [expandedPanelKeys, setExpandedPanelKeys] = useState<string[]>([]);
  const [changingChoiceKeys, setChangingChoiceKeys] = useState<string[]>([]);
  const selectedMealFilterKey = typeof window === "undefined"
    ? ""
    : normalizeMealSlotKey(new URLSearchParams(window.location.search).get("mea"));
  const [otherMealDraft, setOtherMealDraft] = useState(createOtherMealDraft);
  const otherMealPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const otherMealGalleryInputRef = useRef<HTMLInputElement | null>(null);
  const otherMealPhotoAnalysisRef = useRef<HTMLDivElement | null>(null);
  const [changeFoodOpen, setChangeFoodOpen] = useState(false);
  const [expandedChangeFoodOptionId, setExpandedChangeFoodOptionId] = useState<string | null>(null);
  const [dismissedChangeFoodSuggestionId, setDismissedChangeFoodSuggestionId] = useState<string | null>(null);
  const [changeFoodDraft, setChangeFoodDraft] = useState<{
    suggestionId: string | null;
    sourceType: "meal_slot" | "daily_meal";
    mealSlotKey: string;
    slotTitle: string;
    originalMealLabel: string;
    dayNumber: number | null;
    mealIndex: number | null;
    status: "idle" | "queued" | "processing" | "generated" | "failed" | "cancelled";
    errorMessage: string;
    options: ChangeFoodOption[];
  }>({
    suggestionId: null,
    sourceType: "daily_meal",
    mealSlotKey: "",
    slotTitle: "",
    originalMealLabel: "",
    dayNumber: null,
    mealIndex: null,
    status: "idle",
    errorMessage: "",
    options: [],
  });
  useEffect(() => {
    const request = match && params?.prescriptionId
      ? api.nutritionPrescriptions.show(params.prescriptionId)
      : api.nutritionPrescriptions.current();

    request.then((result) => {
      if (result.success) {
        setPrescription(result.data.prescription);
      }

      setLoading(false);
    });
  }, [match, params?.prescriptionId]);

  useEffect(() => {
    if (!match) {
      return;
    }

    api.nutritionPrescriptions.current().then((result) => {
      if (result.success) {
        setCurrentPrescription(result.data.prescription);
      }
    });
  }, [match]);

  useEffect(() => {
    if (!otherMealPhotoFile) {
      setOtherMealPhotoPreviewUrl("");
      return;
    }

    const objectUrl = URL.createObjectURL(otherMealPhotoFile);
    setOtherMealPhotoPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [otherMealPhotoFile]);

  useEffect(() => {
    if (!otherMealOpen || otherMealMode !== "photo" || !otherMealPhotoAnalysis) {
      return;
    }

    const scrollToAnalysis = () => {
      otherMealPhotoAnalysisRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    };

    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(scrollToAnalysis);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [otherMealMode, otherMealOpen, otherMealPhotoAnalysis]);

  const resetOtherMealFlow = (slotKey = "", slotTitle = "") => {
    setOtherMealMode(mealPhotoAnalysisEnabled ? "choice" : "manual");
    setOtherMealDraft(createOtherMealDraft(slotKey, slotTitle));
    setOtherMealPhotoAnalysis(null);
    setOtherMealPhotoAnalyzing(false);
    setOtherMealPhotoFile(null);
    setOtherMealPhotoPreviewUrl("");
  };

  const openOtherMealModal = (slotKey: string, slotTitle: string) => {
    if (!canRegisterFoodForActiveDate) {
      showFinishedDietLoggingBlockedToast();
      return;
    }

    if (prescription?.prescriptionMode === "daily_prescription" && activeDate !== todayIso) {
      toast({
        variant: "destructive",
        title: t("nutritionMyDiet.toast.dayLogBlockedTitle"),
        description: t("nutritionMyDiet.otherMeal.dayLogBlockedDescription"),
      });
      return;
    }

    resetOtherMealFlow(slotKey, slotTitle);
    setOtherMealOpen(true);
  };

  const togglePanel = (key: string) => {
    setExpandedPanelKeys((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key],
    );
  };

  const toggleMealPanel = (panelKey: string, selectedChoiceKey?: string) => {
    setExpandedPanelKeys((current) => {
      const isOpen = current.includes(panelKey);

      if (!isOpen && selectedChoiceKey) {
        setExpandedChoiceKeys((choices) => (choices.includes(selectedChoiceKey) ? choices : [...choices, selectedChoiceKey]));
      }

      return isOpen
        ? current.filter((item) => item !== panelKey)
        : [...current, panelKey];
    });
  };

  const selectActiveDate = (iso: string) => {
    hasUserSelectedDateRef.current = true;
    setHasUserSelectedDate(true);
    setActiveDate(iso);
  };

  const selectFinishedDietState = () => {
    hasUserSelectedDateRef.current = false;
    setHasUserSelectedDate(false);
    setActiveDate(toTehranIsoDate(new Date()));
  };

  const closeOtherMealModal = () => {
    setOtherMealOpen(false);
    resetOtherMealFlow();
  };

  const openOtherMealPhotoCapture = () => {
    if (!mealPhotoAnalysisEnabled) {
      setOtherMealMode("manual");
      return;
    }

    setOtherMealMode("photo");
    setOtherMealPhotoAnalysis(null);
    setOtherMealPhotoFile(null);
    setOtherMealPhotoPreviewUrl("");
    window.setTimeout(() => {
      otherMealPhotoInputRef.current?.click();
    }, 0);
  };

  const handleOtherMealPhotoFile = (file: File | null) => {
    if (!file) {
      return;
    }

    setOtherMealMode("photo");
    setOtherMealPhotoFile(file);
    setOtherMealPhotoAnalysis(null);
  };

  const hasPendingManualMealNutrition = useMemo(() => {
    return (prescription?.mealLogs ?? []).some((log) => (
      log.isManual
      && ["queued", "processing"].includes(String(log.aiNutritionStatus ?? ""))
    ));
  }, [prescription?.mealLogs]);

  useEffect(() => {
    if (!hasPendingManualMealNutrition) {
      return;
    }

    const timer = window.setInterval(() => {
      const request = match && params?.prescriptionId
        ? api.nutritionPrescriptions.show(params.prescriptionId)
        : api.nutritionPrescriptions.current();

      request.then((result) => {
        if (result.success) {
          setPrescription(result.data.prescription);
        }
      });
    }, 3500);

    return () => window.clearInterval(timer);
  }, [hasPendingManualMealNutrition, match, params?.prescriptionId]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    const unsubscribe = subscribeUserNotificationInboxUpdates(user.id, async () => {
      const currentResult = await api.nutritionPrescriptions.current();
      if (!currentResult.success) {
        return;
      }

      const nextCurrent = currentResult.data.prescription;
      setCurrentPrescription(nextCurrent);

      if (!match) {
        setPrescription(nextCurrent);
        return;
      }

      if (nextCurrent && prescription && nextCurrent.id !== prescription.id) {
        toast({
          title: t("nutritionMyDiet.toast.newSessionTitle"),
          description: t("nutritionMyDiet.toast.newSessionDescription"),
        });
      }
    });

    return () => {
      unsubscribe?.();
    };
  }, [match, prescription, t, toast, user?.id]);

  const content = useMemo(() => {
    return (prescription?.contentSnapshot ?? {}) as Record<string, unknown>;
  }, [prescription]);

  const mealReplacementSuggestions = useMemo(() => {
    return prescription?.mealReplacementSuggestions ?? [];
  }, [prescription?.mealReplacementSuggestions]);

  useEffect(() => {
    const pendingSuggestion = mealReplacementSuggestions.find((item) => item.status === "queued" || item.status === "processing");

    if (!pendingSuggestion || pendingSuggestion.id === dismissedChangeFoodSuggestionId) {
      return;
    }

    setChangeFoodDraft({
      suggestionId: pendingSuggestion.id,
      sourceType: pendingSuggestion.sourceType === "meal_slot" ? "meal_slot" : "daily_meal",
      mealSlotKey: pendingSuggestion.mealSlotKey,
      slotTitle: pendingSuggestion.slotTitle ?? mealSlotLabel(pendingSuggestion.mealSlotKey, t),
      originalMealLabel: "",
      dayNumber: pendingSuggestion.dayNumber ?? null,
      mealIndex: pendingSuggestion.mealIndex ?? null,
      status: pendingSuggestion.status === "queued" ? "queued" : "processing",
      errorMessage: pendingSuggestion.errorMessage ?? "",
      options: pendingSuggestion.options ?? [],
    });
    setChangeFoodOpen(true);
  }, [dismissedChangeFoodSuggestionId, mealReplacementSuggestions]);

  useEffect(() => {
    if (!user?.id || !changeFoodOpen || !["queued", "processing"].includes(changeFoodDraft.status)) {
      return;
    }

    return subscribeNutritionMealReplacementSuggestionUpdates(user.id, async ({ suggestion }) => {
      const matchesSuggestion = changeFoodDraft.suggestionId
        ? suggestion.id === changeFoodDraft.suggestionId
        : matchesMealReplacementSuggestion(
            {
              id: suggestion.id,
              sourceType: suggestion.sourceType === "meal_slot" ? "meal_slot" : "daily_meal",
              mealSlotKey: suggestion.mealSlotKey ?? "",
              dayNumber: suggestion.dayNumber ?? null,
              mealIndex: suggestion.mealIndex ?? null,
            } as MealReplacementSuggestionState,
            {
              sourceType: changeFoodDraft.sourceType,
              mealSlotKey: changeFoodDraft.mealSlotKey,
              dayNumber: changeFoodDraft.dayNumber ?? undefined,
              mealIndex: changeFoodDraft.mealIndex ?? undefined,
            },
          );

      if (!matchesSuggestion) {
        return;
      }

      const result = match && params?.prescriptionId
        ? await api.nutritionPrescriptions.show(params.prescriptionId)
        : await api.nutritionPrescriptions.current();

      if (!result.success || !result.data.prescription) {
        return;
      }

      setPrescription(result.data.prescription);

      const nextSuggestion = (result.data.prescription.mealReplacementSuggestions ?? []).find((item) =>
        suggestion.id
          ? item.id === suggestion.id
          : matchesMealReplacementSuggestion(item, {
              sourceType: changeFoodDraft.sourceType,
              mealSlotKey: changeFoodDraft.mealSlotKey,
              dayNumber: changeFoodDraft.dayNumber ?? undefined,
              mealIndex: changeFoodDraft.mealIndex ?? undefined,
            }),
      );

      if (!nextSuggestion) {
        return;
      }

      setChangeFoodDraft((current) => ({
        ...current,
        suggestionId: nextSuggestion.id,
        status: nextSuggestion.status as typeof current.status,
        errorMessage: nextSuggestion.errorMessage ?? "",
        options: nextSuggestion.options ?? [],
      }));
    });
  }, [changeFoodDraft.dayNumber, changeFoodDraft.mealIndex, changeFoodDraft.mealSlotKey, changeFoodDraft.sourceType, changeFoodDraft.status, changeFoodDraft.suggestionId, changeFoodOpen, match, params?.prescriptionId, user?.id]);

  const mealSlots = useMemo(() => {
    const raw = content["meal_slots"];
    return asArray(raw);
  }, [content]);

  const dayPlans = useMemo(() => {
    const raw = content["day_plans"];
    return asArray(raw);
  }, [content]);

  const textSections = useMemo(() => {
    const raw = content["text_sections"];
    return asArray(raw);
  }, [content]);

  const audioGuidance = useMemo(() => {
    const raw = content["audio_tracks"];
    return asArray(raw);
  }, [content]);

  const guidanceSections = useMemo(() => {
    return asArray(content["guidance_sections"]);
  }, [content]);

  const viewerMessage = useMemo(() => {
    return asRecord(content["viewer_message"]);
  }, [content]);

  const waterPlan = useMemo(() => {
    return asRecord(content["water_plan"]);
  }, [content]);

  const supplementPlan = useMemo(() => {
    return asRecord(content["supplement_plan"]);
  }, [content]);
  const supplementItems = useMemo(
    () => normalizeSupplementItems(supplementPlan, prescription?.notes, t),
    [prescription?.notes, supplementPlan, t],
  );
  const isFixedTextPrescription = prescription?.prescriptionMode === "fixed_text";
  const outOfPlanMealLoggingEnabled = prescription?.outOfPlanMealLoggingEnabled !== false;
  const mealPhotoAnalysisEnabled = outOfPlanMealLoggingEnabled && prescription?.mealPhotoAnalysisEnabled !== false;
  const hasSupplementSection = useMemo(() => {
    return !isFixedTextPrescription && (Boolean(supplementPlan["enabled"]) || supplementItems.length > 0);
  }, [isFixedTextPrescription, supplementItems.length, supplementPlan]);

  const caloriePlan = useMemo(() => asRecord(content["calorie_plan"]), [content]);
  const safeTitle = useMemo(() => userFacingTitle(prescription?.prescriptionMode ?? "daily_prescription", prescription?.summaryText, t), [prescription?.prescriptionMode, prescription?.summaryText, t]);
  const userReminder = useMemo(() => buildUserReminder({
    mode: prescription?.prescriptionMode ?? "daily_prescription",
    waterPlan,
    supplementPlan,
    durationDays: prescription?.durationDays,
    t,
    format,
  }), [format, prescription?.durationDays, prescription?.prescriptionMode, supplementPlan, t, waterPlan]);

  const days = useMemo(() => {
    if (!prescription?.startedAt) {
      return [];
    }

    const startedAt = prescription.startedAt;
    const startedAtDate = buildUtcDateFromIso(startedAt);
    const endsAtDate = buildUtcDateFromIso(prescription.endsAt);
    const rangeDuration = startedAtDate && endsAtDate && endsAtDate >= startedAtDate
      ? Math.round((endsAtDate.getTime() - startedAtDate.getTime()) / (24 * 60 * 60 * 1000)) + 1
      : 0;
    const duration = Math.max(1, prescription.durationDays ?? 1, dayPlans.length || 0, rangeDuration);

    return Array.from({ length: duration }, (_, index) => {
      const iso = addIsoDays(startedAt, index);

      return {
        index: index + 1,
        iso,
        label: buildUtcDateFromIso(iso) ? format.date(buildUtcDateFromIso(iso), { timeZone: NUTRITION_TIME_ZONE, weekday: "long" }) : "",
        dateLabel: buildUtcDateFromIso(iso) ? format.date(buildUtcDateFromIso(iso), { timeZone: NUTRITION_TIME_ZONE }) : "—",
        shortDateLabel: buildUtcDateFromIso(iso) ? format.date(buildUtcDateFromIso(iso), { timeZone: NUTRITION_TIME_ZONE, month: "numeric", day: "numeric" }) : "",
      };
    });
  }, [
    dayPlans.length,
    format,
    prescription?.endsAt,
    prescription?.durationDays,
    prescription?.startedAt,
  ]);

  const dailyPlansByDate = useMemo(() => {
    const map = new Map<string, Record<string, unknown>>();

    if (days.length === 0) {
      return map;
    }

    const normalizedPlans = dayPlans.map((plan, index) => {
      const planData = typeof plan === "object" && plan ? (plan as Record<string, unknown>) : {};
      const dayNumber = Number(planData["day_number"] ?? 0);

      return {
        planData,
        index,
        dayNumber: Number.isFinite(dayNumber) && dayNumber > 0 ? dayNumber : index + 1,
      };
    }).sort((a, b) => a.dayNumber - b.dayNumber);

    normalizedPlans.forEach(({ planData, dayNumber, index }) => {
      const targetDay = dayNumber > 0 ? days[dayNumber - 1] : days[index];

      if (targetDay) {
        map.set(targetDay.iso, planData);
      }
    });

    return map;
  }, [dayPlans, days]);

  useEffect(() => {
    if (days.length === 0) {
      return;
    }

    const todayIso = toTehranIsoDate(new Date());
    const currentDay = days.find((day) => day.iso === todayIso);
    const lastDay = days.at(-1);
    const fallbackDate = currentDay?.iso
      ?? (lastDay && todayIso > lastDay.iso ? todayIso : days[0].iso);

    setActiveDate((current) => {
      if (!current) {
        return fallbackDate;
      }

      const exists = days.some((day) => day.iso === current);
      if (!exists) {
        return fallbackDate;
      }

      if (!hasUserSelectedDateRef.current) {
        return fallbackDate;
      }

      return current;
    });
  }, [days]);

  const scheduledMealLogsByDate = useMemo(() => {
    const map = new Map<string, Map<string, MealLogView>>();

    for (const log of prescription?.mealLogs ?? []) {
      if (!log.consumedDate || !log.mealSlotKey || log.isManual) {
        continue;
      }

      const dateMap = map.get(log.consumedDate) ?? new Map();
      dateMap.set(log.mealSlotKey, {
        id: log.id,
        foodTitle: log.foodTitle,
        quantityText: log.quantityText,
        foodDescription: log.foodDescription,
        calories: log.calories,
        proteinGrams: log.proteinGrams,
        fatGrams: log.fatGrams,
        carbohydrateGrams: log.carbohydrateGrams,
        fiberGrams: log.fiberGrams,
        aiNutritionStatus: log.aiNutritionStatus,
        aiNutritionError: log.aiNutritionError,
        notes: log.notes,
        isManual: log.isManual,
      });
      map.set(log.consumedDate, dateMap);
    }

    return map;
  }, [prescription?.mealLogs]);

  const manualMealLogsByDate = useMemo(() => {
    const map = new Map<string, Map<string, MealLogView[]>>();

    for (const log of prescription?.mealLogs ?? []) {
      if (!log.consumedDate || !log.mealSlotKey || !log.isManual) {
        continue;
      }

      const dateMap = map.get(log.consumedDate) ?? new Map();
      const slotLogs = dateMap.get(log.mealSlotKey) ?? [];
      slotLogs.push({
        id: log.id,
        foodTitle: log.foodTitle,
        quantityText: log.quantityText,
        foodDescription: log.foodDescription,
        manualEntryMethod: log.manualEntryMethod,
        photoUrl: log.photoUrl,
        calories: log.calories,
        proteinGrams: log.proteinGrams,
        fatGrams: log.fatGrams,
        carbohydrateGrams: log.carbohydrateGrams,
        fiberGrams: log.fiberGrams,
        aiNutritionStatus: log.aiNutritionStatus,
        aiNutritionError: log.aiNutritionError,
        notes: log.notes,
      });
      dateMap.set(log.mealSlotKey, slotLogs);
      map.set(log.consumedDate, dateMap);
    }

    return map;
  }, [prescription?.mealLogs]);

  const waterByDate = useMemo(() => {
    const map = new Map<string, { amountMl: number; glasses: number }>();

    for (const log of prescription?.waterLogs ?? []) {
      if (!log.consumedDate) {
        continue;
      }

      map.set(log.consumedDate, {
        amountMl: log.amountMl,
        glasses: log.glasses,
      });
    }

    return map;
  }, [prescription?.waterLogs]);
  const exerciseLogsByDate = useMemo(() => {
    const map = new Map<string, NonNullable<NutritionDietPrescription["exerciseLogs"]>>();

    for (const log of prescription?.exerciseLogs ?? []) {
      if (!log.consumedDate) {
        continue;
      }

      const items = map.get(log.consumedDate) ?? [];
      items.push(log);
      map.set(log.consumedDate, items);
    }

    return map;
  }, [prescription?.exerciseLogs]);

  const selectedMealLogMap = scheduledMealLogsByDate.get(activeDate) ?? new Map();
  const selectedManualMealLogMap = manualMealLogsByDate.get(activeDate) ?? new Map();
  const selectedWater = waterByDate.get(activeDate) ?? { amountMl: 0, glasses: 0 };
  const selectedExerciseLogs = exerciseLogsByDate.get(activeDate) ?? [];
  const activeDailyPlan = dailyPlansByDate.get(activeDate) ?? null;
  const selectedDailyNutritionSummary = useMemo<DailyNutritionSummary>(() => {
    const logs = [
      ...Array.from(selectedMealLogMap.values()),
      ...Array.from(selectedManualMealLogMap.values()).flat(),
    ];
    const burnedCalories = selectedExerciseLogs.reduce((sum, log) => sum + Number(log.caloriesBurned ?? 0), 0);
    const totals = logs.reduce((summary, log) => ({
      loggedMeals: summary.loggedMeals + 1,
      calories: summary.calories + loggedCalories(log),
      carbohydrateGrams: summary.carbohydrateGrams + loggedMacro(log, "carbohydrateGrams", "carbohydrate_grams"),
      proteinGrams: summary.proteinGrams + loggedMacro(log, "proteinGrams", "protein_grams"),
      fatGrams: summary.fatGrams + loggedMacro(log, "fatGrams", "fat_grams"),
      fiberGrams: summary.fiberGrams + loggedMacro(log, "fiberGrams", "fiber_grams"),
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
      loggedExercises: selectedExerciseLogs.length,
      burnedCalories,
      netCalories: totals.calories - burnedCalories,
    };
  }, [selectedExerciseLogs, selectedMealLogMap, selectedManualMealLogMap]);
  const dailyCalorieTarget = Number(caloriePlan["prescribed_calories"] ?? caloriePlan["base_calories"] ?? 0);
  const overTargetCalories = dailyCalorieTarget > 0 ? Math.max(selectedDailyNutritionSummary.calories - dailyCalorieTarget, 0) : 0;
  const exerciseLoggingEnabled = prescription?.exerciseLoggingEnabled !== false;
  const compensatedCalories = Math.min(overTargetCalories, selectedDailyNutritionSummary.burnedCalories);
  const remainingOverTargetCalories = Math.max(overTargetCalories - selectedDailyNutritionSummary.burnedCalories, 0);
  const extraBurnedCalories = overTargetCalories > 0 ? Math.max(selectedDailyNutritionSummary.burnedCalories - overTargetCalories, 0) : selectedDailyNutritionSummary.burnedCalories;
  const todayIso = toTehranIsoDate(new Date());
  const isDietFinished = Boolean(prescription?.endsAt && todayIso > prescription.endsAt);
  const isFinishedDietEndSelected = isDietFinished && !hasUserSelectedDate;
  const showDailyPrescriptionFinishedEmptyState = prescription?.prescriptionMode === "daily_prescription" && isFinishedDietEndSelected;
  const canRegisterFoodForActiveDate = !isFinishedDietEndSelected;
  const canRegisterWaterForActiveDate = !isFinishedDietEndSelected;
  const showFinishedDietLoggingBlockedToast = () => {
    toast({
      variant: "destructive",
      title: t("nutritionMyDiet.toast.finishedTitle"),
      description: t("nutritionMyDiet.toast.finishedDescription"),
    });
  };
  const dietStatus = useMemo(
    () => overallDietStatus(prescription?.startedAt, prescription?.endsAt),
    [prescription?.endsAt, prescription?.startedAt],
  );

  useEffect(() => {
    if (exerciseLoggingEnabled && remainingOverTargetCalories > 0 && activeDate && dismissedOverLimitDate !== activeDate) {
      setOverLimitPromptOpen(true);
      return;
    }

    setOverLimitPromptOpen(false);
  }, [activeDate, dismissedOverLimitDate, exerciseLoggingEnabled, remainingOverTargetCalories]);

  const expectedSlotsByDate = useMemo(() => {
    const map = new Map<string, Array<{ key: string; title: string }>>();

    if (prescription?.prescriptionMode === "daily_prescription") {
      days.forEach((day) => {
        const planData = dailyPlansByDate.get(day.iso);
        const meals = Array.isArray(planData?.["meals"]) ? planData["meals"] : [];

        map.set(day.iso, meals.map((meal, mealIndex) => {
          const mealData = typeof meal === "object" && meal ? (meal as Record<string, unknown>) : {};
          const slotKey = normalizeMealSlotKey(mealData["slot_key"] ?? mealData["title"] ?? `meal_${mealIndex + 1}`);

          return {
            key: slotKey || `meal_${mealIndex + 1}`,
            title: String(mealData["title"] ?? mealSlotLabel(slotKey, t) ?? t("nutritionMyDiet.mealCard.defaultMeal")),
          };
        }));
      });

      return map;
    }

    const baseSlots = mealSlots.map((slotValue) => {
      const slot = typeof slotValue === "object" && slotValue ? (slotValue as Record<string, unknown>) : {};
      const slotKey = normalizeMealSlotKey(slot["slot_key"] ?? slot["key"] ?? slot["title"]);

      return {
        key: slotKey,
        title: String(slot["title"] ?? mealSlotLabel(slotKey, t)),
      };
    }).filter((slot) => slot.key !== "");

    days.forEach((day) => {
      map.set(day.iso, baseSlots);
    });

    return map;
  }, [dailyPlansByDate, days, mealSlots, prescription?.prescriptionMode, t]);

  const mealProgressByDate = useMemo(() => {
    return days.map((day) => {
      const scheduledLogs = scheduledMealLogsByDate.get(day.iso) ?? new Map();
      const manualLogs = manualMealLogsByDate.get(day.iso) ?? new Map();
      const expectedSlots = expectedSlotsByDate.get(day.iso) ?? [];
      const eatenCount = expectedSlots.filter((slot) => (
        scheduledLogs.has(slot.key) || ((manualLogs.get(slot.key)?.length ?? 0) > 0)
      )).length;
      const totalCount = expectedSlots.length;

      return {
        iso: day.iso,
        eatenCount,
        totalCount,
        state: totalCount === 0 ? "empty" : eatenCount === 0 ? "none" : eatenCount >= totalCount ? "complete" : "partial",
      };
    });
  }, [days, expectedSlotsByDate, manualMealLogsByDate, scheduledMealLogsByDate]);

  const historyDays = useMemo(() => {
    return days.map((day) => {
      const logs = Array.from(scheduledMealLogsByDate.get(day.iso)?.entries() ?? []);
      const manualLogs = Array.from(manualMealLogsByDate.get(day.iso)?.entries() ?? []);
      const water = waterByDate.get(day.iso) ?? { amountMl: 0, glasses: 0 };
      const progress = mealProgressByDate.find((item) => item.iso === day.iso);

      return {
        ...day,
        logs,
        manualLogs,
        water,
        progress,
      };
    });
  }, [days, manualMealLogsByDate, mealProgressByDate, scheduledMealLogsByDate, waterByDate]);
  const loggedDaysCount = useMemo(() => countLoggedDays(historyDays), [historyDays]);
  const expertFile = prescription?.expertFile ?? null;
  const isExpertFilePrescription = prescription?.deliveryChannel === "expert_file" || Boolean(expertFile);
  const mealNavigationItems = useMemo<MealNavigationItem[]>(() => {
    if (prescription?.prescriptionMode === "user_choice") {
      const items: MealNavigationItem[] = [];

      mealSlots.forEach((slotValue, index) => {
        const slot = asRecord(slotValue);
        const slotKey = normalizeMealSlotKey(slot["slot_key"] ?? slot["key"] ?? slot["title"] ?? `meal_${index + 1}`);
        if (slotKey === "") {
          return;
        }

        items.push({
          key: slotKey,
          title: String(slot["title"] ?? mealSlotLabel(slotKey, t) ?? t("nutritionMyDiet.mealCard.defaultMeal")),
          state: selectedMealLogMap.get(slotKey) || ((selectedManualMealLogMap.get(slotKey)?.length ?? 0) > 0) ? "done" : "idle",
        });
      });

      return items;
    }

    if (prescription?.prescriptionMode === "daily_prescription" && activeDailyPlan) {
      const items: MealNavigationItem[] = [];

      asArray(activeDailyPlan["meals"]).forEach((meal, index) => {
        const mealData = asRecord(meal);
        const slotKey = normalizeMealSlotKey(mealData["slot_key"] ?? mealData["title"] ?? `meal_${index + 1}`);
        if (slotKey === "") {
          return;
        }

        items.push({
          key: slotKey,
          title: String(mealData["title"] ?? mealSlotLabel(slotKey, t) ?? t("nutritionMyDiet.mealCard.defaultMeal")),
          state: selectedMealLogMap.get(slotKey) || ((selectedManualMealLogMap.get(slotKey)?.length ?? 0) > 0) ? "done" : "idle",
        });
      });

      return items;
    }

    return [];
  }, [activeDailyPlan, mealSlots, prescription?.prescriptionMode, selectedManualMealLogMap, selectedMealLogMap, t]);
  const filteredMealNavigationItems = useMemo(() => {
    if (!selectedMealFilterKey) {
      return mealNavigationItems;
    }

    return mealNavigationItems.filter((item) => item.key === selectedMealFilterKey);
  }, [mealNavigationItems, selectedMealFilterKey]);
  const selectedMealFilterItem = useMemo(
    () => mealNavigationItems.find((item) => item.key === selectedMealFilterKey) ?? null,
    [mealNavigationItems, selectedMealFilterKey],
  );
  const hasActiveMealFilter = Boolean(selectedMealFilterItem);
  const hasDailyAdviceSections = !isFixedTextPrescription && !hasActiveMealFilter && (
    Number(waterPlan["daily_target_glasses"] ?? 0) > 0
    || Number(waterPlan["daily_target_ml"] ?? 0) > 0
    || String(waterPlan["summary_text"] ?? "").trim() !== ""
    || hasSupplementSection
    || guidanceSections.length > 0
    || audioGuidance.length > 0
  );

  const jumpToMealSection = (mealKey: string) => {
    if (typeof document === "undefined") {
      return;
    }

    const element = document.getElementById(`meal-section-${mealKey}`);
    if (!element) {
      return;
    }

    element.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    if (!hasActiveMealFilter || !selectedMealFilterKey || loading) {
      return;
    }

    if (prescription?.prescriptionMode === "user_choice") {
      const selectedSlot = mealSlots.find((slotValue, index) => {
        const slot = asRecord(slotValue);
        const sectionAnchorKey = normalizeMealSlotKey(((slot["slot_key"] ?? slot["key"] ?? slot["title"]) || `meal_${index + 1}`));

        return sectionAnchorKey === selectedMealFilterKey;
      });

      if (selectedSlot) {
        const slot = asRecord(selectedSlot);
        const slotKey = String(slot["slot_key"] ?? "");
        const sectionAnchorKey = normalizeMealSlotKey(((slot["slot_key"] ?? slot["key"] ?? slot["title"]) || selectedMealFilterKey));
        const panelKey = `meal-panel:${activeDate || "no-date"}:${slotKey || sectionAnchorKey}`;

        setExpandedPanelKeys((current) => (current.includes(panelKey) ? current : [...current, panelKey]));

        const selectedLog = selectedMealLogMap.get(slotKey);
        const options = asArray(slot["options"]);
        const selectedOptionIndex = selectedLog
          ? options.findIndex((option) => String(asRecord(option)["title"] ?? "") === String(selectedLog.foodTitle ?? ""))
          : -1;
        const choiceChangeKey = `${activeDate || "no-date"}:${slotKey}`;

        if (selectedOptionIndex >= 0 && !changingChoiceKeys.includes(choiceChangeKey)) {
          const choiceCardKey = `${activeDate || "no-date"}:${slotKey}:${selectedOptionIndex}`;
          setExpandedChoiceKeys((current) => (current.includes(choiceCardKey) ? current : [...current, choiceCardKey]));
        }
      }
    }

    if (prescription?.prescriptionMode === "daily_prescription" && activeDailyPlan) {
      const selectedMealIndex = asArray(activeDailyPlan["meals"]).findIndex((meal, index) => {
        const mealData = asRecord(meal);
        const slotKey = normalizeMealSlotKey(mealData["slot_key"] ?? mealData["title"] ?? `meal_${index + 1}`);

        return slotKey === selectedMealFilterKey;
      });

      if (selectedMealIndex >= 0) {
        const mealData = asRecord(asArray(activeDailyPlan["meals"])[selectedMealIndex]);
        const slotKey = normalizeMealSlotKey(mealData["slot_key"] ?? mealData["title"] ?? `meal_${selectedMealIndex + 1}`);
        const cardKey = `daily:${activeDate || "no-date"}:${slotKey}:${selectedMealIndex}`;

        setExpandedChoiceKeys((current) => (current.includes(cardKey) ? current : [...current, cardKey]));
      }
    }

    const timer = window.setTimeout(() => {
      const element = document.getElementById(`meal-section-${selectedMealFilterKey}`);
      if (!element) {
        return;
      }

      const offsetTop = element.getBoundingClientRect().top + window.scrollY - 18;
      window.scrollTo({
        top: Math.max(0, offsetTop),
        behavior: "smooth",
      });
    }, 80);

    return () => {
      window.clearTimeout(timer);
    };
  }, [activeDailyPlan, activeDate, changingChoiceKeys, hasActiveMealFilter, loading, mealSlots, prescription?.prescriptionMode, selectedMealFilterKey, selectedMealLogMap]);

  const selectMealFromNavigator = (mealKey: string) => {
    setMealNavigatorOpen(false);
    window.setTimeout(() => {
      jumpToMealSection(mealKey);
    }, 180);
  };

  const registeredMealDateText = registeredMealConfirmation
    ? registeredMealConfirmation.consumedDate === todayIso
      ? t("common.today")
      : t("nutritionMyDiet.confirmation.day", { date: format.date(registeredMealConfirmation.consumedDate) })
    : "";

  const toggleChoiceCard = (choiceKey: string) => {
    setExpandedChoiceKeys((current) => (
      current.includes(choiceKey)
        ? current.filter((item) => item !== choiceKey)
        : [...current, choiceKey]
    ));
  };

  const revealMealChoices = (choiceKey: string) => {
    setChangingChoiceKeys((current) => (
      current.includes(choiceKey) ? current : [...current, choiceKey]
    ));
    setExpandedChoiceKeys((current) => current.filter((item) => !item.startsWith(`${choiceKey}:`)));
  };

  const showMealRegistrationConfirmation = (payload: RegisteredMealConfirmation) => {
    setRegisteredMealConfirmation({
      foodTitle: payload.foodTitle.trim() || t("nutritionMyDiet.mealCard.food"),
      slotTitle: payload.slotTitle.trim() || t("nutritionMyDiet.mealCard.defaultMeal"),
      consumedDate: payload.consumedDate,
      mode: payload.mode,
    });
  };

  const saveMeal = async (payload: {
    mealSlotKey: string;
    slotTitle: string;
    foodTitle: string;
    foodDescription?: string;
    quantityText?: string;
    optionCalories?: number | null;
    proteinGrams?: number | null;
    fatGrams?: number | null;
    carbohydrateGrams?: number | null;
    fiberGrams?: number | null;
    notes?: string;
  }) => {
    if (!activeDate) {
      return false;
    }

    if (!canRegisterFoodForActiveDate) {
      showFinishedDietLoggingBlockedToast();
      return false;
    }

    if (prescription?.prescriptionMode === "daily_prescription" && !isDietFinished && activeDate !== toTehranIsoDate(new Date())) {
      toast({
        variant: "destructive",
        title: t("nutritionMyDiet.toast.dayLogBlockedTitle"),
        description: t("nutritionMyDiet.toast.dayLogBlockedDescription"),
      });
      return false;
    }

    setSavingMealKey(payload.mealSlotKey);
    const result = await api.nutritionPrescriptions.logMeal({
      consumedDate: activeDate,
      mealSlotKey: payload.mealSlotKey,
      slotTitle: payload.slotTitle,
      foodTitle: payload.foodTitle,
      foodDescription: payload.foodDescription,
      quantityText: payload.quantityText,
      optionCalories: payload.optionCalories ?? null,
      proteinGrams: payload.proteinGrams ?? null,
      fatGrams: payload.fatGrams ?? null,
      carbohydrateGrams: payload.carbohydrateGrams ?? null,
      fiberGrams: payload.fiberGrams ?? null,
      notes: payload.notes,
    });

    if (result.success) {
      setPrescription(result.data.prescription);
      const choiceKey = `${activeDate || "no-date"}:${payload.mealSlotKey}`;
      setChangingChoiceKeys((current) => current.filter((item) => item !== choiceKey));
      showMealRegistrationConfirmation({
        foodTitle: payload.foodTitle,
        slotTitle: payload.slotTitle || mealSlotLabel(payload.mealSlotKey, t),
        consumedDate: activeDate,
        mode: payload.notes?.startsWith("replacement:") ? "replacement" : "planned",
      });
    } else {
      toast({ variant: "destructive", title: t("nutritionMyDiet.toast.saveFailedTitle"), description: result.message || t("common.tryAgain") });
    }

    setSavingMealKey(null);
    return result.success;
  };

  const deleteMeal = async (mealLogId: string, mealSlotKey: string) => {
    if (!canRegisterFoodForActiveDate) {
      showFinishedDietLoggingBlockedToast();
      return;
    }

    if (prescription?.prescriptionMode === "daily_prescription" && !isDietFinished && activeDate !== toTehranIsoDate(new Date())) {
      toast({
        variant: "destructive",
        title: t("nutritionMyDiet.toast.deleteDayBlockedTitle"),
        description: t("nutritionMyDiet.toast.deleteDayBlockedDescription"),
      });
      return;
    }

    setSavingMealKey(mealSlotKey);
    const result = await api.nutritionPrescriptions.deleteMeal(mealLogId);

    if (result.success) {
      setPrescription(result.data.prescription);
      const choiceKey = `${activeDate || "no-date"}:${mealSlotKey}`;
      setChangingChoiceKeys((current) => current.filter((item) => item !== choiceKey));
      toast({ title: t("nutritionMyDiet.toast.mealDeletedTitle"), description: t("nutritionMyDiet.toast.mealDeletedDescription") });
    } else {
      toast({ variant: "destructive", title: t("nutritionMyDiet.toast.deleteFailedTitle"), description: result.message || t("common.tryAgain") });
    }

    setSavingMealKey(null);
  };

  const saveWater = async (glasses: number) => {
    if (!activeDate) {
      return;
    }

    if (!canRegisterWaterForActiveDate) {
      showFinishedDietLoggingBlockedToast();
      return;
    }

    setSavingWater(true);
    const result = await api.nutritionPrescriptions.logWater({
      consumedDate: activeDate,
      glasses,
      amountMl: glasses * 250,
    });

    if (result.success) {
      setPrescription(result.data.prescription);
    }

    setSavingWater(false);
  };

  const saveOtherMeal = async () => {
    if (!activeDate || !otherMealDraft.mealSlotKey) {
      return;
    }

    if (!canRegisterFoodForActiveDate) {
      showFinishedDietLoggingBlockedToast();
      return;
    }

    const isPhotoMode = otherMealMode === "photo";
    const manualFoodTitle = otherMealDraft.foodTitle.trim();
    const analysis = otherMealPhotoAnalysis;

    if (manualFoodTitle === "") {
      toast({
        variant: "destructive",
        title: t("nutritionMyDiet.otherMeal.validation.foodTitleRequired"),
        description: t("nutritionMyDiet.otherMeal.validation.foodTitleRequiredDescription"),
      });
      return;
    }

    if (isPhotoMode && (!analysis || !otherMealPhotoFile)) {
      toast({
        variant: "destructive",
        title: t("nutritionMyDiet.otherMeal.validation.photoAnalysisMissing"),
        description: t("nutritionMyDiet.otherMeal.validation.photoAnalysisMissingDescription"),
      });
      return;
    }

    if (isPhotoMode && !isUsableOtherMealPhotoAnalysis(analysis)) {
      toast({
        variant: "destructive",
        title: t("nutritionMyDiet.otherMeal.validation.photoNotUsable"),
        description: t("nutritionMyDiet.otherMeal.validation.photoNotUsableDescription"),
      });
      return;
    }

    setOtherMealSaving(true);
    const result = await api.nutritionPrescriptions.logOtherMeal({
      consumedDate: activeDate,
      mealSlotKey: otherMealDraft.mealSlotKey,
      slotTitle: otherMealDraft.slotTitle,
      foodTitle: manualFoodTitle,
      quantityText: isPhotoMode ? analysis?.suggestedQuantityText ?? undefined : otherMealDraft.quantityText.trim() || undefined,
      foodDescription: isPhotoMode ? analysis?.foodDescription ?? undefined : otherMealDraft.foodDescription.trim() || undefined,
      optionCalories: isPhotoMode ? analysis?.suggestedCalories ?? null : null,
      proteinGrams: isPhotoMode ? analysis?.suggestedProteinGrams ?? null : null,
      fatGrams: isPhotoMode ? analysis?.suggestedFatGrams ?? null : null,
      carbohydrateGrams: isPhotoMode ? analysis?.suggestedCarbohydrateGrams ?? null : null,
      fiberGrams: isPhotoMode ? analysis?.suggestedFiberGrams ?? null : null,
      notes: [
        otherMealDraft.notes.trim(),
        isPhotoMode ? analysis?.notes ?? "" : "",
      ].filter(Boolean).join(" | ") || undefined,
      manualEntryMethod: isPhotoMode ? "photo" : "manual",
      image: isPhotoMode ? otherMealPhotoFile : null,
    });

    if (result.success) {
      setPrescription(result.data.prescription);
      const choiceKey = `${activeDate || "no-date"}:${otherMealDraft.mealSlotKey}`;
      setChangingChoiceKeys((current) => current.filter((item) => item !== choiceKey));
      closeOtherMealModal();
      showMealRegistrationConfirmation({
        foodTitle: manualFoodTitle,
        slotTitle: otherMealDraft.slotTitle || mealSlotLabel(otherMealDraft.mealSlotKey, t),
        consumedDate: activeDate,
        mode: "extra",
      });
    } else {
      toast({ variant: "destructive", title: t("nutritionMyDiet.toast.saveFailedTitle"), description: result.message || t("common.tryAgain") });
    }

    setOtherMealSaving(false);
  };

  const analyzeOtherMealPhoto = async (fileOverride?: File | null) => {
    if (!mealPhotoAnalysisEnabled) {
      toast({
        variant: "destructive",
        title: t("nutritionMyDiet.otherMeal.photoDisabledTitle"),
        description: t("nutritionMyDiet.otherMeal.photoDisabledDescription"),
      });
      return;
    }

    const targetFile = fileOverride ?? otherMealPhotoFile;
    const foodTitle = otherMealDraft.foodTitle.trim();

    if (!activeDate || !otherMealDraft.mealSlotKey || !targetFile) {
      toast({
        variant: "destructive",
        title: t("nutritionMyDiet.otherMeal.photoMissingTitle"),
        description: t("nutritionMyDiet.otherMeal.photoMissingDescription"),
      });
      return;
    }

    if (foodTitle === "") {
      toast({
        variant: "destructive",
        title: t("nutritionMyDiet.otherMeal.validation.foodTitleRequired"),
        description: t("nutritionMyDiet.otherMeal.validation.foodTitleRequiredDescription"),
      });
      return;
    }

    setOtherMealPhotoAnalyzing(true);
    const result = await api.nutritionPrescriptions.analyzeOtherMealPhoto({
      consumedDate: activeDate,
      mealSlotKey: otherMealDraft.mealSlotKey,
      slotTitle: otherMealDraft.slotTitle,
      foodTitle,
      userNote: otherMealDraft.notes.trim() || undefined,
      image: targetFile,
    });

    if (result.success && result.data.analysis) {
      setOtherMealPhotoAnalysis(result.data.analysis);
      toast({
        title: t("nutritionMyDiet.otherMeal.photoReadyTitle"),
        description: t("nutritionMyDiet.otherMeal.photoReadyDescription"),
      });
    } else {
      setOtherMealPhotoAnalysis(null);
      toast({
        variant: "destructive",
        title: t("nutritionMyDiet.otherMeal.photoFailedTitle"),
        description: result.message || t("nutritionMyDiet.otherMeal.photoFailedDescription"),
      });
    }

    setOtherMealPhotoAnalyzing(false);
  };

  const canSaveOtherMealPhotoAnalysis = isUsableOtherMealPhotoAnalysis(otherMealPhotoAnalysis);

  const deleteOtherMeal = async (mealLogId: string) => {
    if (!canRegisterFoodForActiveDate) {
      showFinishedDietLoggingBlockedToast();
      return;
    }

    const deletedManualLog = Array.from(selectedManualMealLogMap.entries()).find(([, logs]) => (
      logs.some((log: MealLogView) => log.id === mealLogId)
    ));
    setDeletingOtherMealId(mealLogId);
    const result = await api.nutritionPrescriptions.deleteOtherMeal(mealLogId);

    if (result.success) {
      setPrescription(result.data.prescription);
      if (deletedManualLog) {
        const choiceKey = `${activeDate || "no-date"}:${deletedManualLog[0]}`;
        setChangingChoiceKeys((current) => current.filter((item) => item !== choiceKey));
      }
      toast({ title: t("nutritionMyDiet.otherMeal.deletedTitle"), description: t("nutritionMyDiet.otherMeal.deletedDescription") });
    } else {
      toast({ variant: "destructive", title: t("nutritionMyDiet.toast.deleteFailedTitle"), description: result.message || t("common.tryAgain") });
    }

    setDeletingOtherMealId(null);
  };

  const openExercisePage = () => {
    const basePath = match && params?.prescriptionId
      ? `/nutrition/my-diets/${params.prescriptionId}/exercises`
      : "/nutrition/my-diet/exercises";
    const query = activeDate ? `?date=${encodeURIComponent(activeDate)}` : "";

    setLocation(`${basePath}${query}`);
  };

  const openChangeFood = async (payload: {
    sourceType: "meal_slot" | "daily_meal";
    mealSlotKey: string;
    slotTitle: string;
    originalMealLabel?: string;
    dayNumber?: number;
    mealIndex?: number;
  }) => {
    setDismissedChangeFoodSuggestionId(null);
    setExpandedChangeFoodOptionId(null);
    setChangeFoodDraft({
      suggestionId: null,
      sourceType: payload.sourceType,
      mealSlotKey: payload.mealSlotKey,
      slotTitle: payload.slotTitle,
      originalMealLabel: payload.originalMealLabel ?? "",
      dayNumber: payload.dayNumber ?? null,
      mealIndex: payload.mealIndex ?? null,
      status: "queued",
      errorMessage: "",
      options: [],
    });
    setChangeFoodOpen(true);

    const result = await api.nutritionPrescriptions.generateMealReplacementSuggestions({
      sourceType: payload.sourceType,
      mealSlotKey: payload.mealSlotKey,
      slotTitle: payload.slotTitle,
      dayNumber: payload.dayNumber,
      mealIndex: payload.mealIndex,
    });

    if (!result.success || !result.data.prescription || !result.data.suggestion) {
      setChangeFoodDraft((current) => ({
        ...current,
        status: "failed",
        errorMessage: result.message || t("nutritionMyDiet.changeFood.startFailed"),
      }));
      toast({
        variant: "destructive",
        title: t("nutritionMyDiet.changeFood.fetchFailedTitle"),
        description: result.message || t("common.tryAgain"),
      });
      return;
    }

    setPrescription(result.data.prescription);
    setChangeFoodDraft({
      suggestionId: result.data.suggestion.id,
      sourceType: result.data.suggestion.sourceType === "meal_slot" ? "meal_slot" : "daily_meal",
      mealSlotKey: result.data.suggestion.mealSlotKey,
      slotTitle: result.data.suggestion.slotTitle ?? payload.slotTitle,
      originalMealLabel: payload.originalMealLabel ?? "",
      dayNumber: result.data.suggestion.dayNumber ?? payload.dayNumber ?? null,
      mealIndex: result.data.suggestion.mealIndex ?? payload.mealIndex ?? null,
      status: result.data.suggestion.status as "queued" | "processing" | "generated" | "failed" | "cancelled",
      errorMessage: result.data.suggestion.errorMessage ?? "",
      options: result.data.suggestion.options ?? [],
    });
  };

  const cancelChangedFoodRequest = async () => {
    if (!changeFoodDraft.suggestionId) {
      setChangeFoodOpen(false);
      return;
    }

    const result = await api.nutritionPrescriptions.cancelMealReplacementSuggestions(changeFoodDraft.suggestionId);

    if (result.success && result.data.prescription && result.data.suggestion) {
      const cancelledSuggestion = result.data.suggestion;
      setPrescription(result.data.prescription);
      setChangeFoodDraft((current) => ({
        ...current,
        status: "cancelled",
        errorMessage: "",
        options: cancelledSuggestion.options ?? current.options,
      }));
      toast({
        title: t("nutritionMyDiet.changeFood.cancelledToastTitle"),
        description: t("nutritionMyDiet.changeFood.cancelledToastDescription"),
      });
      return;
    }

    toast({
      variant: "destructive",
      title: t("nutritionMyDiet.changeFood.cancelFailedTitle"),
      description: result.message || t("common.tryAgain"),
    });
  };

  const saveChangedFood = async (option: ChangeFoodOption) => {
    const saved = await saveMeal({
      mealSlotKey: changeFoodDraft.mealSlotKey,
      slotTitle: changeFoodDraft.slotTitle,
      foodTitle: option.title,
      foodDescription: option.preparationText || option.description,
      quantityText: option.quantityText,
      optionCalories: option.calories,
      notes: changeFoodDraft.originalMealLabel ? `replacement:${changeFoodDraft.originalMealLabel}` : `replacement:${t("nutritionMyDiet.daily.originalFood")}`,
    });
    if (saved) {
      setChangeFoodOpen(false);
    }
  };

  const formatDietDate = (value?: string | null) => {
    const date = buildUtcDateFromIso(value);
    return date ? format.date(date, { timeZone: NUTRITION_TIME_ZONE }) : "—";
  };
  const formatDietNumber = (value?: number | string | null) => {
    if (value === undefined || value === null || value === "") {
      return "—";
    }

    const numeric = typeof value === "number" ? value : Number(value);
    return Number.isFinite(numeric) ? format.number(numeric, { maximumFractionDigits: 1 }) : String(value);
  };
  const formatDietInteger = (value?: number | string | null) => {
    const numeric = typeof value === "number" ? value : Number(value);
    return Number.isFinite(numeric) ? format.number(numeric, { maximumFractionDigits: 0 }) : "—";
  };

  if (loading) {
    return (
      <div className="relative isolate min-h-screen bg-[#050607] text-white" dir={dir}>
        <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.10),transparent_22%),linear-gradient(180deg,rgba(13,14,12,0.98),rgba(5,6,7,1)_42%,rgba(3,4,5,1))]" />
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-amber-300" />
        </div>
      </div>
    );
  }

  if (!prescription) {
    return (
      <div className="relative isolate min-h-screen bg-[#050607] px-4 py-5 text-white" dir={dir}>
        <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.10),transparent_22%),linear-gradient(180deg,rgba(13,14,12,0.98),rgba(5,6,7,1)_42%,rgba(3,4,5,1))]" />
        <div className="relative z-10 mx-auto max-w-md space-y-5">
          <NutritionDietViewerHeader backHref={match ? "/nutrition/my-diets" : "/nutrition/profile"} onBack={() => setLocation(match ? "/nutrition/my-diets" : "/nutrition/profile")} />
          <section className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(18,20,27,0.98),rgba(8,9,12,0.99))] p-5 text-center shadow-[0_24px_65px_-48px_rgba(0,0,0,0.98)]">
            <div className="text-xl font-black">{t("nutritionMyDiet.empty.title")}</div>
            <div className="mt-2 text-sm leading-7 text-slate-300">{t("nutritionMyDiet.empty.description")}</div>
            <Button className="mt-5 h-11 rounded-[16px] bg-amber-400 px-5 text-slate-950 hover:bg-amber-300" onClick={() => setLocation("/nutrition/profile")}>
              {t("nutritionMyDiet.empty.backToProfile")}
            </Button>
          </section>
        </div>
      </div>
    );
  }

  if (isExpertFilePrescription && prescription && expertFile) {
    return (
      <div className="relative isolate min-h-screen overflow-hidden bg-[#050607] px-4 py-5 pb-28 text-white" dir={dir}>
        <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.10),transparent_22%),linear-gradient(180deg,rgba(13,14,12,0.98),rgba(5,6,7,1)_42%,rgba(3,4,5,1))]" />
        <div className="relative z-10 mx-auto max-w-md space-y-5">
          <NutritionDietViewerHeader backHref={match ? "/nutrition/my-diets" : "/nutrition/profile"} onBack={() => setLocation(match ? "/nutrition/my-diets" : "/nutrition/profile")} />

          {match && currentPrescription && currentPrescription.id !== prescription.id ? (
            <section className="rounded-[26px] border border-amber-300/20 bg-[linear-gradient(160deg,rgba(245,158,11,0.12),rgba(255,255,255,0.04))] p-4 shadow-[0_30px_80px_-48px_rgba(245,158,11,0.45)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-black text-white">{t("nutritionMyDiet.oldSession.title")}</div>
                  <div className="mt-1 text-xs leading-6 text-amber-50/85">
                    {t("nutritionMyDiet.oldSession.description")}
                  </div>
                </div>
                <Button type="button" onClick={() => setLocation("/nutrition/my-diet")} className="rounded-[18px] bg-amber-400 px-4 text-sm font-black text-slate-950 hover:bg-amber-300">
                  {t("nutritionMyDiet.oldSession.activeSession")}
                </Button>
              </div>
            </section>
          ) : null}

          <section className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(18,20,27,0.98),rgba(8,9,12,0.99))] p-4 shadow-[0_24px_65px_-48px_rgba(0,0,0,0.98)]">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-bold text-white/80">
                  <FileArchive className="h-3.5 w-3.5 text-amber-300" />
                  {t("nutritionMyDiet.expertFile.badge")}
                </div>
                <h1 className="text-2xl font-black leading-tight">{safeTitle}</h1>
                <p className="text-xs leading-6 text-slate-300">
                  {t("nutritionMyDiet.expertFile.description")}
                </p>
              </div>
              <div className="rounded-[22px] border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-center">
                <div className="text-[11px] font-bold text-emerald-200">{t("nutritionMyDiet.expertFile.statusLabel")}</div>
                <div className="mt-1 text-sm font-black text-emerald-300">{t("nutritionMyDiet.expertFile.readyStatus")}</div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-[20px] border border-white/10 bg-white/[0.04] px-3 py-3">
                <div className="text-[10px] font-bold text-slate-400">{t("nutritionMyDiet.expertFile.sessionType")}</div>
                <div className="mt-2 text-[11px] font-black leading-5">{t("nutritionMyDiet.expertFile.customFile")}</div>
              </div>
              <div className="rounded-[20px] border border-white/10 bg-white/[0.04] px-3 py-3">
                <div className="text-[10px] font-bold text-slate-400">{t("nutritionMyDiet.expertFile.startEnd")}</div>
                <div className="mt-2 text-[11px] font-black leading-5">{formatDietDate(prescription.startedAt)}</div>
                <div className="text-[11px] text-slate-400">{formatDietDate(prescription.endsAt)}</div>
              </div>
              <div className="rounded-[20px] border border-white/10 bg-white/[0.04] px-3 py-3">
                <div className="text-[10px] font-bold text-slate-400">{t("nutritionMyDiet.expertFile.session")}</div>
                <div className="mt-2 text-sm font-black">{formatDietInteger(prescription.version)}</div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-[20px] border border-white/10 bg-white/[0.04] px-3 py-3">
                <div className="text-[10px] font-bold text-slate-400">{t("nutritionMyDiet.expertFile.currentWeight")}</div>
                <div className="mt-2 text-sm font-black">{t("nutritionProfileHome.kgValue", { count: formatDietNumber(prescription.currentWeightKg) })}</div>
              </div>
              <div className="rounded-[20px] border border-white/10 bg-white/[0.04] px-3 py-3">
                <div className="text-[10px] font-bold text-slate-400">{t("nutritionMyDiet.expertFile.targetWeight")}</div>
                <div className="mt-2 text-sm font-black">{t("nutritionProfileHome.kgValue", { count: formatDietNumber(prescription.targetWeightKg) })}</div>
              </div>
              <div className="rounded-[20px] border border-white/10 bg-white/[0.04] px-3 py-3">
                <div className="text-[10px] font-bold text-slate-400">{t("nutritionMyDiet.expertFile.weeklyChange")}</div>
                <div className="mt-2 text-sm font-black">{t("nutritionProfileHome.kgValue", { count: formatDietNumber(prescription.weeklyWeightChangeKg) })}</div>
              </div>
            </div>
          </section>

          <section className="rounded-[22px] border border-amber-300/18 bg-[linear-gradient(180deg,rgba(34,26,10,0.80),rgba(12,12,14,0.98))] p-4 shadow-[0_20px_60px_-46px_rgba(251,191,36,0.55)]">
            <div className="flex items-center gap-2 text-sm font-black text-amber-100">
              <FileText className="h-5 w-5 text-amber-300" />
              {t("nutritionMyDiet.expertFile.fileInfo")}
            </div>
            <div className="mt-4 space-y-3">
              <div className="rounded-[18px] border border-white/10 bg-white/[0.05] px-4 py-4">
                <div className="text-xs text-slate-400">{t("nutritionMyDiet.expertFile.fileName")}</div>
                <div className="mt-1 text-lg font-black text-white">{expertFile.title}</div>
                <div className="mt-2 text-xs text-slate-400">{expertFile.fileName}</div>
              </div>
              {expertFile.group?.name ? (
                <div className="rounded-[18px] border border-white/10 bg-white/[0.05] px-4 py-4">
                  <div className="text-xs text-slate-400">{t("nutritionMyDiet.expertFile.group")}</div>
                  <div className="mt-1 text-base font-black text-white">{expertFile.group.name}</div>
                </div>
              ) : null}
              {(expertFile.description || prescription.notes) ? (
                <div className="rounded-[18px] border border-white/10 bg-white/[0.05] px-4 py-4">
                  <div className="text-xs text-slate-400">{t("nutritionMyDiet.expertFile.notes")}</div>
                  <div className="mt-1 text-base leading-8 text-white">{expertFile.description || prescription.notes}</div>
                </div>
              ) : null}
              <a href={expertFile.fileUrl} target="_blank" rel="noreferrer" className="inline-flex h-12 w-full items-center justify-center rounded-[18px] bg-amber-400 text-sm font-black text-slate-950 shadow-[0_24px_55px_-30px_rgba(251,191,36,0.95)]">
                <Download className="ms-2 h-4 w-4" />
                {t("nutritionMyDiet.expertFile.download")}
              </a>
            </div>
          </section>

          {String(viewerMessage["body"] ?? "").trim() !== "" ? (
            <section className="rounded-[28px] border border-sky-400/20 bg-[linear-gradient(135deg,rgba(56,189,248,0.12),rgba(255,255,255,0.04))] p-4 shadow-[0_28px_70px_-48px_rgba(56,189,248,0.45)]">
              <div className="flex items-center gap-2 text-sm font-black text-sky-100">
                <FileText className="h-5 w-5 text-sky-300" />
                {String(viewerMessage["title"] ?? t("nutritionMyDiet.expertFile.expertMessage"))}
              </div>
              <div className="mt-3 whitespace-pre-wrap text-base leading-8 text-white">{String(viewerMessage["body"] ?? "")}</div>
            </section>
          ) : null}
        </div>
      </div>
    );
  }

  const backHref = match ? "/nutrition/my-diets" : "/nutrition/profile";

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-[#050607] px-3.5 py-4 pb-36 text-white" dir={dir}>
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.10),transparent_22%),linear-gradient(180deg,rgba(13,14,12,0.98),rgba(5,6,7,1)_42%,rgba(3,4,5,1))]" />
      <div className="fixed inset-x-0 top-0 -z-10 h-28 bg-[linear-gradient(180deg,rgba(251,191,36,0.08),transparent)]" />

      <div className="relative z-10 mx-auto max-w-md space-y-4">
        <NutritionDietViewerHeader backHref={backHref} onBack={() => setLocation(backHref)} />

        {!hasActiveMealFilter ? (
          <NutritionDietDayStrip
            days={days}
            activeDate={activeDate}
            todayIso={todayIso}
            isFinished={isDietFinished}
            hasUserSelectedDate={hasUserSelectedDate}
            onSelectDate={selectActiveDate}
            onSelectFinished={selectFinishedDietState}
          />
        ) : null}

        {match && prescription && !prescription.isCurrent && currentPrescription && currentPrescription.id !== prescription.id ? (
          <section className="rounded-[26px] border border-amber-300/20 bg-[linear-gradient(160deg,rgba(245,158,11,0.12),rgba(255,255,255,0.04))] p-4 shadow-[0_30px_80px_-48px_rgba(245,158,11,0.45)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-black text-white">{t("nutritionMyDiet.oldSession.title")}</div>
                <div className="mt-1 text-xs leading-6 text-amber-50/85">
                  {t("nutritionMyDiet.oldSession.description")}
                </div>
              </div>
              <Button
                type="button"
                onClick={() => setLocation("/nutrition/my-diet")}
                className="rounded-[18px] bg-amber-400 px-4 text-sm font-black text-slate-950 hover:bg-amber-300"
              >
                {t("nutritionMyDiet.oldSession.activeSession")}
              </Button>
            </div>
          </section>
        ) : null}

        {!hasActiveMealFilter && isDietFinished ? (
          <NutritionDietExpiredNotice onNewDiet={() => setLocation("/nutrition/diet-type")} />
        ) : null}

        {!isFixedTextPrescription ? (
          <DailyNutritionOverviewCard
            summary={selectedDailyNutritionSummary}
            activeDate={activeDate}
            dailyCalorieTarget={dailyCalorieTarget}
            showExercise={exerciseLoggingEnabled}
          />
        ) : null}

        {false && !isFixedTextPrescription && exerciseLoggingEnabled ? (
          <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(155deg,rgba(8,27,36,0.98),rgba(7,18,30,0.95))] p-4 shadow-[0_30px_80px_-46px_rgba(0,0,0,0.9)]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-emerald-200/75">{t("nutritionMyDiet.exercise.todayActivity")}</div>
                <div className="mt-1 text-xl font-black text-white">{t("nutritionMyDiet.exercise.title")}</div>
                <div className="mt-2 text-xs leading-6 text-slate-300">
                  {t("nutritionMyDiet.exercise.description")}
                </div>
              </div>
              <Button className="shrink-0 rounded-2xl bg-emerald-400 text-slate-950 hover:bg-emerald-300" onClick={openExercisePage}>
                <Dumbbell className="me-2 h-4 w-4" />
                {t("nutritionMyDiet.exercise.openPage")}
              </Button>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="rounded-[20px] border border-white/10 bg-white/[0.05] px-3 py-3">
                <div className="text-[10px] font-bold text-slate-400">{t("nutritionMyDiet.exercise.burnedCalories")}</div>
                <div className="mt-2 text-lg font-black text-emerald-300">{format.number(selectedDailyNutritionSummary.burnedCalories, { maximumFractionDigits: 1 })} kcal</div>
              </div>
              <div className="rounded-[20px] border border-white/10 bg-white/[0.05] px-3 py-3">
                <div className="text-[10px] font-bold text-slate-400">{t("nutritionMyDiet.exercise.count")}</div>
                <div className="mt-2 text-lg font-black text-white">{format.number(selectedDailyNutritionSummary.loggedExercises, { maximumFractionDigits: 0 })}</div>
              </div>
              <div className="rounded-[20px] border border-white/10 bg-white/[0.05] px-3 py-3">
                <div className="text-[10px] font-bold text-slate-400">{t("nutritionMyDiet.exercise.netCalories")}</div>
                <div className="mt-2 text-lg font-black text-amber-200">{format.number(selectedDailyNutritionSummary.netCalories, { maximumFractionDigits: 1 })} kcal</div>
              </div>
            </div>

            {overTargetCalories > 0 ? (
              remainingOverTargetCalories > 0 ? (
                <div className={cn(
                  "mt-4 rounded-[22px] border p-4",
                  compensatedCalories > 0
                    ? "border-amber-300/20 bg-[linear-gradient(135deg,rgba(251,191,36,0.12),rgba(244,63,94,0.08))]"
                    : "border-rose-300/20 bg-rose-400/10",
                )}>
                  <div className={cn("text-sm font-black", compensatedCalories > 0 ? "text-amber-100" : "text-rose-100")}>
                    {compensatedCalories > 0
                      ? t("nutritionMyDiet.exercise.overCompensated", {
                        over: format.number(overTargetCalories, { maximumFractionDigits: 1 }),
                        compensated: format.number(compensatedCalories, { maximumFractionDigits: 1 }),
                      })
                      : t("nutritionMyDiet.exercise.overTarget", { over: format.number(overTargetCalories, { maximumFractionDigits: 1 }) })}
                  </div>
                  <div className={cn("mt-1 text-xs leading-6", compensatedCalories > 0 ? "text-amber-50/85" : "text-rose-100/85")}>
                    {compensatedCalories > 0
                      ? t("nutritionMyDiet.exercise.remainingCompensation", { remaining: format.number(remainingOverTargetCalories, { maximumFractionDigits: 1 }) })
                      : t("nutritionMyDiet.exercise.manageOverTarget")}
                  </div>
                  <Button
                    className={cn(
                      "mt-3 rounded-2xl bg-white",
                      compensatedCalories > 0 ? "text-amber-700 hover:bg-amber-50" : "text-rose-700 hover:bg-rose-50",
                    )}
                    onClick={openExercisePage}
                  >
                    {compensatedCalories > 0 ? t("nutritionMyDiet.exercise.continueCompensation") : t("nutritionMyDiet.exercise.suggestCompensation")}
                  </Button>
                </div>
              ) : (
                <div className="mt-4 rounded-[22px] border border-emerald-300/20 bg-[linear-gradient(135deg,rgba(16,185,129,0.16),rgba(45,212,191,0.08))] p-4 shadow-[0_28px_70px_-48px_rgba(16,185,129,0.45)]">
                  <div className="text-sm font-black text-emerald-100">
                    {extraBurnedCalories > 0
                      ? t("nutritionMyDiet.exercise.extraBurned", {
                        over: format.number(overTargetCalories, { maximumFractionDigits: 1 }),
                        extra: format.number(extraBurnedCalories, { maximumFractionDigits: 1 }),
                      })
                      : t("nutritionMyDiet.exercise.fullyCompensated", { over: format.number(overTargetCalories, { maximumFractionDigits: 1 }) })}
                  </div>
                  <div className="mt-1 text-xs leading-6 text-emerald-50/85">
                    {extraBurnedCalories > 0
                      ? t("nutritionMyDiet.exercise.extraAllowance", { extra: format.number(extraBurnedCalories, { maximumFractionDigits: 1 }) })
                      : t("nutritionMyDiet.exercise.balanceRestored")}
                  </div>
                </div>
              )
            ) : null}
            <div className="mt-4 space-y-3">
              {selectedExerciseLogs.length > 0 ? selectedExerciseLogs.map((log) => {
                const Icon = getNutritionExerciseIcon(log.iconKey);

                return (
                  <div key={log.id} className="flex items-start justify-between gap-3 rounded-[20px] border border-white/10 bg-white/[0.04] p-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-white/10 bg-white/[0.06]">
                        <Icon className="h-4 w-4 text-emerald-300" />
                      </div>
                      <div>
                        <div className="text-sm font-black text-white">{log.title}</div>
                        <div className="mt-1 text-[11px] text-slate-400">
                          {t("nutritionMyDiet.exercise.groupIntensity", { group: log.groupTitle ?? "", intensity: exerciseIntensityLabel(log.intensity) })}
                        </div>
                        <div className="mt-1 text-[11px] leading-6 text-slate-300">
                          {t("nutritionMyDiet.exercise.duration", { duration: format.number(log.durationMinutes, { maximumFractionDigits: 0 }) })}
                          {log.speedKmh ? t("nutritionMyDiet.exercise.speed", { speed: format.number(log.speedKmh, { maximumFractionDigits: 1 }) }) : ""}
                          {log.distanceKm ? t("nutritionMyDiet.exercise.distance", { distance: format.number(log.distanceKm, { maximumFractionDigits: 1 }) }) : ""}
                        </div>
                      </div>
                    </div>
                    <div className="rounded-[14px] border border-emerald-300/20 bg-emerald-400/10 px-2.5 py-1.5 text-xs font-black text-emerald-200">
                      {format.number(log.caloriesBurned, { maximumFractionDigits: 1 })} kcal
                    </div>
                  </div>
                );
              }) : (
                <div className="rounded-[22px] border border-dashed border-white/12 bg-white/[0.03] px-4 py-4 text-sm leading-7 text-slate-400">
                  {t("nutritionMyDiet.exercise.empty")}
                </div>
              )}

              <Button
                variant="outline"
                className="h-9 w-full rounded-[16px] border-white/10 bg-white/[0.04] px-3 text-sm font-black text-white hover:bg-white/[0.08]"
                onClick={openExercisePage}
              >
                <PlusCircle className="me-2 h-4 w-4 text-emerald-300" />
                {t("nutritionMyDiet.exercise.addNew")}
              </Button>
            </div>
          </section>
        ) : null}

        {false && !hasActiveMealFilter && !isFixedTextPrescription && (Number(caloriePlan["base_calories"] ?? 0) > 0 || Number(caloriePlan["prescribed_calories"] ?? 0) > 0) ? (
          <section className="rounded-[28px] border border-emerald-400/20 bg-emerald-400/10 p-4 shadow-[0_28px_70px_-48px_rgba(16,185,129,0.45)]">
            <div className="flex items-center gap-2 text-sm font-black text-emerald-100">
              <BadgeCheck className="h-5 w-5 text-emerald-300" />
              {t("nutritionMyDiet.caloriePlan.title")}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-[18px] border border-white/10 bg-white/[0.05] px-3 py-3">
                <div className="text-xs text-emerald-100/70">{t("nutritionMyDiet.caloriePlan.base")}</div>
                <div className="mt-1 text-lg font-black text-white">{format.number(Number(caloriePlan["base_calories"] ?? 0), { maximumFractionDigits: 1 })} kcal</div>
              </div>
              <div className="rounded-[18px] border border-white/10 bg-white/[0.05] px-3 py-3">
                <div className="text-xs text-emerald-100/70">{t("nutritionMyDiet.caloriePlan.prescribed")}</div>
                <div className="mt-1 text-lg font-black text-white">{format.number(Number(caloriePlan["prescribed_calories"] ?? 0), { maximumFractionDigits: 1 })} kcal</div>
              </div>
            </div>
          </section>
        ) : null}

        {false && !hasActiveMealFilter && !isFixedTextPrescription ? <section className="rounded-[28px] border border-amber-300/20 bg-[linear-gradient(135deg,rgba(251,191,36,0.14),rgba(255,255,255,0.04))] p-4 shadow-[0_28px_70px_-48px_rgba(251,191,36,0.5)]">
          <div className="flex items-center gap-2 text-sm font-black text-amber-100">
            <Sparkles className="h-5 w-5 text-amber-300" />
            {t("nutritionMyDiet.reminder.title")}
          </div>
          <div className="mt-3 text-base font-black leading-8 text-white">{userReminder}</div>
        </section> : null}

        {!hasActiveMealFilter && String(viewerMessage["body"] ?? "").trim() !== "" ? (
          <section className="rounded-[28px] border border-sky-400/20 bg-[linear-gradient(135deg,rgba(56,189,248,0.12),rgba(255,255,255,0.04))] p-4 shadow-[0_28px_70px_-48px_rgba(56,189,248,0.45)]">
            <div className="flex items-center gap-2 text-sm font-black text-sky-100">
              <FileText className="h-5 w-5 text-sky-300" />
              {String(viewerMessage["title"] ?? t("nutritionMyDiet.expertFile.expertMessage"))}
            </div>
            <div className="mt-3 text-base leading-8 text-white">{String(viewerMessage["body"] ?? "")}</div>
          </section>
        ) : null}

        {!hasActiveMealFilter && !isFixedTextPrescription ? (
          <section className="pt-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 text-start">
                <div className="text-[17px] font-extrabold leading-7 text-white">{t("nutritionMyDiet.meals.todayTitle")}</div>
                <div className="mt-0.5 text-[10px] font-extrabold leading-5 text-slate-500">
                  {t("nutritionMyDiet.meals.todayDescription")}
                </div>
              </div>
              <div className="shrink-0 pt-1.5 text-[10px] font-extrabold text-slate-500">
                {formatDietDate(activeDate)}
              </div>
            </div>
            {showDailyPrescriptionFinishedEmptyState ? (
              <div className="mt-3 rounded-[22px] border border-rose-400/30 bg-[linear-gradient(135deg,rgba(244,63,94,0.18),rgba(127,29,29,0.12))] p-4 shadow-[0_24px_70px_-50px_rgba(244,63,94,0.55)]">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[15px] border border-rose-300/24 bg-rose-300/12 text-rose-200">
                    <Frown className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-black leading-7 text-rose-50">{t("nutritionMyDiet.meals.finishedEmpty")}</div>
                    <Button
                      type="button"
                      onClick={() => setLocation("/nutrition/diet-type")}
                      className="mt-3 h-10 w-full rounded-[15px] bg-rose-400 text-[12px] font-black text-white shadow-[0_18px_42px_-28px_rgba(244,63,94,0.9)] hover:bg-rose-300"
                    >
                      {t("nutritionMyDiet.expired.newDiet")}
                      <ForwardArrow className="ms-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {prescription?.prescriptionMode === "user_choice" ? (
          <section className="space-y-4">
            {false && days.length > 0 && !hasActiveMealFilter ? (
              <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(160deg,rgba(18,34,49,0.95),rgba(11,22,35,0.9))] p-4 shadow-[0_30px_80px_-45px_rgba(0,0,0,0.9)]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-lg font-black text-white">{t("nutritionMyDiet.dayStatus.title")}</div>
                    <div className="mt-1 text-xs leading-6 text-slate-400">
                      {prescription?.prescriptionMode === "daily_prescription"
                        ? t("nutritionMyDiet.dayStatus.dailyDescription")
                        : t("nutritionMyDiet.dayStatus.choiceDescription")}
                    </div>
                  </div>
                  <div className="rounded-[18px] border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-black text-white">
                    {activeDate ? formatDietDate(activeDate) : "—"}
                  </div>
                </div>

                <div className="mt-4 -mx-1 overflow-x-auto px-1 pb-2 [scrollbar-color:rgba(251,191,36,0.55)_rgba(255,255,255,0.08)] [scrollbar-width:thin]">
                  <div className="flex min-w-max gap-3">
                  {days.map((day) => {
                    const progress = mealProgressByDate.find((item) => item.iso === day.iso);
                    const active = day.iso === activeDate;

                    return (
                      <button
                        key={day.iso}
                        type="button"
                        onClick={() => selectActiveDate(day.iso)}
                        className={cn(
                          "min-w-[104px] rounded-[20px] border px-3 py-3 text-start transition",
                          active ? "border-amber-300/25 bg-amber-300/12 text-white" : "border-white/10 bg-white/[0.04] text-slate-200",
                        )}
                      >
                        <div className="text-xs font-bold">
                          {day.label}
                          {prescription?.prescriptionMode === "daily_prescription" ? (
                            <span className="ms-1 text-[10px] font-medium text-slate-300/85">
                              ({day.shortDateLabel})
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-3 text-[11px] font-black">
                          {progress?.state === "complete" ? t("nutritionMyDiet.history.status.complete") : progress?.state === "partial" ? t("nutritionMyDiet.history.status.partial") : t("nutritionMyDiet.history.status.none")}
                        </div>
                      </button>
                    );
                  })}
                  </div>
                </div>
              </section>
            ) : null}

            {prescription.prescriptionMode === "user_choice" ? mealSlots.map((slot, index) => {
              const data = typeof slot === "object" && slot ? (slot as Record<string, unknown>) : {};
              const options = Array.isArray(data["options"]) ? data["options"] : [];
              const slotKey = String(data["slot_key"] ?? "");
              const sectionAnchorKey = normalizeMealSlotKey(((data["slot_key"] ?? data["key"] ?? data["title"] ?? slotKey) || `meal_${index + 1}`));
              if (hasActiveMealFilter && sectionAnchorKey !== selectedMealFilterKey) {
                return null;
              }
              const selectedLog = selectedMealLogMap.get(slotKey);
              const manualLogs = selectedManualMealLogMap.get(slotKey) ?? [];
              const hasManualLogs = manualLogs.length > 0;
              const mealHasLoggedFood = Boolean(selectedLog) || hasManualLogs;
              const mealPanelKey = `meal-panel:${activeDate || "no-date"}:${slotKey || sectionAnchorKey}`;
              const mealPanelOpen = expandedPanelKeys.includes(mealPanelKey);
              const selectedFoodTitle = String(selectedLog?.foodTitle ?? "").trim();
              const choiceChangeKey = `${activeDate || "no-date"}:${slotKey}`;
              const hasRegisteredChoice = Boolean(selectedLog && !selectedLog.isManual);
              const isChangingChoice = changingChoiceKeys.includes(choiceChangeKey);
              const selectedOptionIndex = hasRegisteredChoice
                ? options.findIndex((option) => {
                    const optionData = typeof option === "object" && option ? (option as Record<string, unknown>) : {};
                    return String(optionData["title"] ?? "") === selectedFoodTitle;
                  })
                : -1;
              const selectedChoiceCardKey = selectedOptionIndex >= 0 && !isChangingChoice
                ? `${activeDate || "no-date"}:${slotKey}:${selectedOptionIndex}`
                : undefined;
              const shouldHideUnselectedChoices = mealHasLoggedFood && !isChangingChoice;
              const visibleOptions = hasRegisteredChoice && shouldHideUnselectedChoices
                ? options.filter((option) => {
                    const optionData = typeof option === "object" && option ? (option as Record<string, unknown>) : {};
                    return String(optionData["title"] ?? "") === selectedFoodTitle;
                  })
                : options;
              const renderedOptions = shouldHideUnselectedChoices && !hasRegisteredChoice ? [] : visibleOptions;

              return (
                <NutritionDietMealShell
                  id={`meal-section-${sectionAnchorKey}`}
                  key={`slot-${index}`}
                  selected={mealHasLoggedFood}
                  expanded={mealPanelOpen}
                >
                  <button
                    type="button"
                    onClick={() => toggleMealPanel(mealPanelKey, selectedChoiceCardKey)}
                    className="flex min-h-[70px] w-full items-center justify-between gap-2.5 px-3 py-3 text-start"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2.5">
                      <NutritionMealNumberBadge index={index + 1} selected={mealHasLoggedFood} />
                      <div className="min-w-0">
                        <div className="text-[14px] font-extrabold leading-6 text-white">{String(data["title"] ?? t("nutritionMyDiet.mealCard.defaultMeal"))}</div>
                        <div className={cn(
                          "mt-0.5 line-clamp-1 text-[10px] font-extrabold leading-5",
                          mealHasLoggedFood ? "text-emerald-300" : "text-slate-500",
                        )}>
                          {selectedLog
                            ? t("nutritionMyDiet.mealCard.loggedChoice", { title: selectedFoodTitle || t("nutritionMyDiet.mealCard.yourChoice") })
                            : hasManualLogs
                              ? t("nutritionMyDiet.mealCard.outOfPlanLogged")
                              : t("nutritionMyDiet.mealCard.notSelected")}
                        </div>
                      </div>
                    </div>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px] text-slate-400">
                      <ChevronDown className={cn("h-5 w-5 transition-transform", mealPanelOpen ? "rotate-180" : "")} />
                    </span>
                  </button>

                  {mealPanelOpen ? <div className="space-y-3 px-3.5 pb-4 pt-0">
                    {!shouldHideUnselectedChoices ? (
                      <div className="mb-1 px-1.5 pb-1 pt-2 text-center">
                        <div className="min-w-0">
                          <div className="whitespace-nowrap text-center text-[12px] font-black leading-6 text-white min-[390px]:text-[13px] sm:text-[15px]">
                            {t("nutritionMyDiet.mealCard.chooseOne", { count: format.number(options.length, { maximumFractionDigits: 0 }) })}
                          </div>
                        </div>
                        <div className="nutrition-choice-hint-icon mx-auto mt-1 flex h-[42px] w-[42px] items-center justify-center">
                          <span aria-hidden="true" className="text-[27px] leading-none drop-shadow-[0_2px_3px_rgba(0,0,0,0.35)]">👇</span>
                        </div>
                        <div aria-hidden="true" className="mx-auto mt-1 w-[70%] border-t border-dashed border-amber-300/30 [mask-image:linear-gradient(to_right,transparent,black_24%,black_76%,transparent)]" />
                      </div>
                    ) : null}
                    {renderedOptions.map((option) => {
                      const optionData = typeof option === "object" && option ? (option as Record<string, unknown>) : {};
                      const optionIndex = Math.max(0, options.indexOf(option));
                      const isSelected = selectedLog?.foodTitle === String(optionData["title"] ?? "") && !selectedLog?.isManual;
                      const choiceCardKey = `${activeDate || "no-date"}:${slotKey}:${optionIndex}`;
                      const isExpanded = expandedChoiceKeys.includes(choiceCardKey);

                      return (
                        <div
                          key={`option-${optionIndex}`}
                          role="button"
                          tabIndex={0}
                          onClick={() => toggleChoiceCard(choiceCardKey)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              toggleChoiceCard(choiceCardKey);
                            }
                          }}
                          className={cn(
                            "relative cursor-pointer rounded-[20px] border transition",
                            isSelected
                              ? "border-emerald-300/35 bg-[linear-gradient(180deg,rgba(16,185,129,0.13),rgba(16,185,129,0.045))] shadow-[0_24px_55px_-44px_rgba(16,185,129,0.75)]"
                              : isExpanded
                                ? "border-amber-300/28 bg-[linear-gradient(180deg,rgba(28,27,24,0.96),rgba(18,19,19,0.995))]"
                                : "border-white/10 bg-[linear-gradient(180deg,rgba(17,19,24,0.98),rgba(10,11,14,0.99))]",
                            isExpanded ? "px-3.5 py-4" : "px-3.5 py-3.5",
                          )}
                        >
                          <div className="flex items-start justify-between gap-2.5">
                            <NutritionMealChoiceBadge index={optionIndex + 1} selected={isSelected} />
                            <div className="min-w-0 flex-1">
                              <div className={cn(
                                "line-clamp-2 text-[15px] font-extrabold leading-6 text-white",
                                !isExpanded ? "pt-1" : "",
                              )}>
                                {String(optionData["title"] ?? t("nutritionMyDiet.mealCard.food"))}
                              </div>
                              {isSelected ? (
                                <div className="mt-1.5 inline-flex rounded-[12px] border border-emerald-300/20 bg-emerald-300/14 px-2.5 py-1 text-[10px] font-extrabold text-emerald-200">
                                  {t("nutritionMyDiet.mealCard.logged")}
                                </div>
                              ) : null}
                            </div>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                toggleChoiceCard(choiceCardKey);
                              }}
                              className="flex h-8 shrink-0 items-center gap-1.5 rounded-[12px] px-1 text-[11px] font-extrabold text-slate-500 transition hover:text-slate-200"
                            >
                              <ChevronDown className={cn("h-4 w-4 transition-transform", isExpanded ? "rotate-180" : "")} />
                              {t("nutritionMyDiet.mealCard.details")}
                            </button>
                          </div>
                          {isExpanded ? (
                            <NutritionMealDetailsBlock
                              title={optionData["title"]}
                              description={optionData["description"]}
                              preparationText={buildPreparationText({
                                title: optionData["title"],
                                quantityText: optionData["quantity_text"],
                                explicitPreparation: optionData["preparation_text"],
                                description: optionData["description"],
                                t,
                                format,
                              })}
                              quantityText={quantityWithGrams(optionData["quantity_text"], optionData["grams"], format, t)}
                              rawQuantityText={optionData["quantity_text"]}
                              source={optionData}
                              calories={optionData["calories"] as number | string | null}
                              action={
                                <Button
                                  type="button"
                                  disabled={savingMealKey === slotKey}
                                  aria-disabled={!canRegisterFoodForActiveDate}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    return isSelected && selectedLog?.id
                                      ? deleteMeal(selectedLog.id, slotKey)
                                      : saveMeal({
                                          mealSlotKey: slotKey,
                                          slotTitle: String(data["title"] ?? ""),
                                          foodTitle: String(optionData["title"] ?? ""),
                                          foodDescription: String(optionData["description"] ?? ""),
                                          quantityText: formatQuantityText(optionData["quantity_text"], { t, format }),
                                          optionCalories: Number(optionData["calories"] ?? 0) || null,
                                          proteinGrams: macroValue(optionData, "protein_grams") || null,
                                          fatGrams: macroValue(optionData, "fat_grams") || null,
                                          carbohydrateGrams: macroValue(optionData, "carbohydrate_grams") || null,
                                          fiberGrams: macroValue(optionData, "fiber_grams") || null,
                                        });
                                  }}
                                  className={cn(
                                    "mt-5 h-[52px] w-full rounded-[16px] !text-[15px] font-extrabold text-slate-950 shadow-[0_18px_36px_-26px_rgba(251,191,36,0.95)] hover:opacity-95",
                                    isSelected
                                      ? "bg-[linear-gradient(135deg,#10b981,#34d399)] shadow-[0_20px_42px_-28px_rgba(16,185,129,0.9)]"
                                      : "bg-[linear-gradient(135deg,#fbbf24,#f59e0b)]",
                                    !canRegisterFoodForActiveDate ? "cursor-not-allowed opacity-55 saturate-75 hover:opacity-70" : "",
                                  )}
                                >
                                  {savingMealKey === slotKey ? <Loader2 className="ms-2 h-4.5 w-4.5 animate-spin" /> : <ArrowDown className="ms-2 h-4.5 w-4.5" />}
                                  {isSelected ? t("nutritionMyDiet.mealCard.loggedForDay") : t("nutritionMyDiet.mealCard.ateThisFood")}
                                </Button>
                              }
                            />
                          ) : null}
                        </div>
                      );
                    })}

                    {shouldHideUnselectedChoices ? (
                      <button
                        type="button"
                        onClick={() => revealMealChoices(choiceChangeKey)}
                        className="block w-full rounded-[16px] border border-emerald-300/28 bg-[linear-gradient(180deg,rgba(16,185,129,0.12),rgba(16,185,129,0.055))] p-3 text-start shadow-[0_18px_48px_-42px_rgba(16,185,129,0.75),inset_0_1px_0_rgba(255,255,255,0.04)] transition hover:border-emerald-300/40 hover:bg-emerald-300/[0.1]"
                      >
                        <div className="flex items-start gap-2.5">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-300 text-slate-950 shadow-[0_14px_30px_-23px_rgba(52,211,153,0.95)]">
                            <CheckCircle2 className="h-4.5 w-4.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-[13px] font-black leading-6 text-emerald-100">
                              {t("nutritionMyDiet.mealCard.mealLoggedTitle")}
                            </div>
                            <div className="mt-0.5 text-[10px] font-semibold leading-5 text-emerald-50/60">
                              {t("nutritionMyDiet.mealCard.mealLoggedDescription")}
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              revealMealChoices(choiceChangeKey);
                            }}
                            className="flex h-9 items-center justify-center gap-1.5 rounded-[12px] border border-white/12 bg-white/[0.055] text-[11px] font-black text-slate-100 transition hover:bg-white/[0.09]"
                          >
                            <RefreshCcw className="h-3.5 w-3.5" />
                            {t("nutritionMyDiet.mealCard.changeFood")}
                          </button>
                          <button
                            type="button"
                            disabled={!selectedLog?.id || savingMealKey === slotKey}
                            onClick={(event) => {
                              event.stopPropagation();
                              if (selectedLog?.id) {
                                void deleteMeal(selectedLog.id, slotKey);
                              }
                            }}
                            className="flex h-9 items-center justify-center gap-1.5 rounded-[12px] border border-rose-300/24 bg-rose-300/[0.07] text-[11px] font-black text-rose-200 transition hover:bg-rose-300/[0.12] disabled:opacity-55"
                          >
                            {savingMealKey === slotKey ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CircleMinus className="h-3.5 w-3.5" />}
                            {t("nutritionMyDiet.mealCard.cancelMealLog")}
                          </button>
                        </div>
                      </button>
                    ) : null}

                    {manualLogs.length > 0 ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 px-1">
                          <div className="text-[14px] font-extrabold text-amber-200">{t("nutritionMyDiet.manualLog.sectionTitle")}</div>
                          <div className="h-px flex-1 bg-white/10" />
                          <div className="rounded-full bg-white/[0.045] px-3 py-1 text-[11px] font-extrabold text-slate-400">
                            {t("nutritionMyDiet.manualLog.itemCount", { count: format.number(manualLogs.length, { maximumFractionDigits: 0 }) })}
                          </div>
                        </div>
                        {manualLogs.map((log: MealLogView) => {
                          const manualDescription = formatManualMetaText(log.foodDescription, t);
                          const manualNotes = formatManualMetaText(log.notes, t);
                          const loggedCalorieValue = Number(log.calories ?? extractLoggedCalories(log.notes) ?? 0);
                          const hasValidCalories = Number.isFinite(loggedCalorieValue) && loggedCalorieValue > 0;
                          const isAiPending = ["queued", "processing"].includes(String(log.aiNutritionStatus ?? ""));
                          const isDeleting = deletingOtherMealId === log.id;

                          return (
                          <div key={log.id} className="overflow-hidden rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(17,19,24,0.98),rgba(10,12,16,0.99))] shadow-[0_24px_55px_-48px_rgba(0,0,0,0.95)]">
                            <div className="p-4">
                              <div className="flex items-start gap-3">
                                {log.photoUrl ? (
                                  <button
                                    type="button"
                                    onClick={() => setMealPhotoPreview({ url: log.photoUrl ?? "", title: log.foodTitle ?? t("nutritionMyDiet.manualLog.photoAlt") })}
                                    className="group relative h-[78px] w-[78px] shrink-0 overflow-hidden rounded-[18px] border border-amber-300/12 bg-amber-300/10 text-amber-100"
                                  >
                                    <img src={log.photoUrl} alt={log.foodTitle ?? t("nutritionMyDiet.manualLog.photoAlt")} className="h-full w-full object-cover opacity-75 transition group-hover:opacity-90" />
                                    <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(251,191,36,0.18),rgba(0,0,0,0.52))]" />
                                    <div className="absolute inset-x-1 bottom-1 rounded-[10px] bg-black/50 px-1.5 py-1 text-[9px] font-extrabold backdrop-blur">
                                      {t("nutritionMyDiet.manualLog.viewPhoto")}
                                    </div>
                                    <Camera className="absolute inset-x-0 top-1/2 mx-auto h-6 w-6 -translate-y-1/2 text-amber-100/90" />
                                  </button>
                                ) : null}
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="min-w-0 text-[17px] font-extrabold leading-7 text-white">{log.foodTitle ?? t("nutritionMyDiet.manualLog.defaultFood")}</div>
                                    {log.manualEntryMethod === "photo" ? (
                                      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/12 bg-amber-300/10 px-3 py-1 text-[11px] font-extrabold text-amber-200">
                                        <Camera className="h-3.5 w-3.5" />
                                        {t("nutritionMyDiet.manualLog.withPhoto")}
                                      </span>
                                    ) : null}
                                  </div>
                                  {manualDescription !== "" ? (
                                    <div className="mt-1 text-[13px] font-semibold leading-6 text-slate-400">{manualDescription}</div>
                                  ) : null}
                                  <div className="mt-3 flex min-w-0 items-center gap-2">
                                    {hasValidCalories ? (
                                      <span className="inline-flex shrink-0 rounded-[13px] bg-emerald-300/12 px-3 py-1.5 text-[13px] font-extrabold text-emerald-300">
                                        {t("nutritionProfileHome.kcalValue", { count: formatDietNumber(loggedCalorieValue) })}
                                      </span>
                                    ) : null}
                                    {String(log.quantityText ?? "").trim() !== "" ? (
                                      <span className="min-w-0 truncate text-[12px] font-semibold leading-6 text-slate-500">
                                        ≈ {String(log.quantityText).replace(/^≈\s*/, "")}
                                      </span>
                                    ) : null}
                                  </div>
                                </div>
                              </div>

                              {isAiPending ? (
                                <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1.5 text-[11px] font-black text-amber-100">
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  {t("nutritionMyDiet.manualLog.aiPending")}
                                </div>
                              ) : log.aiNutritionStatus === "generated" ? (
                                <div className="mt-4 text-[11px] font-black text-emerald-100">
                                  {t("nutritionMyDiet.manualLog.aiGenerated", { calories: formatDietNumber(log.calories ?? extractLoggedCalories(log.notes)) })}
                                </div>
                              ) : log.aiNutritionStatus === "failed" ? (
                                <div className="mt-4 text-[11px] font-black text-rose-100">
                                  {t("nutritionMyDiet.manualLog.aiFailed")}
                                </div>
                              ) : null}

                              {manualNotes !== "" ? (
                                <div className="mt-4 rounded-[18px] border border-white/8 bg-white/[0.04] px-4 py-3 text-[12px] font-semibold leading-7 text-slate-400">
                                  <span className="font-extrabold text-slate-200">{t("nutritionMyDiet.manualLog.systemNoteLabel")} </span>
                                  {manualNotes}
                                </div>
                              ) : null}
                            </div>

                            <div className="border-t border-white/8 px-4 py-3">
                              <button
                                type="button"
                                onClick={() => void deleteOtherMeal(log.id)}
                                disabled={isDeleting}
                                aria-label={isAiPending ? t("nutritionMyDiet.manualLog.cancelAndDeleteAria") : t("nutritionMyDiet.manualLog.deleteAria")}
                                className="mx-auto flex min-h-9 items-center justify-center gap-2 rounded-[12px] px-3 text-[13px] font-extrabold text-rose-300 transition hover:bg-rose-300/8 disabled:opacity-60"
                              >
                                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                {isAiPending ? t("nutritionMyDiet.manualLog.cancelAndDelete") : t("nutritionMyDiet.manualLog.delete")}
                              </button>
                            </div>
                          </div>
                          );
                        })}
                      </div>
                    ) : null}

                    {outOfPlanMealLoggingEnabled && activeDate === todayIso && canRegisterFoodForActiveDate ? (
                      <NutritionOtherMealButton
                        manualCount={manualLogs.length}
                        photoEnabled={mealPhotoAnalysisEnabled}
                        hasScheduledMeal={mealHasLoggedFood}
                        onClick={() => openOtherMealModal(slotKey, String(data["title"] ?? ""))}
                      />
                    ) : null}
                  </div> : null}
                </NutritionDietMealShell>
              );
            }) : null}
          </section>
        ) : null}

        {false && historyDays.length > 0 && !hasActiveMealFilter ? (
          <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(160deg,rgba(18,34,49,0.95),rgba(11,22,35,0.9))] p-4 shadow-[0_30px_80px_-45px_rgba(0,0,0,0.9)]">
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="text-lg font-black text-white">{t("nutritionMyDiet.history.title")}</div>
                  <div className="text-xs leading-6 text-slate-400">
                    {t("nutritionMyDiet.history.description")}
                  </div>
                </div>
                <div className={`rounded-full border px-3 py-1 text-[11px] font-black ${dietStatus.tone}`}>
                  {t(dietStatus.labelKey)}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-[18px] border border-white/10 bg-white/[0.04] px-3 py-3">
                  <div className="text-[10px] font-bold text-slate-400">{t("nutritionMyDiet.history.loggedDays")}</div>
                  <div className="mt-2 text-base font-black text-white">{format.number(loggedDaysCount, { maximumFractionDigits: 0 })}</div>
                </div>
                <div className="rounded-[18px] border border-white/10 bg-white/[0.04] px-3 py-3">
                  <div className="text-[10px] font-bold text-slate-400">{t("nutritionMyDiet.history.totalDays")}</div>
                  <div className="mt-2 text-base font-black text-white">{format.number(historyDays.length, { maximumFractionDigits: 0 })}</div>
                </div>
                <div className="rounded-[18px] border border-emerald-300/20 bg-emerald-300/10 px-3 py-3">
                  <div className="text-[10px] font-bold text-emerald-100/70">{t("nutritionMyDiet.expertFile.statusLabel")}</div>
                  <div className="mt-2 text-base font-black text-emerald-50">{t(getDietStatusLabelKey(prescription?.startedAt, prescription?.endsAt))}</div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setHistoryOpen((current) => !current)}
                className="flex w-full items-center justify-between rounded-[22px] border border-white/10 bg-white/[0.05] px-4 py-4 text-start transition hover:bg-white/[0.08]"
              >
                <div>
                  <div className="text-base font-black text-white">
                    {historyOpen ? t("nutritionMyDiet.history.close") : t("nutritionMyDiet.history.open")}
                  </div>
                  <div className="mt-1 text-[11px] leading-6 text-slate-400">
                    {historyOpen
                      ? t("nutritionMyDiet.history.openDescription")
                      : t("nutritionMyDiet.history.closedDescription")}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-black text-slate-200">
                    {t("nutritionMyDiet.history.progress", { current: format.number(loggedDaysCount, { maximumFractionDigits: 0 }), total: format.number(historyDays.length, { maximumFractionDigits: 0 }) })}
                  </div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-[16px] border border-white/10 bg-white/[0.05]">
                    <ChevronDown className={cn("h-5 w-5 text-white transition", historyOpen ? "rotate-180" : "")} />
                  </div>
                </div>
              </button>
            </div>

            {historyOpen ? (
            <div className="mt-4 space-y-3">
              {historyDays.map((day) => (
                <button
                  key={`history-${day.iso}`}
                  type="button"
                  onClick={() => selectActiveDate(day.iso)}
                  className={cn(
                    "block w-full rounded-[22px] border px-4 py-4 text-start transition",
                    day.iso === activeDate ? "border-amber-300/25 bg-amber-300/10" : "border-white/10 bg-white/[0.04]",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-black text-white">
                        {day.label} | {day.dateLabel}
                      </div>
                      <div className="mt-1 text-[11px] text-slate-400">
                        {day.progress?.state === "complete" ? t("nutritionMyDiet.history.dayComplete") : day.progress?.state === "partial" ? t("nutritionMyDiet.history.dayPartial") : t("nutritionMyDiet.history.dayEmpty")}
                      </div>
                    </div>
                    <div className={cn(
                      "rounded-full border px-3 py-1 text-[11px] font-black",
                      day.progress?.state === "complete"
                        ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100"
                        : day.progress?.state === "partial"
                          ? "border-amber-300/20 bg-amber-300/10 text-amber-100"
                          : "border-white/10 bg-white/[0.05] text-slate-300",
                    )}>
                      {day.progress?.state === "complete" ? t("nutritionMyDiet.history.status.complete") : day.progress?.state === "partial" ? t("nutritionMyDiet.history.status.partial") : t("nutritionMyDiet.history.status.none")}
                    </div>
                  </div>

                  <div className="mt-3 space-y-2">
                    {day.logs.length > 0 ? day.logs.map(([slotKey, log]) => (
                      <div key={`${day.iso}-${slotKey}`} className="rounded-[16px] border border-white/10 bg-white/[0.05] px-3 py-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs font-bold text-slate-400">
                            {expectedSlotsByDate.get(day.iso)?.find((slot) => slot.key === slotKey)?.title ?? mealSlotLabel(slotKey, t)}
                          </div>
                          {log.isManual ? <span className="rounded-full border border-rose-300/15 bg-rose-300/10 px-2 py-1 text-[10px] font-black text-rose-100">{t("nutritionMyDiet.manualLog.defaultFood")}</span> : null}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <div className="text-sm font-black text-white">{log.foodTitle ?? "—"}</div>
                          {log.manualEntryMethod === "photo" ? (
                            <span className="rounded-full border border-sky-300/20 bg-sky-300/10 px-2 py-0.5 text-[10px] font-black text-sky-100">
                              {t("nutritionMyDiet.manualLog.withPhoto")}
                            </span>
                          ) : null}
                        </div>
                        {String(log.quantityText ?? "").trim() !== "" ? (
                          <div className="mt-1 text-xs text-slate-300">{String(log.quantityText ?? "")}</div>
                        ) : null}
                        <MacroNutrientPills notes={log.notes} compact />
                      </div>
                    )) : (
                      <div className="rounded-[16px] border border-dashed border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-slate-400">
                        {t("nutritionMyDiet.history.noFood")}
                      </div>
                    )}

                    {day.manualLogs.length > 0 ? day.manualLogs.map(([slotKey, logs]) => (
                      <div key={`${day.iso}-${slotKey}-manual`} className="rounded-[16px] border border-rose-300/15 bg-rose-300/8 px-3 py-3">
                        <div className="text-xs font-bold text-rose-100">{t("nutritionMyDiet.history.manualForSlot", { slot: mealSlotLabel(slotKey, t) })}</div>
                        <div className="mt-2 space-y-2">
                          {logs.map((log) => (
                            <div key={log.id} className="rounded-[14px] border border-white/10 bg-white/[0.04] px-3 py-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="text-sm font-black text-white">{log.foodTitle ?? "—"}</div>
                                {log.manualEntryMethod === "photo" ? (
                                  <span className="rounded-full border border-sky-300/20 bg-sky-300/10 px-2 py-0.5 text-[10px] font-black text-sky-100">
                                    {t("nutritionMyDiet.manualLog.withPhoto")}
                                  </span>
                                ) : null}
                              </div>
                              {String(log.quantityText ?? "").trim() !== "" ? (
                                <div className="mt-1 text-xs text-slate-300">{String(log.quantityText)}</div>
                              ) : null}
                              {log.photoUrl ? (
                                <button
                                  type="button"
                                  onClick={() => setMealPhotoPreview({ url: log.photoUrl ?? "", title: log.foodTitle ?? t("nutritionMyDiet.manualLog.photoAlt") })}
                                  className="mt-2 inline-flex items-center gap-2 rounded-[12px] border border-sky-300/20 bg-sky-300/8 px-2 py-2 text-start transition hover:bg-sky-300/12"
                                >
                                  <img src={log.photoUrl} alt={log.foodTitle ?? t("nutritionMyDiet.manualLog.photoAlt")} className="h-10 w-10 rounded-[10px] object-cover ring-1 ring-white/10" />
                                  <div className="text-[11px] font-bold text-sky-100">{t("nutritionMyDiet.manualLog.viewPhoto")}</div>
                                </button>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    )) : null}
                  </div>

                  <div className="mt-3 text-xs text-cyan-100/80">
                    {t("nutritionMyDiet.history.waterLogged", { count: format.number(day.water.glasses, { maximumFractionDigits: 0 }) })}
                  </div>
                </button>
              ))}
            </div>
            ) : null}
          </section>
        ) : null}

        {prescription?.prescriptionMode === "daily_prescription" && activeDailyPlan ? (
          <section className="space-y-3">
            <section className="space-y-3">
                {false ? <div className="flex items-center justify-between gap-3">
                  <div>
                  <div className="text-xl font-black">{String(days.find((day) => day.iso === activeDate)?.label ?? activeDailyPlan?.["day_label"] ?? t("nutritionMyDiet.daily.dayPlan"))}</div>
                  <div className="mt-1 text-xs leading-6 text-slate-400">{t("nutritionMyDiet.daily.dayPlanDescription")}</div>
                </div>
                <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-bold text-slate-300">
                  <CalendarRange className="h-3.5 w-3.5 text-amber-300" />
                  {days.find((day) => day.iso === activeDate)?.label ?? String(activeDailyPlan?.["day_label"] ?? t("nutritionMyDiet.daily.thisDay"))}
                </div>
              </div> : null}

              <div className="space-y-3">
                {asArray(activeDailyPlan["meals"]).map((meal, mealIndex) => {
                  const mealData = typeof meal === "object" && meal ? (meal as Record<string, unknown>) : {};
                  const replacements = Array.isArray(mealData["replacements"]) ? mealData["replacements"] : [];
                  const slotKey = normalizeMealSlotKey(mealData["slot_key"] ?? mealData["title"] ?? `meal_${mealIndex + 1}`);
                  if (hasActiveMealFilter && slotKey !== selectedMealFilterKey) {
                    return null;
                  }
                  const selectedLog = selectedMealLogMap.get(slotKey);
                  const manualLogs = selectedManualMealLogMap.get(slotKey) ?? [];
                  const isSelected = Boolean(selectedLog && !selectedLog.isManual);
                  const replacementLabel = extractReplacementLabel(selectedLog?.notes);
                  const isReplacedMeal = Boolean(selectedLog && !selectedLog.isManual && isMealReplacementLog(selectedLog, mealData));
                  const displayTitle = isReplacedMeal
                    ? String(selectedLog?.foodTitle ?? mealData["title"] ?? t("nutritionMyDiet.mealCard.defaultMeal"))
                    : String(mealData["title"] ?? t("nutritionMyDiet.mealCard.defaultMeal"));
                  const displayMealText = isReplacedMeal
                    ? String(selectedLog?.foodDescription ?? selectedLog?.foodTitle ?? "")
                    : String(mealData["meal_text"] ?? "");
                  const displayQuantityText = isReplacedMeal
                    ? formatQuantityText(selectedLog?.quantityText, { t, format })
                    : formatQuantityText(mealData["quantity_text"], { t, format });
                  const displayCalories = isReplacedMeal
                    ? loggedCalories(selectedLog)
                    : Number(mealData["calories"] ?? 0);
                  const dailyCardKey = `daily:${activeDate || "no-date"}:${slotKey}:${mealIndex}`;
                  const isExpanded = expandedChoiceKeys.includes(dailyCardKey);

                  return (
                    <NutritionDietMealShell
                      id={`meal-section-${slotKey}`}
                      key={`meal-${slotKey || mealIndex}`}
                      selected={isSelected}
                      expanded={isExpanded}
                    >
                      <button
                        type="button"
                        onClick={() => toggleChoiceCard(dailyCardKey)}
                        className="flex min-h-[70px] w-full items-center justify-between gap-2.5 px-3 py-3 text-start"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-2.5">
                          <NutritionMealNumberBadge index={mealIndex + 1} selected={isSelected} />
                          <div className="min-w-0">
                            <div className="line-clamp-2 text-[14px] font-extrabold leading-6 text-white">{displayTitle}</div>
                            <div className={cn(
                              "mt-0.5 line-clamp-1 text-[10px] font-extrabold leading-5",
                              isSelected ? "text-emerald-300" : "text-slate-500",
                            )}>
                              {isSelected
                                ? t(isReplacedMeal ? "nutritionMyDiet.daily.replacementLogged" : "nutritionMyDiet.mealCard.logged")
                                : t("nutritionMyDiet.mealCard.notSelected")}
                            </div>
                          </div>
                        </div>
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px] text-slate-400">
                          <ChevronDown className={cn("h-4 w-4 transition-transform", isExpanded ? "rotate-180" : "")} />
                        </span>
                      </button>

                      {isExpanded ? (
                        <div className="px-3.5 pb-4 pt-0">
                          <NutritionMealDetailsBlock
                            title={displayTitle}
                            description={displayMealText || (isReplacedMeal ? selectedLog?.foodDescription : mealData["description"])}
                            descriptionTone="foodTitle"
                            preparationText={buildPreparationText({
                              title: displayTitle,
                              quantityText: displayQuantityText,
                              explicitPreparation: isReplacedMeal ? selectedLog?.foodDescription : mealData["preparation_text"],
                              description: isReplacedMeal ? selectedLog?.foodDescription : mealData["description"],
                              t,
                              format,
                            })}
                            quantityText={displayQuantityText.trim() !== "" ? quantityWithGrams(displayQuantityText, isReplacedMeal ? 0 : mealData["grams"], format, t) : ""}
                            rawQuantityText={displayQuantityText}
                            source={isReplacedMeal ? null : mealData}
                            notes={selectedLog?.notes}
                            calories={displayCalories}
                          />

                          <div className="mt-4 flex gap-2">
                            <Button
                              type="button"
                              disabled={savingMealKey === slotKey}
                              aria-disabled={!canRegisterFoodForActiveDate}
                              onClick={() =>
                                isSelected && selectedLog?.id
                                  ? deleteMeal(selectedLog.id, slotKey)
                                  : saveMeal({
                                      mealSlotKey: slotKey,
                                      slotTitle: String(mealData["title"] ?? ""),
                                      foodTitle: String(mealData["title"] ?? ""),
                                      foodDescription: String(mealData["meal_text"] ?? ""),
                                      quantityText: formatQuantityText(mealData["quantity_text"], { t, format }),
                                      optionCalories: Number(mealData["calories"] ?? 0) || null,
                                      proteinGrams: macroValue(mealData, "protein_grams") || null,
                                      fatGrams: macroValue(mealData, "fat_grams") || null,
                                      carbohydrateGrams: macroValue(mealData, "carbohydrate_grams") || null,
                                      fiberGrams: macroValue(mealData, "fiber_grams") || null,
                                    })
                              }
                              className={cn(
                                "h-[52px] flex-1 rounded-[16px] !text-[14px] font-extrabold text-slate-950 hover:opacity-95",
                                isSelected
                                  ? "bg-[linear-gradient(135deg,#10b981,#34d399)]"
                                  : "bg-[linear-gradient(135deg,#f59e0b,#fbbf24)]",
                                !canRegisterFoodForActiveDate ? "cursor-not-allowed opacity-55 saturate-75 hover:opacity-70" : "",
                              )}
                            >
                              {savingMealKey === slotKey ? <Loader2 className="me-2 h-4.5 w-4.5 animate-spin" /> : <ArrowDown className="me-2 h-4.5 w-4.5" />}
                              {isSelected ? t("nutritionMyDiet.mealCard.loggedForDay") : t("nutritionMyDiet.daily.ateMeal")}
                            </Button>
                            {prescription.allowFoodReplacement && activeDate === todayIso && canRegisterFoodForActiveDate ? (
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => void openChangeFood({
                                  sourceType: "daily_meal",
                                  mealSlotKey: slotKey,
                                  slotTitle: String(mealData["title"] ?? t("nutritionMyDiet.mealCard.defaultMeal")),
                                  originalMealLabel: String(mealData["meal_text"] ?? mealData["title"] ?? t("nutritionMyDiet.daily.originalFood")),
                                  dayNumber: Number(activeDailyPlan["day_number"] ?? 0) || undefined,
                                  mealIndex,
                                })}
                                className="h-11 rounded-[16px] border-white/10 bg-white/5 text-xs font-black text-white hover:bg-white/10"
                              >
                                {t("nutritionMyDiet.mealCard.changeFood")}
                              </Button>
                            ) : null}
                          </div>

                          {replacements.length > 0 ? (
                            <div className="mt-4 rounded-[18px] border border-cyan-400/14 bg-cyan-400/[0.07] px-3 py-3">
                              <div className="px-1">
                                <div className="text-sm font-black text-cyan-50">{t("nutritionMyDiet.daily.allowedReplacement")}</div>
                                <div className="mt-1 text-[11px] leading-5 text-cyan-100/65">{t("nutritionMyDiet.daily.allowedReplacementDescription")}</div>
                              </div>
                              <div className="mt-3 space-y-2">
                                {replacements.map((replacement, replacementIndex) => {
                                  const replacementData = typeof replacement === "object" && replacement ? (replacement as Record<string, unknown>) : {};

                                  return (
                                    <div key={`replacement-${replacementIndex}`} className="rounded-[16px] border border-white/8 bg-white/[0.035] px-3 py-3 text-sm leading-7 text-slate-100">
                                      <div className="font-black text-white">{String(replacementData["title"] ?? t("nutritionMyDiet.daily.replacement"))}</div>
                                      {String(replacementData["description"] ?? "").trim() !== "" ? (
                                        <div className="mt-1 text-slate-300">{String(replacementData["description"] ?? "")}</div>
                                      ) : null}
                                      {buildPreparationText({
                                        title: replacementData["title"],
                                        quantityText: replacementData["quantity_text"],
                                        explicitPreparation: replacementData["preparation_text"],
                                        description: replacementData["description"],
                                        t,
                                        format,
                                      }) !== "" ? (
                                        <div className="mt-3 rounded-[12px] bg-cyan-400/[0.08] px-3 py-2 text-xs leading-6 text-cyan-100/80">
                                          {buildPreparationText({
                                            title: replacementData["title"],
                                            quantityText: replacementData["quantity_text"],
                                            explicitPreparation: replacementData["preparation_text"],
                                            description: replacementData["description"],
                                            t,
                                            format,
                                          })}
                                        </div>
                                      ) : null}
                                      <div className="mt-3 flex flex-wrap items-center gap-2">
                                        <div className="rounded-full border border-cyan-300/12 bg-cyan-300/[0.08] px-2.5 py-1 text-[10px] font-black text-cyan-100">
                                          {quantityWithGrams(replacementData["quantity_text"], replacementData["grams"], format, t)}
                                        </div>
                                        {Number(replacementData["calories"] ?? 0) > 0 ? (
                                          <div className="rounded-full border border-emerald-300/12 bg-emerald-300/[0.08] px-2.5 py-1 text-[10px] font-black text-emerald-100">
                                            {t("nutritionProfileHome.kcalValue", { count: format.number(Number(replacementData["calories"] ?? 0), { maximumFractionDigits: 0 }) })}
                                          </div>
                                        ) : null}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ) : null}

                          {manualLogs.length > 0 ? (
                            <div className="mt-3 space-y-2 rounded-[20px] border border-rose-300/15 bg-rose-300/8 px-3 py-3">
                              <div className="text-xs font-black text-rose-100">{t("nutritionMyDiet.manualLog.sectionTitle")}</div>
                              {manualLogs.map((log: MealLogView) => (
                                <div key={log.id} className="flex items-start justify-between gap-3 rounded-[16px] border border-white/10 bg-white/[0.04] px-3 py-3">
                                  <div className="flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <div className="text-sm font-black text-white">{log.foodTitle ?? "—"}</div>
                                      {log.manualEntryMethod === "photo" ? (
                                        <span className="rounded-full border border-sky-300/20 bg-sky-300/10 px-2 py-0.5 text-[10px] font-black text-sky-100">
                                          {t("nutritionMyDiet.manualLog.withPhoto")}
                                        </span>
                                      ) : null}
                                    </div>
                                  {String(log.quantityText ?? "").trim() !== "" ? (
                                    <div className="mt-1 text-xs text-slate-300">{String(log.quantityText)}</div>
                                  ) : null}
                                  {["queued", "processing"].includes(String(log.aiNutritionStatus ?? "")) ? (
                                    <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-[11px] font-black text-amber-100">
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      {t("nutritionMyDiet.manualLog.aiPending")}
                                    </div>
                                  ) : log.aiNutritionStatus === "generated" ? (
                                    <div className="mt-2 text-[11px] font-black text-emerald-100">
                                      {t("nutritionMyDiet.manualLog.aiGenerated", { calories: format.number(log.calories ?? extractLoggedCalories(log.notes), { maximumFractionDigits: 0 }) })}
                                    </div>
                                  ) : log.aiNutritionStatus === "failed" ? (
                                    <div className="mt-2 text-[11px] font-black text-rose-100">
                                      {t("nutritionMyDiet.manualLog.aiFailed")}
                                    </div>
                                  ) : null}
                                  {formatManualMetaText(log.foodDescription, t) !== "" ? (
                                      <div className="mt-2 text-xs leading-6 text-slate-300">{formatManualMetaText(log.foodDescription, t)}</div>
                                    ) : null}
                                    {formatManualMetaText(log.notes, t) !== "" ? (
                                      <div className="mt-2 text-[11px] leading-6 text-rose-100/80">{formatManualMetaText(log.notes, t)}</div>
                                    ) : null}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => void deleteOtherMeal(log.id)}
                                    disabled={deletingOtherMealId === log.id}
                                    aria-label={["queued", "processing"].includes(String(log.aiNutritionStatus ?? "")) ? t("nutritionMyDiet.manualLog.cancelAndDeleteAria") : t("nutritionMyDiet.manualLog.deleteAria")}
                                    className={cn(
                                      "flex h-8 shrink-0 items-center justify-center rounded-full border border-rose-300/20 bg-rose-300/10 text-rose-100 transition hover:bg-rose-300/15 disabled:opacity-60",
                                      ["queued", "processing"].includes(String(log.aiNutritionStatus ?? "")) ? "w-auto px-3 text-[10px] font-black" : "w-8",
                                    )}
                                  >
                                    {deletingOtherMealId === log.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : ["queued", "processing"].includes(String(log.aiNutritionStatus ?? "")) ? t("common.cancel") : <X className="h-3.5 w-3.5" />}
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : null}

                          {outOfPlanMealLoggingEnabled && activeDate === todayIso && canRegisterFoodForActiveDate ? (
                            <NutritionOtherMealButton
                              manualCount={manualLogs.length}
                              photoEnabled={mealPhotoAnalysisEnabled}
                              hasScheduledMeal={isSelected}
                              onClick={() => openOtherMealModal(slotKey, String(mealData["title"] ?? ""))}
                            />
                          ) : null}
                        </div>
                      ) : null}
                    </NutritionDietMealShell>
                  );
                })}
              </div>
            </section>
          </section>
        ) : null}

        {prescription.prescriptionMode === "fixed_text" ? (
          <section className="space-y-4">
            {textSections.map((section, index) => {
              const sectionData = typeof section === "object" && section ? (section as Record<string, unknown>) : {};

              return (
                <section key={`section-${index}`} className="rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(18,20,27,0.98),rgba(8,9,12,0.99))] p-4 shadow-[0_24px_65px_-48px_rgba(0,0,0,0.98)]">
                  <div className="inline-flex rounded-full border border-emerald-300/18 bg-emerald-300/10 px-3 py-1 text-[10px] font-black text-emerald-100">
                    {t("nutritionMyDiet.fixed.page", { page: format.number(Number(sectionData["page_number"] ?? 0) || index + 1, { maximumFractionDigits: 0 }) })}
                  </div>
                  <div className="mt-3 text-lg font-black text-white">{String(sectionData["title"] ?? t("nutritionMyDiet.fixed.recommendation"))}</div>
                  <div className="mt-3 rounded-[18px] border border-white/10 bg-white/[0.035] px-4 py-4 text-sm leading-8 text-slate-200 whitespace-pre-wrap">{String(sectionData["body"] ?? "")}</div>
                </section>
              );
            })}
          </section>
        ) : null}

        {hasDailyAdviceSections ? (
          <section className="border-t border-white/10 pt-5">
            <div className="text-[17px] font-extrabold leading-7 text-white">{t("nutritionMyDiet.advice.title")}</div>
            <div className="mt-1 text-[10px] font-extrabold leading-5 text-slate-500">
              {t("nutritionMyDiet.advice.description")}
            </div>
          </section>
        ) : null}

        {!hasActiveMealFilter && !isFixedTextPrescription && (Number(waterPlan["daily_target_glasses"] ?? 0) > 0 || Number(waterPlan["daily_target_ml"] ?? 0) > 0 || String(waterPlan["summary_text"] ?? "").trim() !== "") ? (
          <section className="overflow-hidden rounded-[21px] border border-white/10 bg-[linear-gradient(180deg,rgba(17,19,24,0.98),rgba(10,12,17,0.99))] shadow-[0_24px_65px_-48px_rgba(0,0,0,0.98)]">
            <button
              type="button"
              onClick={() => togglePanel("daily-advice:water")}
              className="flex min-h-[64px] w-full items-center justify-between gap-2.5 px-3 py-3 text-start"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[13px] bg-cyan-300/12 text-cyan-300">
                  <Droplets className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <div className="text-[15px] font-extrabold leading-6 text-white">
                    {Number(waterPlan["daily_target_glasses"] ?? 0) > 0
                      ? t("nutritionMyDiet.water.glassesTitle", { count: format.number(Number(waterPlan["daily_target_glasses"] ?? 0), { maximumFractionDigits: 0 }) })
                      : t("nutritionMyDiet.water.prescribed")}
                  </div>
                  <div className="mt-0.5 line-clamp-1 text-[9px] font-extrabold leading-4 text-slate-500">
                    <span>{t("nutritionMyDiet.water.today")}</span>{" "}
                    <span className="text-cyan-300">{t("nutritionMyDiet.water.progress", { current: format.number(selectedWater.glasses, { maximumFractionDigits: 0 }), total: format.number(Number(waterPlan["daily_target_glasses"] ?? 0), { maximumFractionDigits: 0 }) })}</span>
                    {Number(waterPlan["daily_target_ml"] ?? 0) > 0 ? <> · {t("nutritionMyDiet.water.targetMl", { amount: format.number(Number(waterPlan["daily_target_ml"] ?? 0), { maximumFractionDigits: 0 }) })}</> : null}
                  </div>
                </div>
              </div>
              <ChevronDown className={cn("h-5 w-5 shrink-0 text-slate-400 transition-transform", expandedPanelKeys.includes("daily-advice:water") ? "rotate-180" : "")} />
            </button>

            {expandedPanelKeys.includes("daily-advice:water") ? (
              <div className="px-4 pb-4">
                <div className="text-[12px] font-semibold leading-7 text-slate-400">
                  {String(waterPlan["summary_text"] ?? "") || t("nutritionMyDiet.water.defaultSummary")}
                </div>
                {activeDate ? (
                  <div className="mt-2 text-[12px] font-semibold leading-6 text-slate-400">
                    {t("nutritionMyDiet.water.loggedForDay", {
                      date: format.date(activeDate),
                      current: format.number(selectedWater.glasses, { maximumFractionDigits: 0 }),
                      total: format.number(Number(waterPlan["daily_target_glasses"] ?? 0), { maximumFractionDigits: 0 }),
                    })}
                  </div>
                ) : null}

                {Number(waterPlan["daily_target_glasses"] ?? 0) > 0 ? (
                  <div className="mt-4 grid grid-cols-5 gap-2">
                    {Array.from({ length: Number(waterPlan["daily_target_glasses"] ?? 0) }, (_, index) => {
                      const glasses = index + 1;
                      const active = glasses <= selectedWater.glasses;

                      return (
                        <button
                          key={`glass-${glasses}`}
                          type="button"
                          disabled={savingWater}
                          aria-disabled={!canRegisterWaterForActiveDate}
                          onClick={() => saveWater(glasses)}
                          className={cn(
                            "flex min-h-[48px] items-center justify-center gap-1 rounded-[13px] border text-[12px] font-extrabold transition",
                            active ? "border-cyan-300/35 bg-cyan-300/15 text-cyan-100" : "border-white/10 bg-white/[0.035] text-slate-500",
                            !canRegisterWaterForActiveDate ? "cursor-not-allowed opacity-55 saturate-75 hover:bg-white/[0.035]" : "",
                          )}
                        >
                          <Droplets className={cn("h-4.5 w-4.5", active ? "text-cyan-200" : "text-slate-600")} />
                          {format.number(glasses, { maximumFractionDigits: 0 })}
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                {Number(waterPlan["daily_target_glasses"] ?? 0) > 0 ? (
                  <div className="mt-4 grid grid-cols-[1fr_2fr] gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={savingWater}
                      aria-disabled={!canRegisterWaterForActiveDate}
                      className={cn(
                        "h-[50px] rounded-[15px] border-white/10 bg-white/[0.035] text-[13px] font-extrabold text-slate-200 hover:bg-white/10",
                        !canRegisterWaterForActiveDate ? "cursor-not-allowed opacity-55 saturate-75 hover:bg-white/[0.035]" : "",
                      )}
                      onClick={() => saveWater(0)}
                    >
                      {t("nutritionMyDiet.water.clear")}
                    </Button>
                    <Button
                      type="button"
                      disabled={savingWater}
                      aria-disabled={!canRegisterWaterForActiveDate}
                      className={cn(
                        "h-[50px] rounded-[15px] bg-cyan-300 text-[14px] font-extrabold text-slate-950 shadow-[0_18px_42px_-28px_rgba(103,232,249,0.9)] hover:bg-cyan-200",
                        !canRegisterWaterForActiveDate ? "cursor-not-allowed opacity-55 saturate-75 hover:bg-cyan-300" : "",
                      )}
                      onClick={() => saveWater(Math.min(selectedWater.glasses + 1, Number(waterPlan["daily_target_glasses"] ?? 0)))}
                    >
                      <PlusCircle className="me-2 h-4.5 w-4.5" />
                      {t("nutritionMyDiet.water.addGlass")}
                    </Button>
                  </div>
                ) : null}

                {asArray(waterPlan["timing_tips"]).length > 0 ? (
                  <div className="mt-4 space-y-2.5">
                    {asArray(waterPlan["timing_tips"]).map((tip, index) => (
                      <div key={`water-tip-${index}`} className="flex gap-2.5 text-[12px] font-semibold leading-7 text-slate-300">
                        <span className="mt-2.5 h-2 w-2 shrink-0 rounded-full bg-cyan-300" />
                        <span>{String(tip)}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}

        {!hasActiveMealFilter && hasSupplementSection ? (
          <section className="overflow-hidden rounded-[21px] border border-white/10 bg-[linear-gradient(180deg,rgba(17,19,24,0.98),rgba(10,12,17,0.99))] shadow-[0_24px_65px_-48px_rgba(0,0,0,0.98)]">
            <button
              type="button"
              onClick={() => togglePanel("daily-advice:supplements")}
              className="flex min-h-[66px] w-full items-center justify-between gap-2.5 px-3 py-3 text-start"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[13px] bg-emerald-300/10 text-emerald-300">
                  <Paperclip className="h-[18px] w-[18px]" />
                </span>
                <div className="min-w-0">
                  <div className="text-[15px] font-extrabold leading-6 text-white">{t("nutritionMyDiet.supplement.title")}</div>
                  <div className="mt-0.5 line-clamp-1 text-[10px] font-extrabold leading-5 text-emerald-300">
                    {t("nutritionMyDiet.supplement.status", { count: format.number(supplementItems.length || 1, { maximumFractionDigits: 0 }) })}
                  </div>
                </div>
              </div>
              <ChevronDown className={cn("h-5 w-5 shrink-0 text-slate-400 transition-transform", expandedPanelKeys.includes("daily-advice:supplements") ? "rotate-180" : "")} />
            </button>

            {expandedPanelKeys.includes("daily-advice:supplements") ? (
              <div className="px-4 pb-5">
                <div className="text-[13px] font-semibold leading-8 text-slate-400">
                  {String(supplementPlan["summary_text"] ?? t("nutritionMyDiet.supplement.defaultSummary"))}
                </div>

                {supplementItems.length > 0 ? (
                  <div className="mt-4 space-y-4">
                    {supplementItems.map((item, index) => (
                      <div
                        key={`supplement-card-${index}`}
                        className="overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.035]"
                      >
                        <div className="border-b border-amber-300/16 bg-amber-300/[0.06] px-4 py-4 text-[13px] font-semibold leading-7 text-amber-100/85">
                          <div className="mb-2 text-[12px] font-extrabold text-amber-300">{t("nutritionMyDiet.supplement.item", { index: format.number(index + 1, { maximumFractionDigits: 0 }) })}</div>
                          {item.timing}
                        </div>
                        <div className="px-4 py-5">
                          <div className="text-[22px] font-extrabold leading-8 text-white">{item.title}</div>
                          <div className="mt-4 rounded-[18px] border border-white/10 bg-white/[0.035] px-4 py-4">
                            <div className="text-[12px] font-extrabold text-slate-500">{t("nutritionMyDiet.supplement.usage")}</div>
                            <div className="mt-2 text-[14px] font-semibold leading-8 text-slate-200">{item.usage}</div>
                          </div>
                          {item.notes !== "" ? (
                            <div className="mt-3 rounded-[18px] border border-white/10 bg-white/[0.035] px-4 py-4">
                              <div className="text-[12px] font-extrabold text-slate-500">{t("nutritionMyDiet.supplement.notes")}</div>
                              <div className="mt-2 text-[14px] font-semibold leading-8 text-slate-300">{item.notes}</div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}

        {!hasActiveMealFilter && !isFixedTextPrescription && guidanceSections.length > 0 ? (
          <section className="space-y-2.5 pt-3">
            <div className="pb-1.5">
              <div className="text-[17px] font-extrabold leading-7 text-white">{t("nutritionMyDiet.guidance.title")}</div>
              <div className="mt-0.5 text-[10px] font-extrabold leading-5 text-slate-500">
                {t("nutritionMyDiet.guidance.countDescription", { count: format.number(guidanceSections.length, { maximumFractionDigits: 0 }) })}
              </div>
            </div>
            {guidanceSections.map((section, index) => {
              const sectionData = asRecord(section);
              const guidancePanelKey = `daily-advice:guidance:${index}`;
              const guidanceOpen = expandedPanelKeys.includes(guidancePanelKey);

              return (
                <div key={`guidance-${index}`} className="overflow-hidden rounded-[18px] border border-white/10 bg-[linear-gradient(180deg,rgba(17,19,24,0.98),rgba(10,12,17,0.99))] shadow-[0_18px_55px_-44px_rgba(0,0,0,0.95)]">
                  <button
                    type="button"
                    onClick={() => togglePanel(guidancePanelKey)}
                    className="flex min-h-[56px] w-full items-center justify-between gap-2.5 px-3 py-2.5 text-start"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-emerald-300/10 text-emerald-300">
                        <BadgeCheck className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <div className="line-clamp-1 text-[13px] font-extrabold leading-5 text-white">{String(sectionData["title"] ?? t("nutritionMyDiet.guidance.defaultTitle"))}</div>
                      </div>
                    </div>
                    <ChevronDown className={cn("h-4 w-4 shrink-0 text-slate-400 transition-transform", guidanceOpen ? "rotate-180" : "")} />
                  </button>
                  {guidanceOpen ? (
                    <div className="border-t border-white/8 px-4 pb-4 pt-3 text-[14px] font-semibold leading-8 text-slate-300 whitespace-pre-wrap">
                      {String(sectionData["body"] ?? "")}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </section>
        ) : null}

        {!hasActiveMealFilter && audioGuidance.length > 0 ? (
          <section className="rounded-[18px] border border-amber-300/18 bg-[linear-gradient(180deg,rgba(34,26,10,0.80),rgba(12,12,14,0.98))] p-3 shadow-[0_20px_60px_-46px_rgba(251,191,36,0.55)]">
            <div className="flex items-center justify-between gap-3 text-[13px] font-black text-white">
              <span>{t("nutritionMyDiet.audio.title")}</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-[11px] border border-amber-300/18 bg-amber-300/10 text-amber-300">
                <Volume2 className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-4 space-y-3">
              {audioGuidance.map((track, index) => {
                const trackData = typeof track === "object" && track ? (track as Record<string, unknown>) : {};

                return (
                  <div key={`track-${index}`} className="rounded-[18px] border border-amber-300/14 bg-black/20 px-4 py-4">
                    <div className="font-black text-white">{String(trackData["title"] ?? t("nutritionMyDiet.audio.defaultTitle"))}</div>
                    {String(trackData["description"] ?? "").trim() !== "" ? (
                      <div className="mt-2 text-xs leading-6 text-amber-50/75">{String(trackData["description"] ?? "")}</div>
                    ) : null}
                    {String(trackData["fileUrl"] ?? "").trim() !== "" ? (
                      <audio controls preload="none" src={String(trackData["fileUrl"])} className="mt-4 w-full accent-amber-400" />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {false && !hasActiveMealFilter && !isFixedTextPrescription && guidanceSections.length > 0 ? (
          <section className="space-y-4">
            {guidanceSections.map((section, index) => {
              const sectionData = asRecord(section);

              return (
                <div key={`guidance-hidden-${index}`} className={`rounded-[28px] border p-4 ${guidanceAccent(String(sectionData["accent"] ?? "amber"))}`}>
                  <div className="flex items-center gap-2 text-sm font-black">
                    <BadgeCheck className="h-5 w-5" />
                    {String(sectionData["title"] ?? t("nutritionMyDiet.guidance.defaultTitle"))}
                  </div>
                  <div className="mt-3 text-sm leading-8 text-white whitespace-pre-wrap">{String(sectionData["body"] ?? "")}</div>
                </div>
              );
            })}
          </section>
        ) : null}

        {false && !hasActiveMealFilter && audioGuidance.length > 0 ? (
          <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(160deg,rgba(18,34,49,0.95),rgba(11,22,35,0.9))] p-4 shadow-[0_30px_80px_-45px_rgba(0,0,0,0.9)]">
            <div className="flex items-center gap-2 text-base font-black text-white">
              <Volume2 className="h-5 w-5 text-amber-300" />
              {t("nutritionMyDiet.audio.title")}
            </div>
            <div className="mt-4 space-y-3">
              {audioGuidance.map((track, index) => {
                const trackData = typeof track === "object" && track ? (track as Record<string, unknown>) : {};

                return (
                  <div key={`track-${index}`} className="rounded-[22px] border border-white/10 bg-white/[0.04] px-4 py-4">
                    <div className="font-black text-white">{String(trackData["title"] ?? t("nutritionMyDiet.audio.defaultTitle"))}</div>
                    {String(trackData["description"] ?? "").trim() !== "" ? (
                      <div className="mt-2 text-sm leading-7 text-slate-300">{String(trackData["description"] ?? "")}</div>
                    ) : null}
                    {String(trackData["fileUrl"] ?? "").trim() !== "" ? (
                      <audio controls preload="none" src={String(trackData["fileUrl"])} className="mt-4 w-full" />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        <Button variant="outline" className="h-11 w-full rounded-[15px] border-white/10 bg-white/5 text-[12px] font-black text-white hover:bg-white/10" onClick={() => setLocation("/nutrition/profile")}>
          {t("nutritionMyDiet.empty.backToProfile")}
          {isRtl ? <ArrowLeft className="ms-2 h-4 w-4" /> : <ArrowRight className="ms-2 h-4 w-4" />}
        </Button>
      </div>

      {false && filteredMealNavigationItems.length > 0 && !hasActiveMealFilter ? (
        <>
          <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 bg-[linear-gradient(180deg,rgba(5,6,7,0),rgba(5,6,7,0.72)_24%,rgba(5,6,7,0.96)_52%,rgba(5,6,7,1))] pt-16">
            <div className="pointer-events-auto mx-auto max-w-md px-3 pb-3">
              <button
                type="button"
                onClick={() => setMealNavigatorOpen(true)}
                className="group w-full rounded-[24px] border border-amber-300/18 bg-[linear-gradient(135deg,rgba(251,191,36,0.18),rgba(255,255,255,0.04)_42%,rgba(15,16,19,0.98))] px-4 pb-[calc(env(safe-area-inset-bottom)+14px)] pt-4 text-start shadow-[0_28px_60px_-24px_rgba(0,0,0,0.92)] backdrop-blur-2xl transition active:scale-[0.985] hover:border-amber-300/30"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[17px] bg-amber-400 text-slate-950 shadow-[0_18px_40px_-28px_rgba(251,191,36,0.85)]">
                      <CalendarRange className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 text-start">
                      <div className="flex items-center justify-start gap-2">
                        <div className="text-[15px] font-black text-white">
                          {t("nutritionMyDiet.navigator.title")}
                        </div>
                        <span className="rounded-full border border-amber-300/14 bg-amber-300/10 px-2 py-0.5 text-[10px] font-black text-amber-100">
                          {t("nutritionMyDiet.navigator.mealCount", { count: format.number(filteredMealNavigationItems.length, { maximumFractionDigits: 0 }) })}
                        </span>
                      </div>
                      <div className="mt-1 text-[11px] font-bold text-slate-300/80">
                        {t("nutritionMyDiet.navigator.description")}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <div className="flex h-10 min-w-10 items-center justify-center rounded-full border border-white/10 bg-black/25 px-2 text-amber-100 transition group-hover:translate-y-[1px]">
                      <ChevronDown className="h-4 w-4" />
                    </div>
                  </div>
                </div>
              </button>
            </div>
          </div>

          <Sheet open={mealNavigatorOpen} onOpenChange={setMealNavigatorOpen}>
            <SheetContent
              side="bottom"
              closeClassName="start-4 end-auto top-5 rounded-full border border-white/10 bg-white/5 p-2 opacity-100 ring-0 hover:bg-white/10"
              className="mx-auto w-full max-w-md rounded-t-[34px] border-white/10 bg-[linear-gradient(180deg,rgba(18,20,27,0.98),rgba(5,6,7,1))] px-4 pb-7 pt-4 text-white shadow-[0_-30px_90px_-40px_rgba(0,0,0,0.98)]"
              dir={dir}
            >
              <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-white/15" />
              <SheetHeader className="items-end space-y-2 px-4 pe-10 text-start sm:text-start">
                <SheetTitle className="w-full text-start text-xl font-black text-white">{t("nutritionMyDiet.navigator.sheetTitle")}</SheetTitle>
                <SheetDescription className="w-full text-start leading-7 text-slate-400">
                  {t("nutritionMyDiet.navigator.sheetDescription")}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-5 grid grid-cols-2 gap-3">
                {filteredMealNavigationItems.map((item, index) => {
                  const done = item.state === "done";

                  return (
                    <button
                      key={`meal-nav-sheet-${item.key}`}
                      type="button"
                      onClick={() => selectMealFromNavigator(item.key)}
                      className={cn(
                        "relative overflow-hidden rounded-[24px] border px-4 py-4 text-start transition active:scale-[0.98]",
                        done
                          ? "border-emerald-300/22 bg-[linear-gradient(180deg,rgba(16,185,129,0.18),rgba(6,78,59,0.12))] shadow-[0_22px_55px_-38px_rgba(16,185,129,0.9)]"
                          : "border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] hover:border-amber-300/18 hover:bg-[linear-gradient(180deg,rgba(245,158,11,0.14),rgba(255,255,255,0.04))]",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[11px] font-bold text-slate-400">{t("nutritionProfileHome.meal.numbered", { count: format.number(index + 1, { maximumFractionDigits: 0 }) })}</div>
                          <div className="mt-2 truncate text-base font-black text-white">{item.title}</div>
                        </div>
                        <div
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-[16px] border",
                            done
                              ? "border-emerald-300/18 bg-emerald-300/12 text-emerald-100"
                              : "border-white/10 bg-white/[0.05] text-amber-200",
                          )}
                        >
                          {done ? <BadgeCheck className="h-4 w-4" /> : <ChevronDown className={cn("h-4 w-4", isRtl ? "-rotate-90" : "rotate-90")} />}
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-[11px]">
                        <span className={cn("font-bold", done ? "text-emerald-100/90" : "text-slate-400")}>
                          {done ? t("nutritionMyDiet.navigator.done") : t("nutritionMyDiet.navigator.goToMeal")}
                        </span>
                        <span className="text-slate-500">{t("nutritionMyDiet.navigator.quickJump")}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </SheetContent>
          </Sheet>
        </>
      ) : null}

      <Dialog
        open={overLimitPromptOpen}
        onOpenChange={(open) => {
          setOverLimitPromptOpen(open);
          if (!open && activeDate) {
            setDismissedOverLimitDate(activeDate);
          }
        }}
      >
        <DialogContent dir={dir} className="border-rose-300/20 bg-[#101b2b] text-white sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-start">
              <Flame className="h-5 w-5 text-rose-300" />
              {t("nutritionMyDiet.overLimit.title")}
            </DialogTitle>
            <DialogDescription className="text-start leading-7 text-slate-300">
              {compensatedCalories > 0
                ? t("nutritionMyDiet.overLimit.descriptionCompensated", {
                    over: format.number(overTargetCalories, { maximumFractionDigits: 0 }),
                    compensated: format.number(compensatedCalories, { maximumFractionDigits: 0 }),
                    remaining: format.number(remainingOverTargetCalories, { maximumFractionDigits: 0 }),
                  })
                : t("nutritionMyDiet.overLimit.description", { over: format.number(overTargetCalories, { maximumFractionDigits: 0 }) })}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-[18px] border border-rose-300/20 bg-rose-400/10 px-4 py-4 text-sm leading-7 text-rose-100">
            {compensatedCalories > 0
              ? t("nutritionMyDiet.overLimit.hintCompensated")
              : t("nutritionMyDiet.overLimit.hint")}
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              variant="outline"
              className="rounded-2xl border-white/10 bg-white/5 text-white"
              onClick={() => {
                setDismissedOverLimitDate(activeDate);
                setOverLimitPromptOpen(false);
              }}
            >
              {t("nutritionMyDiet.overLimit.later")}
            </Button>
            <Button
              className="rounded-2xl bg-emerald-400 text-slate-950 hover:bg-emerald-300"
              onClick={() => {
                setDismissedOverLimitDate(activeDate);
                setOverLimitPromptOpen(false);
                openExercisePage();
              }}
            >
              {t("nutritionMyDiet.overLimit.exercise")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={otherMealOpen}
        onOpenChange={(open) => {
          if (open) {
            setOtherMealOpen(true);
            return;
          }

          closeOtherMealModal();
        }}
      >
        <DialogContent
          dir={dir}
          className="max-h-[92vh] w-[calc(100vw-24px)] max-w-[370px] overflow-hidden rounded-[18px] border border-slate-700/80 bg-[#121c2b] p-0 text-white shadow-[0_34px_100px_-50px_rgba(0,0,0,0.98)] sm:max-w-[370px] [&>button]:end-5 [&>button]:top-6 [&>button]:flex [&>button]:h-9 [&>button]:w-9 [&>button]:items-center [&>button]:justify-center [&>button]:rounded-[12px] [&>button]:border [&>button]:border-white/10 [&>button]:bg-white/[0.045] [&>button]:text-slate-300 [&>button]:opacity-100 [&>button_svg]:h-4.5 [&>button_svg]:w-4.5"
        >
          <div className="flex max-h-[92vh] flex-col">
          <DialogHeader className="relative shrink-0 border-b border-white/10 px-5 pb-5 pt-7">
            {otherMealMode === "photo" ? (
              <button
                type="button"
                onClick={() => setOtherMealMode("choice")}
                className="absolute start-5 top-6 flex h-9 w-9 items-center justify-center rounded-[12px] border border-white/10 bg-white/[0.045] text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
                aria-label={t("nutritionMyDiet.otherMeal.backToChoice")}
              >
                {isRtl ? <ArrowLeft className="h-4.5 w-4.5 rotate-180" /> : <ArrowLeft className="h-4.5 w-4.5" />}
              </button>
            ) : null}
            <DialogTitle className={cn(
              "flex w-full flex-col items-start gap-2 text-start",
              otherMealMode === "photo" ? "ps-12 pe-12" : "pe-12",
            )}>
              <span className="text-[20px] font-extrabold leading-7 text-white">
                {otherMealMode === "photo" ? t("nutritionMyDiet.otherMeal.photoTitle") : t("nutritionMyDiet.manualLog.addOne")}
              </span>
              {otherMealDraft.slotTitle ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-300/12 px-2.5 py-1 text-[11px] font-extrabold text-amber-300">
                  <Clock3 className="h-3 w-3" />
                  {otherMealDraft.slotTitle}
                </span>
              ) : null}
            </DialogTitle>
          </DialogHeader>

          <div className="pretty-scrollbar flex-1 overflow-y-auto overscroll-contain px-5 py-4 [-webkit-overflow-scrolling:touch]">
          <div className="space-y-4">
            {mealPhotoAnalysisEnabled ? (
              <>
                <input
                  ref={otherMealPhotoInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(event) => {
                    handleOtherMealPhotoFile(event.target.files?.[0] ?? null);
                    event.currentTarget.value = "";
                  }}
                />
                <input
                  ref={otherMealGalleryInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    handleOtherMealPhotoFile(event.target.files?.[0] ?? null);
                    event.currentTarget.value = "";
                  }}
                />
              </>
            ) : null}

            {otherMealMode === "choice" && mealPhotoAnalysisEnabled ? (
              <div className="space-y-4">
                <div className="text-center text-[13px] font-semibold leading-7 text-slate-400">
                  {t("nutritionMyDiet.otherMeal.choiceDescription")}
                  <br />
                  {t("nutritionMyDiet.otherMeal.choiceQuestion")}
                </div>
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={openOtherMealPhotoCapture}
                    className="group relative w-full rounded-[18px] border border-amber-300/45 bg-[linear-gradient(135deg,rgba(245,158,11,0.16),rgba(16,24,36,0.96))] px-3.5 py-4 text-start shadow-[0_18px_44px_-40px_rgba(245,158,11,0.8)] transition hover:border-amber-200/55"
                  >
                    <div className="absolute -top-3 start-4 rounded-full bg-amber-400 px-3 py-1 text-[10px] font-extrabold text-slate-950">
                      {t("nutritionMyDiet.otherMeal.recommended")}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[15px] bg-amber-300/18 text-amber-300">
                        <Camera className="h-6 w-6" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[16px] font-extrabold leading-6 text-white">{t("nutritionMyDiet.otherMeal.photoTitle")}</div>
                        <p className="mt-1 text-[11px] font-semibold leading-6 text-slate-400">
                          {t("nutritionMyDiet.otherMeal.photoDescription")}
                        </p>
                      </div>
                      <ForwardArrow className="h-4.5 w-4.5 shrink-0 text-amber-300 transition group-hover:-translate-x-0.5" />
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setOtherMealMode("manual")}
                    className="group w-full rounded-[18px] border border-white/10 bg-[#151f2e] px-3.5 py-4 text-start transition hover:border-white/20"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[15px] bg-sky-300/12 text-sky-300">
                        <PencilLine className="h-6 w-6" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[16px] font-extrabold leading-6 text-white">{t("nutritionMyDiet.otherMeal.manualTitle")}</div>
                        <p className="mt-1 text-[11px] font-semibold leading-6 text-slate-400">
                          {t("nutritionMyDiet.otherMeal.manualDescription")}
                        </p>
                      </div>
                      <ForwardArrow className="h-4.5 w-4.5 shrink-0 text-slate-500 transition group-hover:-translate-x-0.5" />
                    </div>
                  </button>
                </div>
              </div>
            ) : null}

            {otherMealMode === "manual" ? (
              <div className="space-y-3">
                {mealPhotoAnalysisEnabled ? (
                  <button
                    type="button"
                    onClick={() => setOtherMealMode("choice")}
                    className="inline-flex items-center gap-2 text-xs font-bold text-slate-300 hover:text-white"
                  >
                    {isRtl ? <ArrowLeft className="h-3.5 w-3.5" /> : <ArrowRight className="h-3.5 w-3.5" />}
                    {t("nutritionMyDiet.otherMeal.backToChoice")}
                  </button>
                ) : null}

                <Input
                  value={otherMealDraft.foodTitle}
                  onChange={(event) => setOtherMealDraft((current) => ({ ...current, foodTitle: event.target.value }))}
                  placeholder={t("nutritionMyDiet.otherMeal.foodPlaceholder")}
                  className="border-white/10 bg-white/[0.04] text-white"
                />
                <Input
                  value={otherMealDraft.quantityText}
                  onChange={(event) => setOtherMealDraft((current) => ({ ...current, quantityText: event.target.value }))}
                  placeholder={t("nutritionMyDiet.otherMeal.quantityPlaceholder")}
                  className="border-white/10 bg-white/[0.04] text-white"
                />
                <Textarea
                  value={otherMealDraft.foodDescription}
                  onChange={(event) => setOtherMealDraft((current) => ({ ...current, foodDescription: event.target.value }))}
                  placeholder={t("nutritionMyDiet.otherMeal.descriptionPlaceholder")}
                  className="min-h-24 border-white/10 bg-white/[0.04] text-white"
                />
                <Textarea
                  value={otherMealDraft.notes}
                  onChange={(event) => setOtherMealDraft((current) => ({ ...current, notes: event.target.value }))}
                  placeholder={t("nutritionMyDiet.otherMeal.notesPlaceholder")}
                  className="min-h-20 border-white/10 bg-white/[0.04] text-white"
                />
              </div>
            ) : null}

            {otherMealMode === "photo" && mealPhotoAnalysisEnabled ? (
              <div className="space-y-3">
                <div className="rounded-[20px] border border-dashed border-amber-300/45 bg-white/[0.025] px-4 py-5 text-center">
                  {otherMealPhotoPreviewUrl ? (
                    <div className="relative overflow-hidden rounded-[16px] border border-white/10 bg-slate-950/30">
                      <img src={otherMealPhotoPreviewUrl} alt={t("nutritionMyDiet.otherMeal.previewAlt")} className="h-44 w-full object-cover" />
                      {otherMealPhotoAnalyzing ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/72 text-center backdrop-blur-sm">
                          <Loader2 className="h-7 w-7 animate-spin text-amber-300" />
                          <div className="mt-2 text-[12px] font-extrabold text-white">{t("nutritionMyDiet.otherMeal.analyzing")}</div>
                          <div className="mt-1 text-[10px] leading-5 text-slate-300">{t("nutritionMyDiet.otherMeal.analyzingHint")}</div>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => otherMealPhotoInputRef.current?.click()}
                      disabled={otherMealPhotoAnalyzing}
                      className="mx-auto flex w-full flex-col items-center justify-center py-5 text-center"
                    >
                      <span className="flex h-[62px] w-[62px] items-center justify-center rounded-[18px] bg-amber-300/18 text-amber-300">
                        <Camera className="h-7 w-7" />
                      </span>
                      <span className="mt-4 text-[17px] font-extrabold leading-7 text-white">{t("nutritionMyDiet.otherMeal.choosePhoto")}</span>
                      <span className="mt-2 text-[11px] font-semibold leading-6 text-slate-400">
                        {t("nutritionMyDiet.otherMeal.choosePhotoHint")}
                      </span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => otherMealPhotoInputRef.current?.click()}
                    disabled={otherMealPhotoAnalyzing}
                    className="flex h-12 items-center justify-center gap-2 rounded-[15px] border border-white/10 bg-white/[0.035] text-[13px] font-extrabold text-slate-200 transition hover:bg-white/[0.07] disabled:opacity-60"
                  >
                    <Camera className="h-4.5 w-4.5" />
                    {t("nutritionMyDiet.otherMeal.camera")}
                  </button>
                  <button
                    type="button"
                    onClick={() => otherMealGalleryInputRef.current?.click()}
                    disabled={otherMealPhotoAnalyzing}
                    className="flex h-12 items-center justify-center gap-2 rounded-[15px] border border-white/10 bg-white/[0.035] text-[13px] font-extrabold text-slate-200 transition hover:bg-white/[0.07] disabled:opacity-60"
                  >
                    <ImagePlus className="h-4.5 w-4.5" />
                    {t("nutritionMyDiet.otherMeal.gallery")}
                  </button>
                </div>

                <div className="space-y-2">
                  <div className="text-[11px] font-extrabold text-slate-300">{t("nutritionMyDiet.otherMeal.photoFoodTitleLabel")}</div>
                  <Input
                    required
                    value={otherMealDraft.foodTitle}
                    onChange={(event) => {
                      setOtherMealDraft((current) => ({ ...current, foodTitle: event.target.value }));
                      setOtherMealPhotoAnalysis(null);
                    }}
                    placeholder={t("nutritionMyDiet.otherMeal.photoFoodTitlePlaceholder")}
                    className="h-11 rounded-[14px] border-white/10 bg-white/[0.035] text-[12px] font-semibold text-white placeholder:text-slate-500"
                  />
                </div>

                <Textarea
                  value={otherMealDraft.notes}
                  onChange={(event) => {
                    setOtherMealDraft((current) => ({ ...current, notes: event.target.value }));
                    setOtherMealPhotoAnalysis(null);
                  }}
                  placeholder={t("nutritionMyDiet.otherMeal.aiNotePlaceholder")}
                  className="min-h-16 rounded-[14px] border-white/10 bg-white/[0.035] text-[12px] leading-6 text-white placeholder:text-slate-500"
                />

                <Button
                  type="button"
                  disabled={!otherMealPhotoFile || otherMealPhotoAnalyzing}
                  className="h-11 w-full rounded-[15px] bg-amber-400 text-[13px] font-extrabold text-slate-950 hover:bg-amber-300"
                  onClick={() => void analyzeOtherMealPhoto()}
                >
                  {otherMealPhotoAnalyzing ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Sparkles className="me-2 h-4 w-4" />}
                  {otherMealPhotoAnalyzing ? t("nutritionMyDiet.otherMeal.analyzingPhoto") : otherMealPhotoAnalysis ? t("nutritionMyDiet.otherMeal.reanalyzePhoto") : t("nutritionMyDiet.otherMeal.analyzePhoto")}
                </Button>

                {otherMealPhotoAnalysis ? (
                  <div ref={otherMealPhotoAnalysisRef} className="overflow-hidden rounded-[22px] border border-emerald-400/28 bg-emerald-400/[0.08]">
                    <div className="flex items-center justify-between gap-3 border-b border-emerald-300/18 px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="flex h-9 w-9 items-center justify-center rounded-[13px] bg-emerald-400/18 text-emerald-300">
                          <CheckCircle2 className="h-5 w-5" />
                        </span>
                        <div className="text-[15px] font-extrabold text-emerald-50">{t("nutritionMyDiet.otherMeal.detected")}</div>
                      </div>
                      <span className="rounded-full bg-emerald-300/12 px-3 py-1.5 text-[11px] font-extrabold text-emerald-200">
                        {t("nutritionMyDiet.otherMeal.confidence", { value: t(otherMealPhotoAnalysis.confidence === "high" ? "nutritionMyDiet.otherMeal.confidenceHigh" : otherMealPhotoAnalysis.confidence === "low" ? "nutritionMyDiet.otherMeal.confidenceLow" : "nutritionMyDiet.otherMeal.confidenceMedium") })}
                      </span>
                    </div>

                    <div className="space-y-3 px-4 py-4 text-center">
                      <div>
                        <div className="text-[19px] font-extrabold leading-8 text-white">{otherMealPhotoAnalysis.foodTitle}</div>
                        {otherMealPhotoAnalysis.foodDescription ? (
                          <div className="mt-1 text-[13px] font-semibold leading-6 text-slate-400">{otherMealPhotoAnalysis.foodDescription}</div>
                        ) : null}
                      </div>

                      {otherMealPhotoAnalysis.fullPortionText ? (
                        <div className="rounded-[16px] bg-white/[0.045] px-4 py-3 text-[13px] font-semibold leading-7 text-slate-300">
                          {t("nutritionMyDiet.otherMeal.detectedPortion", { value: otherMealPhotoAnalysis.fullPortionText })}
                        </div>
                      ) : null}

                      <div className="rounded-[18px] border border-amber-300/24 bg-amber-300/[0.07] px-4 py-4">
                        <div className="flex items-center justify-center gap-1.5 text-[12px] font-extrabold text-amber-300">
                          <Sparkles className="h-4 w-4" />
                          {t("nutritionMyDiet.otherMeal.suggestedPortion")}
                        </div>
                        <div className="mt-3 text-[18px] font-extrabold leading-8 text-white">{otherMealPhotoAnalysis.suggestedQuantityText}</div>
                        <div className="mt-2 text-[12px] font-semibold leading-6 text-slate-400">{t("nutritionMyDiet.otherMeal.budgetFor", { meal: otherMealDraft.slotTitle || t("nutritionMyDiet.mealCard.thisMeal") })}</div>
                        <div className="mt-3 inline-flex rounded-[14px] bg-amber-300/14 px-3 py-2 text-[14px] font-extrabold text-amber-200">
                          {t("nutritionMyDiet.otherMeal.calorieEstimate", { calories: format.number(otherMealPhotoAnalysis.suggestedCalories, { maximumFractionDigits: 0 }) })}
                        </div>
                      </div>

                      <div className="rounded-[18px] border border-sky-300/18 bg-sky-300/[0.08] px-4 py-4 text-start">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-[13px] font-extrabold text-sky-100">{t("nutritionMyDiet.otherMeal.aiOpinion")}</div>
                          <span className="flex h-8 w-8 items-center justify-center rounded-[12px] bg-sky-300/14 text-sky-200">
                            <Sparkles className="h-4 w-4" />
                          </span>
                        </div>
                        <div className="mt-2 text-[13px] font-semibold leading-7 text-slate-300">{otherMealPhotoAnalysis.guidanceText}</div>
                      </div>
                    </div>

                    {!canSaveOtherMealPhotoAnalysis ? (
                      <div className="mx-4 mb-4 rounded-[16px] border border-amber-300/20 bg-amber-300/10 px-3 py-3 text-[11px] leading-6 text-amber-50">
                        {t("nutritionMyDiet.otherMeal.notUsableNotice")}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
          </div>

          {otherMealMode !== "photo" || canSaveOtherMealPhotoAnalysis ? (
          <DialogFooter className="shrink-0 border-t border-white/10 bg-[#111b2a]/94 px-5 py-4 backdrop-blur-sm">
            {otherMealMode !== "choice" ? (
              <div className={`grid w-full gap-3 ${otherMealMode === "photo" && canSaveOtherMealPhotoAnalysis ? "grid-cols-[minmax(0,1.85fr)_minmax(0,0.8fr)]" : "grid-cols-[minmax(0,1.65fr)_minmax(0,0.95fr)]"}`}>
                {otherMealMode !== "photo" || canSaveOtherMealPhotoAnalysis ? (
                  <Button
                    type="button"
                    disabled={
                      otherMealSaving
                      || (otherMealMode === "manual" && otherMealDraft.foodTitle.trim() === "")
                      || (otherMealMode === "photo" && (!otherMealPhotoAnalysis || !otherMealPhotoFile || !canSaveOtherMealPhotoAnalysis))
                    }
                    className="h-[52px] rounded-[16px] bg-emerald-500 text-[14px] font-extrabold text-slate-950 hover:bg-emerald-400"
                    onClick={() => void saveOtherMeal()}
                  >
                    {otherMealSaving ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
                    {otherMealMode === "photo" ? <CheckCircle2 className="me-2 h-4 w-4" /> : null}
                    {otherMealMode === "photo" ? t("nutritionMyDiet.otherMeal.saveWithSuggestion") : t("nutritionMyDiet.otherMeal.save")}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  className="h-[52px] rounded-[16px] border-white/10 bg-white/[0.04] text-[14px] font-extrabold text-slate-300 hover:bg-white/[0.08] hover:text-white"
                  onClick={() => {
                    if (otherMealMode === "photo" && otherMealPhotoAnalysis) {
                      setOtherMealPhotoAnalysis(null);
                      window.setTimeout(() => otherMealPhotoAnalysisRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
                      return;
                    }

                    closeOtherMealModal();
                  }}
                >
                  {otherMealMode === "photo" ? t("nutritionMyDiet.otherMeal.edit") : t("common.close")}
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="h-[48px] w-full rounded-[15px] border-white/10 bg-white/[0.035] text-[14px] font-extrabold text-slate-400 hover:bg-white/[0.07] hover:text-white"
                onClick={closeOtherMealModal}
              >
                {t("nutritionMyDiet.overLimit.later")}
              </Button>
            )}
          </DialogFooter>
          ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(registeredMealConfirmation)} onOpenChange={(open) => !open && setRegisteredMealConfirmation(null)}>
        <DialogContent
          dir={dir}
          className="w-[calc(100vw-32px)] max-w-[330px] rounded-[28px] border-emerald-300/24 bg-[linear-gradient(180deg,rgba(17,31,25,0.98),rgba(11,15,20,0.99))] p-0 text-white shadow-[0_34px_90px_-54px_rgba(16,185,129,0.72)]"
        >
          <div className="px-5 pb-5 pt-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[20px] bg-emerald-300 text-slate-950 shadow-[0_18px_42px_-24px_rgba(52,211,153,0.95)]">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <DialogHeader className="mt-4 space-y-1.5 text-center">
              <DialogTitle className="text-center text-[18px] font-black leading-7 text-emerald-50">
                {registeredMealConfirmation?.mode === "extra"
                  ? t("nutritionMyDiet.confirmation.extraTitle")
                  : registeredMealConfirmation?.mode === "replacement"
                    ? t("nutritionMyDiet.confirmation.replacementTitle")
                    : t("nutritionMyDiet.confirmation.mealTitle")}
              </DialogTitle>
              <DialogDescription className="text-center text-[12px] font-semibold leading-6 text-slate-300">
                {registeredMealConfirmation
                  ? t("nutritionMyDiet.confirmation.description", {
                      food: registeredMealConfirmation.foodTitle,
                      meal: registeredMealConfirmation.slotTitle,
                      date: registeredMealDateText,
                    })
                  : ""}
              </DialogDescription>
            </DialogHeader>
            <Button
              type="button"
              className="mt-5 h-11 w-full rounded-[16px] bg-emerald-400 text-[14px] font-black text-slate-950 hover:bg-emerald-300"
              onClick={() => setRegisteredMealConfirmation(null)}
            >
              {t("common.ok")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={changeFoodOpen}
        onOpenChange={(open) => {
          setChangeFoodOpen(open);
          if (!open && ["queued", "processing"].includes(changeFoodDraft.status) && changeFoodDraft.suggestionId) {
            setDismissedChangeFoodSuggestionId(changeFoodDraft.suggestionId);
          }
        }}
      >
        <DialogContent dir={dir} className="border-amber-300/20 bg-[#101b2b] text-white sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-start">
              <Sparkles className="h-5 w-5 text-amber-300" />
              {t("nutritionMyDiet.changeFood.title", { meal: changeFoodDraft.slotTitle || t("nutritionMyDiet.mealCard.thisMeal") })}
            </DialogTitle>
          </DialogHeader>

          <div className="max-h-[60vh] space-y-3 overflow-y-auto pe-1">
            {["queued", "processing"].includes(changeFoodDraft.status) ? (
              <div className="rounded-[22px] border border-amber-300/20 bg-amber-300/10 px-4 py-5 text-center">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-amber-300" />
                <div className="mt-4 text-base font-black text-white">{t("nutritionMyDiet.changeFood.loadingTitle")}</div>
                <div className="mt-2 text-sm leading-7 text-slate-300">
                  {t("nutritionMyDiet.changeFood.loadingDescription")}
                </div>
              </div>
            ) : null}

            {changeFoodDraft.status === "failed" ? (
              <div className="rounded-[22px] border border-rose-300/20 bg-rose-300/10 px-4 py-5">
                <div className="text-base font-black text-white">{t("nutritionMyDiet.changeFood.failedTitle")}</div>
                <div className="mt-2 text-sm leading-7 text-rose-100/90">
                  {changeFoodDraft.errorMessage || t("nutritionMyDiet.changeFood.failedDescription")}
                </div>
              </div>
            ) : null}

            {changeFoodDraft.status === "cancelled" ? (
              <div className="rounded-[22px] border border-slate-300/15 bg-white/[0.04] px-4 py-5">
                <div className="text-base font-black text-white">{t("nutritionMyDiet.changeFood.cancelledTitle")}</div>
                <div className="mt-2 text-sm leading-7 text-slate-300">
                  {t("nutritionMyDiet.changeFood.cancelledDescription")}
                </div>
              </div>
            ) : null}

            {changeFoodDraft.options.map((option, index) => {
              const expanded = expandedChangeFoodOptionId === option.id;

              return (
                <article key={option.id} className={cn("overflow-hidden rounded-[18px] border bg-[#142235] transition", expanded ? "border-amber-300/35 shadow-[0_20px_45px_-34px_rgba(251,191,36,0.8)]" : "border-white/10")}>
                  <button
                    type="button"
                    onClick={() => setExpandedChangeFoodOptionId(expanded ? null : option.id)}
                    className="flex w-full items-start gap-3 px-3.5 py-3.5 text-start transition hover:bg-white/[0.025]"
                    aria-expanded={expanded}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] border border-amber-300/20 bg-amber-400/10 text-[12px] font-black text-amber-300">
                      {format.number(index + 1)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-black leading-6 text-white">{option.title}</span>
                      <span className="mt-2 flex flex-wrap gap-1.5">
                        {option.grams > 0 ? (
                          <span className="rounded-full border border-cyan-300/15 bg-cyan-400/8 px-2.5 py-1 text-[10px] font-black text-cyan-100">
                            {t("nutritionMyDiet.changeFood.weight", { weight: format.number(option.grams, { maximumFractionDigits: 0 }) })}
                          </span>
                        ) : null}
                        {String(option.quantityText ?? "").trim() !== "" ? (
                          <span className="rounded-full border border-amber-300/15 bg-amber-400/8 px-2.5 py-1 text-[10px] font-black text-amber-100">
                            {t("nutritionMyDiet.changeFood.amount", { amount: option.quantityText })}
                          </span>
                        ) : null}
                        <span className="rounded-full border border-emerald-300/15 bg-emerald-400/8 px-2.5 py-1 text-[10px] font-black text-emerald-100">
                          {t("nutritionProfileHome.kcalValue", { count: format.number(option.calories, { maximumFractionDigits: 0 }) })}
                        </span>
                      </span>
                    </span>
                    <ChevronDown className={cn("mt-1 h-4 w-4 shrink-0 text-slate-400 transition-transform", expanded && "rotate-180 text-amber-300")} />
                  </button>

                  {expanded ? (
                    <div className="border-t border-white/8 px-3.5 pb-3.5 pt-3">
                      {String(option.description ?? "").trim() !== "" ? (
                        <div className="text-[12px] font-bold leading-7 text-slate-300">{option.description}</div>
                      ) : null}
                      {String(option.preparationText ?? "").trim() !== "" ? (
                        <div className="mt-3 rounded-[13px] border border-cyan-400/15 bg-cyan-400/8 px-3 py-2.5">
                          <div className="text-[10px] font-black text-cyan-300">{t("nutritionMyDiet.changeFood.preparation")}</div>
                          <div className="mt-1 text-[12px] font-bold leading-6 text-cyan-50/90">{option.preparationText}</div>
                        </div>
                      ) : null}
                      {String(option.matchReason ?? "").trim() !== "" ? (
                        <div className="mt-3 text-[11px] leading-6 text-amber-100/75">{t("nutritionMyDiet.changeFood.matchReason", { reason: option.matchReason ?? "" })}</div>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="flex border-t border-white/8 p-2.5 sm:justify-end">
                    <Button type="button" onClick={() => void saveChangedFood(option)} className="h-10 w-full rounded-[12px] bg-amber-400 px-4 text-[12px] font-black text-slate-950 hover:bg-amber-300 sm:w-auto sm:min-w-[132px] sm:rounded-[11px]">
                      <CheckCircle2 className="me-1.5 h-3.5 w-3.5" />
                      {t("nutritionMyDiet.changeFood.select")}
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            {changeFoodDraft.options.length > 0 ? (
              <div className="text-[11px] leading-6 text-slate-400">
                {t("nutritionMyDiet.changeFood.optionsSaved", {
                  count: format.number(changeFoodDraft.options.length, { maximumFractionDigits: 0 }),
                  meal: changeFoodDraft.slotTitle || t("nutritionMyDiet.mealCard.thisMeal"),
                })}
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {["queued", "processing"].includes(changeFoodDraft.status) && changeFoodDraft.suggestionId ? (
                <Button
                  type="button"
                  variant="outline"
                  className="border-rose-300/20 bg-rose-300/10 text-rose-100 hover:bg-rose-300/15"
                  onClick={() => void cancelChangedFoodRequest()}
                >
                  {t("nutritionMyDiet.changeFood.cancelRequest")}
                </Button>
              ) : null}
              {["failed", "cancelled"].includes(changeFoodDraft.status) ? (
                <Button
                  type="button"
                  className="bg-amber-400 text-slate-950 hover:bg-amber-300"
                  onClick={() => void openChangeFood({
                    sourceType: changeFoodDraft.sourceType,
                    mealSlotKey: changeFoodDraft.mealSlotKey,
                    slotTitle: changeFoodDraft.slotTitle,
                    dayNumber: changeFoodDraft.dayNumber ?? undefined,
                    mealIndex: changeFoodDraft.mealIndex ?? undefined,
                  })}
                >
                  {t("common.tryAgain")}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                className="border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]"
                onClick={() => setChangeFoodOpen(false)}
              >
                {t("common.close")}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(mealPhotoPreview)} onOpenChange={(open) => !open && setMealPhotoPreview(null)}>
        <DialogContent dir={dir} className="max-w-3xl border-white/10 bg-[#101b2b] text-white">
          <DialogHeader>
            <DialogTitle className="text-start">{mealPhotoPreview?.title ?? t("nutritionMyDiet.manualLog.photoAlt")}</DialogTitle>
            <DialogDescription className="text-start text-slate-300">
              {t("nutritionMyDiet.photoPreview.description")}
            </DialogDescription>
          </DialogHeader>
          {mealPhotoPreview?.url ? (
            <div className="overflow-hidden rounded-[24px] border border-white/10 bg-slate-950/30">
              <img src={mealPhotoPreview.url} alt={mealPhotoPreview.title ?? t("nutritionMyDiet.manualLog.photoAlt")} className="max-h-[75vh] w-full object-contain" />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
