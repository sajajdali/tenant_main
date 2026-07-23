import { useMemo, useState } from "react";
import {
  BadgeCheck,
  CalendarRange,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  Flame,
  MoonStar,
  RefreshCcw,
  Sparkles,
  Sun,
  Sunset,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { NutritionAudioGuidance, type NutritionAudioTrack } from "@/nutrition/components/nutrition-audio-guidance";
import { NutritionTopbar } from "@/nutrition/components/nutrition-topbar";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useFormat, useLocale, useT } from "@/i18n/locale";
import type { MessageKey } from "@/i18n/messages";

type DayPlan = {
  dayKey: MessageKey;
  focusKey: MessageKey;
  meals: Array<{
    key: string;
    titleKey: MessageKey;
    timeHintKey: MessageKey;
    icon: typeof Sun;
    accent: string;
    descriptionKey: MessageKey;
    alternativeKeys: MessageKey[];
  }>;
};

const DIET_META = {
  titleKey: "nutritionDietWeeklyPreview.meta.title" as MessageKey,
  periodDays: 14,
  scheduleKey: "nutritionDietWeeklyPreview.meta.schedule" as MessageKey,
  calorieTarget: 1750,
  coachNoteKey: "nutritionDietWeeklyPreview.meta.coachNote" as MessageKey,
};

function mealKeys(day: number, meal: "breakfast" | "lunch" | "dinner") {
  return {
    titleKey: `nutritionDietWeeklyPreview.meals.${meal}.title` as MessageKey,
    timeHintKey: `nutritionDietWeeklyPreview.days.${day}.${meal}.time` as MessageKey,
    descriptionKey: `nutritionDietWeeklyPreview.days.${day}.${meal}.description` as MessageKey,
    alternativeKeys: [1, 2, 3].map((index) => `nutritionDietWeeklyPreview.days.${day}.${meal}.alternatives.${index}` as MessageKey),
  };
}

