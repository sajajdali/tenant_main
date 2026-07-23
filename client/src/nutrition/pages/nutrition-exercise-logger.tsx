import { useEffect, useMemo, useState } from "react";
import type { ComponentType } from "react";
import {
  Activity,
  Apple,
  CalendarDays,
  CheckSquare,
  Clock3,
  Flame,
  ListFilter,
  Loader2,
  Search,
  Sparkles,
  Trash2,
  TrendingDown,
} from "lucide-react";
import { useLocation, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import type { NutritionDietPrescription, NutritionExerciseGroup, NutritionExerciseItem } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { useFormat, useLocale, useT } from "@/i18n/locale";
import { NutritionTopbar } from "@/nutrition/components/nutrition-topbar";
import { NutritionExerciseLogModal } from "@/nutrition/components/nutrition-exercise-log-modal";
import { getNutritionExerciseIcon } from "@/nutrition/lib/exercise-helpers";
import { cn } from "@/lib/utils";

function formatValue(value: number | string | null | undefined, formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string) {
  if (value === undefined || value === null || value === "") {
    return "—";
  }

  const numeric = typeof value === "number" ? value : Number(value);
  if (Number.isFinite(numeric)) {
    return formatNumber(numeric, { maximumFractionDigits: 1 });
  }

  return String(value);
}

type StatCardProps = {
  title: string;
  subtitle: string;
  value: string;
  unit?: string;
  icon: ComponentType<{ className?: string }>;
  tone: "slate" | "emerald" | "amber" | "sky" | "rose";
};

const statToneClasses = {
  slate: {
    card: "border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.055),rgba(255,255,255,0.025))]",
    icon: "bg-slate-700/45 text-slate-200",
    value: "text-slate-100",
  },
  emerald: {
    card: "border-emerald-400/25 bg-[linear-gradient(145deg,rgba(16,185,129,0.2),rgba(12,44,40,0.72))]",
    icon: "bg-emerald-400/18 text-emerald-300",
    value: "text-emerald-300",
  },
  amber: {
    card: "border-amber-400/25 bg-[linear-gradient(145deg,rgba(245,158,11,0.16),rgba(35,26,16,0.74))]",
    icon: "bg-amber-400/18 text-amber-300",
    value: "text-amber-300",
  },
  sky: {
    card: "border-sky-400/25 bg-[linear-gradient(145deg,rgba(59,130,246,0.17),rgba(14,28,47,0.76))]",
    icon: "bg-sky-400/18 text-sky-300",
    value: "text-sky-300",
  },
  rose: {
    card: "border-rose-400/25 bg-[linear-gradient(145deg,rgba(244,63,94,0.16),rgba(45,18,27,0.74))]",
    icon: "bg-rose-400/18 text-rose-300",
    value: "text-rose-300",
  },
} satisfies Record<StatCardProps["tone"], Record<"card" | "icon" | "value", string>>;

function StatCard({ title, subtitle, value, unit = "kcal", icon: Icon, tone }: StatCardProps) {
  const toneClass = statToneClasses[tone];

  return (
    <div className={cn("min-h-[118px] rounded-[18px] border p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]", toneClass.card)}>
      <div className="flex items-center gap-2">
        <span className={cn("flex h-8 w-8 items-center justify-center rounded-[10px]", toneClass.icon)}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-[11px] font-black text-slate-300">{title}</span>
      </div>
      <div className={cn("mt-5 flex items-baseline gap-1 text-[22px] font-black leading-none", toneClass.value)}>
        <span>{value}</span>
        <span className="text-[12px] font-black">{unit}</span>
      </div>
      <div className="mt-3 text-[10px] font-semibold leading-5 text-slate-500">{subtitle}</div>
    </div>
  );
}

function toLocalIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function extractLoggedCalories(value?: string | null) {
  const raw = String(value ?? "").trim();
  const match = raw.match(/(?:^|\|)\s*calories:(\d+)/);

  return match ? Number(match[1]) : 0;
}

function resolveLoggedCalories(log?: NonNullable<NutritionDietPrescription["mealLogs"]>[number] | null) {
  const value = Number(log?.calories ?? 0);
  return Number.isFinite(value) && value > 0 ? value : extractLoggedCalories(log?.notes);
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function resolveInitialDate(prescription: NutritionDietPrescription | null, requestedDate?: string | null) {
  if (requestedDate) {
    return requestedDate;
  }

  const today = toLocalIsoDate(new Date());
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

function intensityLabel(value: string | null | undefined, t: ReturnType<typeof useT>) {
  switch (String(value ?? "").toLowerCase()) {
    case "light":
      return t("nutritionExerciseLogger.intensity.light");
    case "vigorous":
      return t("nutritionExerciseLogger.intensity.vigorous");
    default:
      return t("nutritionExerciseLogger.intensity.moderate");
  }
}

export default function NutritionExerciseLoggerPage() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/nutrition/my-diets/:prescriptionId/exercises");
  const { toast } = useToast();
  const t = useT();
  const format = useFormat();
  const { dir } = useLocale();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [prescription, setPrescription] = useState<NutritionDietPrescription | null>(null);
  const [groups, setGroups] = useState<NutritionExerciseGroup[]>([]);
  const [activeDate, setActiveDate] = useState("");
  const [selectedExercise, setSelectedExercise] = useState<NutritionExerciseItem | null>(null);
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingExerciseId, setDeletingExerciseId] = useState<string | null>(null);

  const searchParams = new URLSearchParams(globalThis.location?.search ?? "");
  const requestedDate = searchParams.get("date");
  const backHref = match && params?.prescriptionId ? `/nutrition/my-diets/${params.prescriptionId}` : "/nutrition/my-diet";
  const toLocaleValue = (value?: number | string | null) => formatValue(value, format.number);
  const formatActiveDate = (date: string) => date ? format.date(`${date}T12:00:00`) : t("nutritionExerciseLogger.selectedDate");

  useEffect(() => {
    const request = match && params?.prescriptionId
      ? api.nutritionPrescriptions.show(params.prescriptionId)
      : api.nutritionPrescriptions.current();

    Promise.all([request, api.nutritionExercises.list()]).then(([prescriptionResult, exerciseResult]) => {
      if (prescriptionResult.success) {
        const nextPrescription = prescriptionResult.data.prescription;
        setPrescription(nextPrescription);
        setActiveDate(resolveInitialDate(nextPrescription, requestedDate));
      } else {
        toast({ variant: "destructive", title: t("nutritionExerciseLogger.toast.prescriptionLoadFailedTitle"), description: prescriptionResult.message || t("nutritionExerciseLogger.toast.prescriptionLoadFailedDescription") });
      }

      if (exerciseResult.success) {
        setGroups(exerciseResult.data.groups ?? []);
      } else {
        toast({ variant: "destructive", title: t("nutritionExerciseLogger.toast.exerciseLoadFailedTitle"), description: exerciseResult.message || t("nutritionExerciseLogger.toast.exerciseLoadFailedDescription") });
      }

      setLoading(false);
    });
  }, [match, params?.prescriptionId, requestedDate, t, toast]);

  const selectedExerciseLogs = useMemo(() => {
    return (prescription?.exerciseLogs ?? []).filter((log) => log.consumedDate === activeDate);
  }, [activeDate, prescription?.exerciseLogs]);

  const selectedMealCalories = useMemo(() => {
    return (prescription?.mealLogs ?? [])
      .filter((log) => log.consumedDate === activeDate)
      .reduce((sum, log) => sum + resolveLoggedCalories(log), 0);
  }, [activeDate, prescription?.mealLogs]);

  const burnedCalories = useMemo(() => {
    return selectedExerciseLogs.reduce((sum, log) => sum + Number(log.caloriesBurned ?? 0), 0);
  }, [selectedExerciseLogs]);

  const caloriePlan = asRecord(prescription?.contentSnapshot?.calorie_plan);
  const dailyCalorieTarget = Number(caloriePlan["prescribed_calories"] ?? caloriePlan["base_calories"] ?? 0);
  const overTargetCalories = dailyCalorieTarget > 0 ? Math.max(selectedMealCalories - dailyCalorieTarget, 0) : 0;
  const remainingTodayCalories = dailyCalorieTarget > 0 ? Math.max(dailyCalorieTarget - selectedMealCalories, 0) : 0;
  const compensatedCalories = Math.min(overTargetCalories, burnedCalories);
  const remainingOverTargetCalories = Math.max(overTargetCalories - burnedCalories, 0);
  const extraBurnedCalories = overTargetCalories > 0 ? Math.max(burnedCalories - overTargetCalories, 0) : burnedCalories;
  const exerciseLoggingEnabled = prescription?.exerciseLoggingEnabled !== false;

  const filteredGroups = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) {
      return groups;
    }

    return groups
      .map((group) => ({
        ...group,
        exercises: group.exercises.filter((exercise) => {
          const haystack = [group.title, exercise.title, exercise.description, exercise.badgeText, exercise.searchTerms].join(" ").toLowerCase();
          return haystack.includes(keyword);
        }),
      }))
      .filter((group) => group.exercises.length > 0 || group.title.toLowerCase().includes(keyword));
  }, [groups, search]);

  const saveExercise = async (payload: {
    exerciseRef: string;
    intensity: "light" | "moderate" | "vigorous";
    durationMinutes: number;
    distanceKm?: number | null;
    speedKmh?: number | null;
    weightKg: number;
    notes?: string;
  }) => {
    if (!activeDate) {
      return;
    }

    setSaving(true);
    const result = await api.nutritionPrescriptions.logExercise({
      consumedDate: activeDate,
      exerciseRef: payload.exerciseRef,
      intensity: payload.intensity,
      durationMinutes: payload.durationMinutes,
      distanceKm: payload.distanceKm ?? null,
      speedKmh: payload.speedKmh ?? null,
      weightKg: payload.weightKg,
      notes: payload.notes,
    });

    if (result.success) {
      setPrescription(result.data.prescription);
      setLogModalOpen(false);
      toast({ title: t("nutritionExerciseLogger.toast.savedTitle"), description: t("nutritionExerciseLogger.toast.savedDescription") });
    } else {
      toast({ variant: "destructive", title: t("nutritionExerciseLogger.toast.saveFailedTitle"), description: result.message || t("nutritionExerciseLogger.toast.tryAgain") });
    }

    setSaving(false);
  };

  const deleteExercise = async (exerciseLogId: string) => {
    setDeletingExerciseId(exerciseLogId);
    const result = await api.nutritionPrescriptions.deleteExercise(exerciseLogId);

    if (result.success) {
      setPrescription(result.data.prescription);
      toast({ title: t("nutritionExerciseLogger.toast.deletedTitle"), description: t("nutritionExerciseLogger.toast.deletedDescription") });
    } else {
      toast({ variant: "destructive", title: t("nutritionExerciseLogger.toast.deleteFailedTitle"), description: result.message || t("nutritionExerciseLogger.toast.tryAgain") });
    }

    setDeletingExerciseId(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#05080d] px-4 py-6 text-white" dir={dir}>
        <div className="mx-auto min-h-screen max-w-[430px] rounded-[34px] border border-white/10 bg-[#0b0f17] px-5 py-5 shadow-[0_30px_120px_-70px_rgba(15,23,42,0.95)]">
          <NutritionTopbar backHref={backHref} title={t("nutritionExerciseLogger.topbarTitle")} variant="hero" compact />
          <div className="mt-16 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-300" />
          </div>
        </div>
      </div>
    );
  }

  if (!exerciseLoggingEnabled) {
    return (
      <div className="min-h-screen bg-[#05080d] px-4 py-6 text-white" dir={dir}>
        <div className="mx-auto min-h-screen max-w-[430px] rounded-[34px] border border-white/10 bg-[#0b0f17] px-5 py-5 shadow-[0_30px_120px_-70px_rgba(15,23,42,0.95)]">
          <NutritionTopbar backHref={backHref} title={t("nutritionExerciseLogger.topbarTitle")} variant="hero" compact />
          <div className="mt-6 rounded-[24px] border border-white/10 bg-[linear-gradient(145deg,rgba(10,27,40,0.98),rgba(7,16,27,0.97))] p-6 text-center">
            <div className="text-xl font-black text-white">{t("nutritionExerciseLogger.disabledTitle")}</div>
            <div className="mt-3 text-sm leading-7 text-slate-300">
              {t("nutritionExerciseLogger.disabledDescription")}
            </div>
            <Button className="mt-5 rounded-2xl bg-white/[0.08] text-white hover:bg-white/[0.14]" onClick={() => setLocation(backHref)}>
              {t("nutritionExerciseLogger.backToDiet")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#05080d] px-4 py-6 text-white" dir={dir}>
      <div className="mx-auto min-h-screen max-w-[430px] overflow-hidden rounded-[34px] border border-white/10 bg-[#0b0f17] px-5 py-5 shadow-[0_30px_120px_-70px_rgba(15,23,42,0.95)]">
        <NutritionTopbar backHref={backHref} title={t("nutritionExerciseLogger.topbarTitle")} variant="hero" compact />

        <section className="relative mt-4 overflow-hidden rounded-[24px] border border-emerald-400/20 bg-[linear-gradient(162deg,rgba(13,58,56,0.72),rgba(10,18,32,0.94)_58%,rgba(10,14,23,0.98))] px-5 py-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <div className="pointer-events-none absolute -end-10 -top-14 h-36 w-36 rounded-full bg-emerald-400/10 blur-3xl" />
          <div className="relative">
            <div className="mb-5 flex justify-end">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.055] px-3 py-2 text-[11px] font-bold leading-none text-slate-300">
                <CalendarDays className="h-3.5 w-3.5 text-emerald-300" />
                <span>{t("nutritionExerciseLogger.day")}</span>
                <span>{formatActiveDate(activeDate)}</span>
              </div>
            </div>
            <div className="text-start">
              <h1 className="text-[24px] font-black leading-9 text-white">{t("nutritionExerciseLogger.title")}</h1>
              <div className="mt-3 text-[13px] font-medium leading-7 text-slate-400">
                {t("nutritionExerciseLogger.description")}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-4 grid grid-cols-2 gap-3">
          <StatCard title={t("nutritionExerciseLogger.stats.exerciseCalories")} subtitle={t("nutritionExerciseLogger.stats.exerciseCaloriesSubtitle")} value={toLocaleValue(burnedCalories)} icon={Activity} tone="emerald" />
          <StatCard title={t("nutritionExerciseLogger.stats.todayConsumption")} subtitle={t("nutritionExerciseLogger.stats.todayConsumptionSubtitle")} value={toLocaleValue(selectedMealCalories)} icon={Apple} tone="slate" />
          <StatCard
            title={t("nutritionExerciseLogger.stats.todayBudget")}
            subtitle={overTargetCalories > 0 ? t("nutritionExerciseLogger.stats.overBudget") : t("nutritionExerciseLogger.stats.remainingBudget")}
            value={overTargetCalories > 0 ? `+${toLocaleValue(overTargetCalories)}` : toLocaleValue(remainingTodayCalories)}
            icon={Clock3}
            tone={overTargetCalories > 0 ? "rose" : "sky"}
          />
          <StatCard title={t("nutritionExerciseLogger.stats.netToday")} subtitle={t("nutritionExerciseLogger.stats.netTodaySubtitle")} value={toLocaleValue(selectedMealCalories - burnedCalories)} icon={TrendingDown} tone="amber" />
        </section>

        <section className="mt-4 rounded-[18px] border border-emerald-400/25 bg-[linear-gradient(145deg,rgba(16,185,129,0.14),rgba(7,44,39,0.62))] p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-emerald-400/18 text-emerald-300">
              {overTargetCalories > 0 && remainingOverTargetCalories > 0 ? <Flame className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
            </span>
            <div className="text-[12px] font-bold leading-7 text-emerald-50/90">
              {overTargetCalories > 0
                ? remainingOverTargetCalories > 0
                  ? compensatedCalories > 0
                    ? t("nutritionExerciseLogger.summary.partiallyCompensated", { compensated: toLocaleValue(compensatedCalories), remaining: toLocaleValue(remainingOverTargetCalories) })
                    : t("nutritionExerciseLogger.summary.overTarget", { calories: toLocaleValue(overTargetCalories) })
                  : extraBurnedCalories > 0
                    ? t("nutritionExerciseLogger.summary.extraBurned", { calories: toLocaleValue(extraBurnedCalories) })
                    : t("nutritionExerciseLogger.summary.fullyCompensated")
                : burnedCalories > 0
                  ? t("nutritionExerciseLogger.summary.burnedToday", { calories: toLocaleValue(burnedCalories) })
                  : t("nutritionExerciseLogger.summary.noBurnYet")}
            </div>
          </div>
        </section>

        <section className="mt-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-[18px] font-black text-white">
              <span className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-emerald-400/14 text-emerald-300">
                <CheckSquare className="h-5 w-5" />
              </span>
              <span>{t("nutritionExerciseLogger.loggedTitle")}</span>
            </div>
            <div className="text-[12px] font-bold text-slate-500">{t("nutritionExerciseLogger.itemsCount", { count: toLocaleValue(selectedExerciseLogs.length) })}</div>
          </div>

          <div className="space-y-3">
            {selectedExerciseLogs.length > 0 ? selectedExerciseLogs.map((log) => {
              const Icon = getNutritionExerciseIcon(log.iconKey);

              return (
                <div key={log.id} className="flex min-h-[82px] items-center justify-between gap-3 rounded-[18px] border border-white/10 bg-white/[0.04] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-slate-700/35 text-slate-300">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-[15px] font-black text-white">{log.title}</div>
                      <div className="mt-1 truncate text-[11px] font-semibold text-slate-500">
                        {t("nutritionExerciseLogger.minutesValue", { minutes: toLocaleValue(log.durationMinutes) })}
                        {" · "}
                        {t("nutritionExerciseLogger.intensityValue", { intensity: intensityLabel(log.intensity, t) })}
                        {log.weightKg ? ` | ${t("nutritionExerciseLogger.weightValue", { weight: toLocaleValue(log.weightKg) })}` : ""}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <div className="flex h-12 min-w-[58px] flex-col items-center justify-center rounded-[14px] border border-emerald-300/25 bg-emerald-400/10 px-2 text-emerald-300">
                      <span className="text-[18px] font-black leading-none">{toLocaleValue(log.caloriesBurned)}</span>
                      <span className="mt-1 text-[9px] font-black">kcal</span>
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-11 w-11 rounded-[13px] border-rose-400/20 bg-rose-400/10 text-rose-300 hover:bg-rose-400/15 hover:text-rose-200"
                      onClick={() => void deleteExercise(log.id)}
                      disabled={deletingExerciseId === log.id}
                    >
                      {deletingExerciseId === log.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              );
            }) : (
              <div className="rounded-[18px] border border-dashed border-white/12 bg-white/[0.03] px-4 py-5 text-sm leading-7 text-slate-400">
                {t("nutritionExerciseLogger.emptyLogged")}
              </div>
            )}
          </div>
        </section>

        <section className="mt-6 pb-8">
          <div className="mb-4 text-center">
            <div className="flex items-center justify-center gap-2 text-[18px] font-black text-white">
              <span>{t("nutritionExerciseLogger.libraryTitle")}</span>
              <span className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-amber-400/13 text-amber-300">
                <ListFilter className="h-5 w-5" />
              </span>
            </div>
            <div className="mt-2 text-[11px] font-semibold leading-6 text-slate-500">
              {t("nutritionExerciseLogger.libraryDescription")}
            </div>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute end-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-600" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("nutritionExerciseLogger.searchPlaceholder")}
              className="h-12 rounded-[15px] border-white/10 bg-white/[0.045] pe-12 text-start text-sm font-bold text-white placeholder:text-slate-500 focus-visible:ring-emerald-400/35"
            />
          </div>

          <div className="mt-5 space-y-6">
            {filteredGroups.map((group) => (
              <section key={group.id}>
                <div className="mb-3 text-start">
                  <div className="flex items-center justify-start gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    <span className="text-[16px] font-black text-white">{group.title}</span>
                  </div>
                  {group.description ? <div className="mt-1 text-[11px] font-semibold leading-6 text-slate-500">{group.description}</div> : null}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {group.exercises.map((exercise) => {
                    const Icon = getNutritionExerciseIcon(exercise.iconKey);
                    const isSelected = selectedExercise?.id === exercise.id;

                    return (
                      <button
                        key={exercise.id}
                        type="button"
                        onClick={() => {
                          setSelectedExercise(exercise);
                          setLogModalOpen(true);
                        }}
                        className={cn(
                          "min-h-[150px] rounded-[18px] border p-3.5 text-start transition-all",
                          isSelected
                            ? "border-emerald-300/45 bg-emerald-400/10 shadow-[0_20px_50px_-35px_rgba(16,185,129,0.55)]"
                            : "border-white/10 bg-white/[0.04] hover:bg-white/[0.08]",
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="max-w-[74px] truncate rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[10px] font-bold text-slate-400">
                            {exercise.badgeText || group.title}
                          </span>
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-emerald-400/15">
                            <Icon className={cn("h-5 w-5", isSelected ? "text-emerald-100" : "text-emerald-300")} />
                          </div>
                        </div>
                        <div className="mt-7 text-[15px] font-black leading-6 text-white">{exercise.title}</div>
                        <div className="mt-2 line-clamp-2 text-[11px] font-semibold leading-6 text-slate-500">{exercise.description || t("nutritionExerciseLogger.exerciseDescriptionFallback")}</div>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}

            {filteredGroups.length === 0 ? (
              <div className="rounded-[18px] border border-dashed border-white/12 bg-white/[0.03] px-4 py-5 text-sm leading-7 text-slate-400">
                {t("nutritionExerciseLogger.noSearchResults")}
              </div>
            ) : null}
          </div>
        </section>

        <NutritionExerciseLogModal
          open={logModalOpen}
          onOpenChange={setLogModalOpen}
          exercise={selectedExercise}
          activeDate={activeDate}
          initialWeightKg={prescription?.currentWeightKg ?? null}
          targetCalories={remainingOverTargetCalories}
          saving={saving}
          onSubmit={saveExercise}
        />
      </div>
    </div>
  );
}