const WEEKLY_PLAN: DayPlan[] = [
  {
    dayKey: "nutritionDietWeeklyPreview.days.1.name",
    focusKey: "nutritionDietWeeklyPreview.days.1.focus",
    meals: [
      { key: "breakfast", ...mealKeys(1, "breakfast"), icon: Sun, accent: "from-amber-300/20 via-amber-200/10 to-transparent" },
      { key: "lunch", ...mealKeys(1, "lunch"), icon: Flame, accent: "from-emerald-300/20 via-emerald-200/10 to-transparent" },
      { key: "dinner", ...mealKeys(1, "dinner"), icon: MoonStar, accent: "from-violet-300/20 via-violet-200/10 to-transparent" },
    ],
  },
  {
    dayKey: "nutritionDietWeeklyPreview.days.2.name",
    focusKey: "nutritionDietWeeklyPreview.days.2.focus",
    meals: [
      { key: "breakfast", ...mealKeys(2, "breakfast"), icon: Sun, accent: "from-amber-300/20 via-amber-200/10 to-transparent" },
      { key: "lunch", ...mealKeys(2, "lunch"), icon: Flame, accent: "from-emerald-300/20 via-emerald-200/10 to-transparent" },
      { key: "dinner", ...mealKeys(2, "dinner"), icon: MoonStar, accent: "from-violet-300/20 via-violet-200/10 to-transparent" },
    ],
  },
  {
    dayKey: "nutritionDietWeeklyPreview.days.3.name",
    focusKey: "nutritionDietWeeklyPreview.days.3.focus",
    meals: [
      { key: "breakfast", ...mealKeys(3, "breakfast"), icon: Sun, accent: "from-amber-300/20 via-amber-200/10 to-transparent" },
      { key: "lunch", ...mealKeys(3, "lunch"), icon: Flame, accent: "from-emerald-300/20 via-emerald-200/10 to-transparent" },
      { key: "dinner", ...mealKeys(3, "dinner"), icon: MoonStar, accent: "from-violet-300/20 via-violet-200/10 to-transparent" },
    ],
  },
  {
    dayKey: "nutritionDietWeeklyPreview.days.4.name",
    focusKey: "nutritionDietWeeklyPreview.days.4.focus",
    meals: [
      { key: "breakfast", ...mealKeys(4, "breakfast"), icon: Sun, accent: "from-amber-300/20 via-amber-200/10 to-transparent" },
      { key: "lunch", ...mealKeys(4, "lunch"), icon: Flame, accent: "from-emerald-300/20 via-emerald-200/10 to-transparent" },
      { key: "dinner", ...mealKeys(4, "dinner"), icon: MoonStar, accent: "from-violet-300/20 via-violet-200/10 to-transparent" },
    ],
  },
  {
    dayKey: "nutritionDietWeeklyPreview.days.5.name",
    focusKey: "nutritionDietWeeklyPreview.days.5.focus",
    meals: [
      { key: "breakfast", ...mealKeys(5, "breakfast"), icon: Sun, accent: "from-amber-300/20 via-amber-200/10 to-transparent" },
      { key: "lunch", ...mealKeys(5, "lunch"), icon: Flame, accent: "from-emerald-300/20 via-emerald-200/10 to-transparent" },
      { key: "dinner", ...mealKeys(5, "dinner"), icon: MoonStar, accent: "from-violet-300/20 via-violet-200/10 to-transparent" },
    ],
  },
  {
    dayKey: "nutritionDietWeeklyPreview.days.6.name",
    focusKey: "nutritionDietWeeklyPreview.days.6.focus",
    meals: [
      { key: "breakfast", ...mealKeys(6, "breakfast"), icon: Sun, accent: "from-amber-300/20 via-amber-200/10 to-transparent" },
      { key: "lunch", ...mealKeys(6, "lunch"), icon: Flame, accent: "from-emerald-300/20 via-emerald-200/10 to-transparent" },
      { key: "dinner", ...mealKeys(6, "dinner"), icon: MoonStar, accent: "from-violet-300/20 via-violet-200/10 to-transparent" },
    ],
  },
  {
    dayKey: "nutritionDietWeeklyPreview.days.7.name",
    focusKey: "nutritionDietWeeklyPreview.days.7.focus",
    meals: [
      { key: "breakfast", ...mealKeys(7, "breakfast"), icon: Sun, accent: "from-amber-300/20 via-amber-200/10 to-transparent" },
      { key: "lunch", ...mealKeys(7, "lunch"), icon: Flame, accent: "from-emerald-300/20 via-emerald-200/10 to-transparent" },
      { key: "dinner", ...mealKeys(7, "dinner"), icon: MoonStar, accent: "from-violet-300/20 via-violet-200/10 to-transparent" },
    ],
  },
];

const NOTE_KEYS: MessageKey[] = [
  "nutritionDietWeeklyPreview.notes.1",
  "nutritionDietWeeklyPreview.notes.2",
  "nutritionDietWeeklyPreview.notes.3",
  "nutritionDietWeeklyPreview.notes.4",
];

const AUDIO_TRACK_DEFS: Array<NutritionAudioTrack & { titleKey: MessageKey; descriptionKey: MessageKey }> = [
  { id: "diet-weekly-1", title: "", description: "", titleKey: "nutritionDietWeeklyPreview.audio.weekly1.title", descriptionKey: "nutritionDietWeeklyPreview.audio.weekly1.description", duration: "02:20", url: "https://samplelib.com/lib/preview/mp3/sample-12s.mp3" },
  { id: "diet-weekly-2", title: "", description: "", titleKey: "nutritionDietWeeklyPreview.audio.weekly2.title", descriptionKey: "nutritionDietWeeklyPreview.audio.weekly2.description", duration: "01:50", url: "https://samplelib.com/lib/preview/mp3/sample-15s.mp3" },
];

export default function NutritionDietWeeklyPreviewPage() {
  const t = useT();
  const format = useFormat();
  const { dir } = useLocale();
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [completedMeals, setCompletedMeals] = useState<Record<string, boolean>>({});
  const [mealOverrides, setMealOverrides] = useState<Record<string, string>>({});
  const [changeMealTarget, setChangeMealTarget] = useState<{
    day: string;
    mealKey: string;
    mealTitle: string;
    currentDescription: string;
    alternatives: string[];
  } | null>(null);

  const selectedDay = WEEKLY_PLAN[selectedDayIndex];
  const selectedDayName = t(selectedDay.dayKey);
  const progressLabel = useMemo(
    () => t("nutritionDietWeeklyPreview.progress", {
      current: format.number(selectedDayIndex + 1),
      total: format.number(WEEKLY_PLAN.length),
    }),
    [format, selectedDayIndex, t],
  );
  const audioTracks = useMemo<NutritionAudioTrack[]>(
    () => AUDIO_TRACK_DEFS.map((track) => ({
      id: track.id,
      title: t(track.titleKey),
      description: t(track.descriptionKey),
      duration: track.duration,
      url: track.url,
    })),
    [t],
  );

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-[#06131d] px-4 py-8 pb-28 text-white" dir={dir}>
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.16),transparent_22%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.14),transparent_28%),linear-gradient(180deg,rgba(6,19,29,0.97),rgba(4,10,17,1))]" />
      <div className="fixed end-[-18%] top-14 -z-10 h-64 w-64 rounded-full bg-amber-400/10 blur-3xl" />
      <div className="fixed bottom-10 start-[-20%] -z-10 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />

      <div className="relative z-10 mx-auto max-w-md space-y-5">
        <NutritionTopbar backHref="/nutrition/profile" title={t("nutritionDietWeeklyPreview.topbarTitle")} description={t("nutritionDietWeeklyPreview.topbarDescription")} />

        <section className="rounded-[32px] border border-white/10 bg-[linear-gradient(165deg,rgba(16,29,45,0.96),rgba(9,18,30,0.92))] p-4 shadow-[0_35px_90px_-52px_rgba(0,0,0,0.95)]">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-bold text-white/80">
                <FileText className="h-3.5 w-3.5 text-amber-300" />
                {t(DIET_META.titleKey)}
              </div>
              <h1 className="text-[28px] font-black leading-tight">{t("nutritionDietWeeklyPreview.title", { count: format.number(7) })}</h1>
              <p className="text-sm leading-7 text-slate-300">
                {t("nutritionDietWeeklyPreview.description")}
              </p>
            </div>

            <div className="rounded-[22px] border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-center">
              <div className="text-[11px] font-bold text-emerald-200">{t("nutritionDietWeeklyPreview.executionRange")}</div>
              <div className="mt-1 text-lg font-black text-emerald-300">{t("nutritionDietWeeklyPreview.daysValue", { count: format.number(DIET_META.periodDays) })}</div>
              <div className="text-[10px] text-emerald-100/80">{t("nutritionDietWeeklyPreview.twoFullWeeks")}</div>
            </div>
          </div>

          <div className="mt-4 rounded-[24px] border border-amber-300/20 bg-amber-300/10 p-3 shadow-[0_20px_55px_-35px_rgba(251,191,36,0.6)]">
            <div className="flex items-center gap-2 text-sm font-black text-amber-100">
              <Sparkles className="h-4 w-4 text-amber-300" />
              {t(DIET_META.coachNoteKey)}
            </div>
            <div className="mt-2 text-xs leading-7 text-amber-50/85">
              {t("nutritionDietWeeklyPreview.repeatHint", { count: format.number(7) })}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-[20px] border border-white/10 bg-white/[0.04] px-3 py-3">
              <div className="text-[10px] font-bold text-slate-400">{t("nutritionDietWeeklyPreview.meta.duration")}</div>
              <div className="mt-2 text-sm font-black">{t("nutritionDietWeeklyPreview.daysValue", { count: format.number(DIET_META.periodDays) })}</div>
            </div>
            <div className="rounded-[20px] border border-white/10 bg-white/[0.04] px-3 py-3">
              <div className="text-[10px] font-bold text-slate-400">{t("nutritionDietWeeklyPreview.meta.schedule")}</div>
              <div className="mt-2 text-[11px] font-black leading-5">{t(DIET_META.scheduleKey)}</div>
            </div>
            <div className="rounded-[20px] border border-white/10 bg-white/[0.04] px-3 py-3">
              <div className="text-[10px] font-bold text-slate-400">{t("nutritionDietWeeklyPreview.meta.calorieTarget")}</div>
              <div className="mt-2 text-sm font-black">{t("nutritionDietWeeklyPreview.calorieValue", { count: format.number(DIET_META.calorieTarget) })}</div>
            </div>
          </div>

          <div className="mt-4 rounded-[24px] border border-white/10 bg-white/[0.04] p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-bold text-slate-400">{t("nutritionDietWeeklyPreview.selectDay")}</div>
                <div className="mt-1 text-sm font-bold text-white">{selectedDayName}</div>
              </div>
              <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-bold text-slate-300">
                <CalendarRange className="h-3.5 w-3.5 text-amber-300" />
                {progressLabel}
              </div>
            </div>

            <div className="mt-3 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {WEEKLY_PLAN.map((item, index) => {
                const active = index === selectedDayIndex;

                return (
                  <button
                    key={item.dayKey}
                    type="button"
                    onClick={() => setSelectedDayIndex(index)}
                    className={cn(
                      "min-w-[82px] rounded-[20px] border px-3 py-3 text-center transition",
                      active
                        ? "border-amber-300/40 bg-[linear-gradient(180deg,rgba(251,191,36,0.22),rgba(251,191,36,0.1))] text-white shadow-[0_18px_45px_-28px_rgba(251,191,36,0.85)]"
                        : "border-white/10 bg-white/[0.03] text-slate-300",
                    )}
                  >
                    <div className="text-xs font-black">{t(item.dayKey)}</div>
                    <div className={cn("mt-1 text-[10px]", active ? "text-amber-100" : "text-slate-500")}>
                      {t("nutritionDietWeeklyPreview.dayNumber", { day: format.number(index + 1) })}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-cyan-400/20 bg-cyan-400/10 p-4 shadow-[0_28px_70px_-48px_rgba(34,211,238,0.65)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-black text-cyan-100">
                <Clock3 className="h-5 w-5 text-cyan-300" />
                {t("nutritionDietWeeklyPreview.dayFocus", { day: selectedDayName })}
              </div>
              <div className="mt-2 text-sm leading-7 text-cyan-50/90">{t(selectedDay.focusKey)}</div>
            </div>
            <div className="rounded-[20px] border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-center">
              <div className="text-[11px] font-bold text-cyan-100">{t("nutritionDietWeeklyPreview.mealCount")}</div>
              <div className="mt-1 text-lg font-black text-white">{format.number(selectedDay.meals.length)}</div>
            </div>
          </div>
        </section>

        {selectedDay.meals.map((meal) => {
          const Icon = meal.icon;
          const mealStateKey = `${selectedDay.dayKey}-${meal.key}`;
          const isDone = completedMeals[mealStateKey] === true;
          const displayedDescription = mealOverrides[mealStateKey] ?? t(meal.descriptionKey);
          const mealTitle = t(meal.titleKey);

          return (
            <section
              key={`${selectedDay.dayKey}-${meal.key}`}
              className="overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(160deg,rgba(18,34,49,0.95),rgba(11,22,35,0.9))] shadow-[0_30px_80px_-45px_rgba(0,0,0,0.9)]"
            >
              <div className={cn("relative p-4", `bg-gradient-to-l ${meal.accent}`)}>
                <div className="absolute inset-0 opacity-40 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
                <div className="relative flex items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="text-xl font-black">{mealTitle}</div>
                      <div className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[10px] font-black text-slate-200">
                        {t("nutritionDietWeeklyPreview.fixedMeal")}
                      </div>
                    </div>
                    <div className="text-xs leading-6 text-slate-300">{t(meal.timeHintKey)}</div>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-[18px] border border-white/10 bg-white/10 text-amber-300">
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
              </div>

              <div className="p-4">
                <div
                  className={cn(
                    "rounded-[22px] border px-4 py-4 transition",
                    isDone ? "border-emerald-400/25 bg-emerald-400/10" : "border-white/10 bg-white/[0.04]",
                  )}
                >
                  <div className="text-[11px] font-bold text-slate-400">{t("nutritionDietWeeklyPreview.forDay", { day: selectedDayName })}</div>
                  <div className={cn("mt-2 text-sm font-bold leading-8", isDone ? "text-emerald-50" : "text-white")}>
                    {displayedDescription}
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCompletedMeals((current) => ({
                          ...current,
                          [mealStateKey]: !isDone,
                        }));
                      }}
                      className={cn(
                        "flex-1 rounded-[16px] border px-3 py-3 text-sm font-black transition",
                        isDone
                          ? "border-emerald-300/25 bg-emerald-300/15 text-emerald-50"
                          : "border-amber-300/20 bg-amber-300/10 text-amber-100 hover:bg-amber-300/15",
                      )}
                    >
                      {isDone ? t("nutritionDietWeeklyPreview.mealAction.done") : t("nutritionDietWeeklyPreview.mealAction.eat")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setChangeMealTarget({
                          day: selectedDayName,
                          mealKey: meal.key,
                          mealTitle,
                          currentDescription: displayedDescription,
                          alternatives: meal.alternativeKeys.map((key) => t(key)),
                        });
                      }}
                      className="flex-1 rounded-[16px] border border-white/10 bg-white/[0.05] px-3 py-3 text-sm font-black text-slate-200 transition hover:bg-white/[0.08]"
                    >
                      {t("nutritionDietWeeklyPreview.mealAction.change")}
                    </button>
                  </div>
                  <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-black text-slate-200">
                    <CheckCircle2 className={cn("h-3.5 w-3.5", isDone ? "text-emerald-300" : "text-slate-400")} />
                    {isDone ? t("nutritionDietWeeklyPreview.mealStatus.done") : t("nutritionDietWeeklyPreview.mealStatus.planned")}
                  </div>
                </div>
              </div>
            </section>
          );
        })}

        <section className="grid gap-4">
          <div className="rounded-[28px] border border-violet-400/20 bg-violet-400/10 p-4 shadow-[0_28px_70px_-48px_rgba(167,139,250,0.5)]">
            <div className="flex items-center gap-2 text-sm font-black text-violet-100">
              <CalendarRange className="h-5 w-5 text-violet-300" />
              {t("nutritionDietWeeklyPreview.instructions.title")}
            </div>
            <div className="mt-4 space-y-2">
              <div className="rounded-[18px] border border-white/10 bg-white/[0.05] px-3 py-3 text-sm leading-7 text-white">
                {t("nutritionDietWeeklyPreview.instructions.weekOne")}
              </div>
              <div className="rounded-[18px] border border-white/10 bg-white/[0.05] px-3 py-3 text-sm leading-7 text-white">
                {t("nutritionDietWeeklyPreview.instructions.weekTwo")}
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-amber-400/20 bg-[linear-gradient(160deg,rgba(251,191,36,0.12),rgba(255,255,255,0.03))] p-4 shadow-[0_28px_70px_-48px_rgba(251,191,36,0.45)]">
            <div className="flex items-center gap-2 text-sm font-black text-amber-100">
              <BadgeCheck className="h-5 w-5 text-amber-300" />
              {t("nutritionDietWeeklyPreview.notes.title")}
            </div>
            <div className="mt-4 space-y-2">
              {NOTE_KEYS.map((itemKey) => (
                <div key={itemKey} className="rounded-[18px] border border-white/10 bg-white/[0.05] px-3 py-3 text-sm leading-7 text-white">
                  {t(itemKey)}
                </div>
              ))}
            </div>
          </div>
        </section>

        <NutritionAudioGuidance
          title={t("nutritionDietWeeklyPreview.audio.title")}
          description={t("nutritionDietWeeklyPreview.audio.description")}
          tracks={audioTracks}
          accent="amber"
        />

        <Button
          type="button"
          className="h-14 w-full rounded-[20px] bg-[linear-gradient(135deg,#f59e0b,#fbbf24)] font-black text-slate-950 shadow-[0_25px_60px_-28px_rgba(245,158,11,0.92)] hover:opacity-95"
        >
          {t("nutritionDietWeeklyPreview.downloadPdf")}
          <Download className="ms-2 h-5 w-5" />
        </Button>
      </div>

      <Sheet open={Boolean(changeMealTarget)} onOpenChange={(open) => !open && setChangeMealTarget(null)}>
        <SheetContent
          side="bottom"
          dir={dir}
          className="h-[82vh] rounded-t-[28px] border-white/10 bg-[linear-gradient(180deg,rgba(9,18,30,0.98),rgba(6,19,29,1))] px-0 pb-safe"
        >
          {changeMealTarget ? (
            <div className="flex h-full min-h-0 flex-col">
              <div className="mx-auto mt-2 h-1.5 w-16 rounded-full bg-white/15" />
              <SheetHeader className="px-5 pt-4 text-start">
                <SheetTitle className="text-start text-white">{t("nutritionDietWeeklyPreview.sheet.title", { meal: changeMealTarget.mealTitle })}</SheetTitle>
                <SheetDescription className="text-start leading-7 text-slate-300">
                  {t("nutritionDietWeeklyPreview.sheet.description", { day: changeMealTarget.day })}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-4 px-5">
                <div className="rounded-[22px] border border-white/10 bg-white/[0.05] p-4">
                  <div className="text-[11px] font-bold text-slate-400">{t("nutritionDietWeeklyPreview.sheet.currentFood")}</div>
                  <div className="mt-2 text-sm font-bold leading-7 text-white">{changeMealTarget.currentDescription}</div>
                </div>
              </div>

              <div className="mt-4 min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6 [-webkit-overflow-scrolling:touch]">
                <div className="space-y-3">
                  {changeMealTarget.alternatives.map((option, index) => {
                    const targetKey = `${changeMealTarget.day}-${changeMealTarget.mealKey}`;
                    const selected = mealOverrides[targetKey] === option;

                    return (
                      <button
                        key={`${changeMealTarget.mealKey}-${index}`}
                        type="button"
                        onClick={() => {
                          setMealOverrides((current) => ({
                            ...current,
                            [targetKey]: option,
                          }));
                          setChangeMealTarget(null);
                        }}
                        className={cn(
                          "w-full rounded-[22px] border px-4 py-4 text-start transition",
                          selected
                            ? "border-emerald-300/30 bg-emerald-300/12 text-white"
                            : "border-white/10 bg-white/[0.04] text-slate-100 hover:bg-white/[0.08]",
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-2">
                            <div className="text-sm font-black leading-7">{option}</div>
                            <div className="text-[11px] leading-6 text-slate-400">
                              {t("nutritionDietWeeklyPreview.sheet.alternativeLabel", { index: format.number(index + 1), meal: changeMealTarget.mealTitle })}
                            </div>
                          </div>
                          <div
                            className={cn(
                              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition",
                              selected
                                ? "border-emerald-300/30 bg-emerald-300/15 text-emerald-100"
                                : "border-white/10 bg-white/[0.05] text-slate-300",
                            )}
                          >
                            {selected ? <CheckCircle2 className="h-4 w-4" /> : <RefreshCcw className="h-4 w-4" />}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
