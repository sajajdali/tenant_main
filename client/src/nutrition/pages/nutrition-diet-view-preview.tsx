import { useMemo, useState } from "react";
import {
  BadgeCheck,
  CheckCircle2,
  Clock3,
  Droplets,
  Download,
  FileText,
  MoonStar,
  Pill,
  Salad,
  Sparkles,
  Sun,
  Sunset,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NutritionAudioGuidance, type NutritionAudioTrack } from "@/nutrition/components/nutrition-audio-guidance";
import { NutritionTopbar } from "@/nutrition/components/nutrition-topbar";
import { cn } from "@/lib/utils";
import { useFormat, useLocale, useT } from "@/i18n/locale";
import type { MessageKey } from "@/i18n/messages";

type MealGroup = {
  key: string;
  titleKey: MessageKey;
  subtitleKey: MessageKey;
  icon: typeof Sun;
  accent: string;
  itemKeys: MessageKey[];
};

const DIET_META = {
  dietNumber: 1042,
  startedAt: "2026-04-09",
  endsAt: "2026-05-10",
  currentWeight: 81,
  targetDeltaKey: "nutritionDietViewPreview.meta.targetDelta" as MessageKey,
  templateKey: "nutritionDietViewPreview.meta.template" as MessageKey,
  todayFocusKey: "nutritionDietViewPreview.meta.todayFocus" as MessageKey,
};

const MEAL_GROUPS: MealGroup[] = [
  {
    key: "breakfast",
    titleKey: "nutritionDietViewPreview.meals.breakfast.title",
    subtitleKey: "nutritionDietViewPreview.meals.breakfast.subtitle",
    icon: Sun,
    accent: "from-amber-300/20 via-amber-200/10 to-transparent",
    itemKeys: [
      "nutritionDietViewPreview.meals.breakfast.items.1",
      "nutritionDietViewPreview.meals.breakfast.items.2",
      "nutritionDietViewPreview.meals.breakfast.items.3",
      "nutritionDietViewPreview.meals.breakfast.items.4",
      "nutritionDietViewPreview.meals.breakfast.items.5",
    ],
  },
  {
    key: "morning-snack",
    titleKey: "nutritionDietViewPreview.meals.morningSnack.title",
    subtitleKey: "nutritionDietViewPreview.meals.morningSnack.subtitle",
    icon: Sparkles,
    accent: "from-sky-300/20 via-sky-200/10 to-transparent",
    itemKeys: [
      "nutritionDietViewPreview.meals.morningSnack.items.1",
      "nutritionDietViewPreview.meals.morningSnack.items.2",
      "nutritionDietViewPreview.meals.morningSnack.items.3",
      "nutritionDietViewPreview.meals.morningSnack.items.4",
    ],
  },
  {
    key: "lunch",
    titleKey: "nutritionDietViewPreview.meals.lunch.title",
    subtitleKey: "nutritionDietViewPreview.meals.lunch.subtitle",
    icon: Salad,
    accent: "from-emerald-300/20 via-emerald-200/10 to-transparent",
    itemKeys: [
      "nutritionDietViewPreview.meals.lunch.items.1",
      "nutritionDietViewPreview.meals.lunch.items.2",
      "nutritionDietViewPreview.meals.lunch.items.3",
      "nutritionDietViewPreview.meals.lunch.items.4",
      "nutritionDietViewPreview.meals.lunch.items.5",
      "nutritionDietViewPreview.meals.lunch.items.6",
      "nutritionDietViewPreview.meals.lunch.items.7",
      "nutritionDietViewPreview.meals.lunch.items.8",
      "nutritionDietViewPreview.meals.lunch.items.9",
      "nutritionDietViewPreview.meals.lunch.items.10",
    ],
  },
  {
    key: "evening-snack",
    titleKey: "nutritionDietViewPreview.meals.eveningSnack.title",
    subtitleKey: "nutritionDietViewPreview.meals.eveningSnack.subtitle",
    icon: Sunset,
    accent: "from-orange-300/20 via-orange-200/10 to-transparent",
    itemKeys: [
      "nutritionDietViewPreview.meals.eveningSnack.items.1",
      "nutritionDietViewPreview.meals.eveningSnack.items.2",
      "nutritionDietViewPreview.meals.eveningSnack.items.3",
      "nutritionDietViewPreview.meals.eveningSnack.items.4",
      "nutritionDietViewPreview.meals.eveningSnack.items.5",
    ],
  },
  {
    key: "dinner",
    titleKey: "nutritionDietViewPreview.meals.dinner.title",
    subtitleKey: "nutritionDietViewPreview.meals.dinner.subtitle",
    icon: MoonStar,
    accent: "from-violet-300/20 via-violet-200/10 to-transparent",
    itemKeys: [
      "nutritionDietViewPreview.meals.dinner.items.1",
      "nutritionDietViewPreview.meals.dinner.items.2",
      "nutritionDietViewPreview.meals.dinner.items.3",
      "nutritionDietViewPreview.meals.dinner.items.4",
      "nutritionDietViewPreview.meals.dinner.items.5",
      "nutritionDietViewPreview.meals.dinner.items.6",
      "nutritionDietViewPreview.meals.dinner.items.7",
      "nutritionDietViewPreview.meals.dinner.items.8",
    ],
  },
];

const SUPPLEMENT_KEYS: MessageKey[] = [
  "nutritionDietViewPreview.supplements.omega3",
  "nutritionDietViewPreview.supplements.vitaminD",
  "nutritionDietViewPreview.supplements.magnesium",
];

const WATER_TARGET_GLASSES = 10;

const NOTE_KEYS: MessageKey[] = [
  "nutritionDietViewPreview.notes.1",
  "nutritionDietViewPreview.notes.2",
  "nutritionDietViewPreview.notes.3",
  "nutritionDietViewPreview.notes.4",
];

const AUDIO_TRACK_DEFS: Array<NutritionAudioTrack & { titleKey: MessageKey; descriptionKey: MessageKey }> = [
  { id: "diet-flex-1", title: "", description: "", titleKey: "nutritionDietViewPreview.audio.flex1.title", descriptionKey: "nutritionDietViewPreview.audio.flex1.description", duration: "01:55", url: "https://samplelib.com/lib/preview/mp3/sample-3s.mp3" },
  { id: "diet-flex-2", title: "", description: "", titleKey: "nutritionDietViewPreview.audio.flex2.title", descriptionKey: "nutritionDietViewPreview.audio.flex2.description", duration: "02:10", url: "https://samplelib.com/lib/preview/mp3/sample-6s.mp3" },
  { id: "diet-flex-3", title: "", description: "", titleKey: "nutritionDietViewPreview.audio.flex3.title", descriptionKey: "nutritionDietViewPreview.audio.flex3.description", duration: "01:40", url: "https://samplelib.com/lib/preview/mp3/sample-9s.mp3" },
];

export default function NutritionDietViewPreviewPage() {
  const t = useT();
  const format = useFormat();
  const { dir } = useLocale();
  const [selectedDay, setSelectedDay] = useState(1);
  const [completedItems, setCompletedItems] = useState<Record<string, number>>({});
  const [waterProgress, setWaterProgress] = useState<Record<number, number>>({});
  const [completedSupplements, setCompletedSupplements] = useState<Record<string, boolean>>({});
  const [selectedMeal, setSelectedMeal] = useState<{ mealKey: string; mealTitle: string; itemTitle: string; itemIndex: number } | null>(null);
  const dayNumbers = useMemo(() => Array.from({ length: 30 }, (_, index) => index + 1), []);
  const totalMeals = useMemo(
    () => MEAL_GROUPS.length,
    [],
  );

  const completedCount = useMemo(
    () => Object.keys(completedItems).filter((key) => key.startsWith(`day-${selectedDay}-`)).length,
    [completedItems, selectedDay],
  );

  const completionPercent = totalMeals > 0 ? Math.round((completedCount / totalMeals) * 100) : 0;
  const consumedWaterGlasses = waterProgress[selectedDay] ?? 0;
  const remainingWaterGlasses = Math.max(WATER_TARGET_GLASSES - consumedWaterGlasses, 0);
  const waterPercent = Math.round((consumedWaterGlasses / WATER_TARGET_GLASSES) * 100);
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
        <NutritionTopbar backHref="/nutrition/profile" title={t("nutritionDietViewPreview.topbarTitle")} description={t("nutritionDietViewPreview.topbarDescription")} />

        <section className="rounded-[32px] border border-white/10 bg-[linear-gradient(165deg,rgba(16,29,45,0.96),rgba(9,18,30,0.92))] p-4 shadow-[0_35px_90px_-52px_rgba(0,0,0,0.95)]">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-bold text-white/80">
                <FileText className="h-3.5 w-3.5 text-amber-300" />
                {t("nutritionDietViewPreview.badge")}
              </div>
              <h1 className="text-[28px] font-black leading-tight">{t("nutritionDietViewPreview.title", { day: format.number(selectedDay) })}</h1>
              <p className="text-sm leading-7 text-slate-300">
                {t("nutritionDietViewPreview.description")}
              </p>
            </div>

            <div className="rounded-[22px] border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-center">
              <div className="text-[11px] font-bold text-emerald-200">{t("nutritionDietViewPreview.todayLog")}</div>
              <div className="mt-1 text-lg font-black text-emerald-300">{format.number(completedCount)}</div>
              <div className="text-[10px] text-emerald-100/80">{t("nutritionDietViewPreview.mealsTotal", { total: format.number(totalMeals) })}</div>
            </div>
          </div>

          <div className="mt-4 rounded-[24px] border border-white/10 bg-white/[0.04] p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-bold text-slate-400">{t("nutritionDietViewPreview.selectDay")}</div>
                <div className="mt-1 text-sm font-bold text-white">{t("nutritionDietViewPreview.dayProgress", { day: format.number(selectedDay), total: format.number(30) })}</div>
              </div>
              <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-bold text-slate-300">
                <Clock3 className="h-3.5 w-3.5 text-amber-300" />
                {t("nutritionDietViewPreview.monthlyProgram")}
              </div>
            </div>

            <div className="mt-3 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {dayNumbers.map((day) => {
                const active = day === selectedDay;
                const dayCompletedCount = Object.keys(completedItems).filter((key) => key.startsWith(`day-${day}-`)).length;

                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setSelectedDay(day)}
                    className={cn(
                      "min-w-[72px] rounded-[20px] border px-3 py-3 text-center transition",
                      active
                        ? "border-amber-300/40 bg-[linear-gradient(180deg,rgba(251,191,36,0.22),rgba(251,191,36,0.1))] text-white shadow-[0_18px_45px_-28px_rgba(251,191,36,0.85)]"
                        : "border-white/10 bg-white/[0.03] text-slate-300",
                    )}
                  >
                    <div className="text-[10px] font-bold text-slate-400">{t("nutritionDietViewPreview.dayLabel")}</div>
                    <div className="mt-1 text-base font-black">{format.number(day)}</div>
                    <div className={cn("mt-1 text-[10px] font-bold", active ? "text-amber-100" : "text-slate-500")}>
                      {t("nutritionDietViewPreview.loggedMealsCount", { count: format.number(dayCompletedCount) })}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4 rounded-[24px] border border-white/10 bg-white/[0.04] p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-bold text-slate-400">{t("nutritionDietViewPreview.todayStatus")}</div>
                <div className="mt-1 text-sm font-bold text-white">{t(DIET_META.todayFocusKey)}</div>
              </div>
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black text-amber-200">
                {t("nutritionDietViewPreview.completionPercent", { percent: format.number(completionPercent) })}
              </div>
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#10b981,#34d399,#fbbf24)] transition-all"
                style={{ width: `${completionPercent}%` }}
              />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-[20px] border border-white/10 bg-white/[0.04] px-3 py-3">
              <div className="text-[10px] font-bold text-slate-400">{t("nutritionDietViewPreview.meta.dietNumber")}</div>
              <div className="mt-2 text-sm font-black">{format.number(DIET_META.dietNumber)}</div>
            </div>
            <div className="rounded-[20px] border border-white/10 bg-white/[0.04] px-3 py-3">
              <div className="text-[10px] font-bold text-slate-400">{t("nutritionDietViewPreview.meta.startEnd")}</div>
              <div className="mt-2 text-[11px] font-black leading-5">{format.date(DIET_META.startedAt)}</div>
              <div className="text-[11px] text-slate-400">{format.date(DIET_META.endsAt)}</div>
            </div>
            <div className="rounded-[20px] border border-white/10 bg-white/[0.04] px-3 py-3">
              <div className="text-[10px] font-bold text-slate-400">{t("nutritionDietViewPreview.meta.currentWeight")}</div>
              <div className="mt-2 text-sm font-black">{t("nutritionDietViewPreview.kgValue", { value: format.number(DIET_META.currentWeight) })}</div>
            </div>
            <div className="rounded-[20px] border border-white/10 bg-white/[0.04] px-3 py-3">
              <div className="text-[10px] font-bold text-slate-400">{t("nutritionDietViewPreview.meta.weightStatus")}</div>
              <div className="mt-2 text-[11px] font-black leading-5">{t(DIET_META.targetDeltaKey, { count: format.number(6) })}</div>
            </div>
            <div className="col-span-2 rounded-[20px] border border-white/10 bg-white/[0.04] px-3 py-3">
              <div className="text-[10px] font-bold text-slate-400">{t("nutritionDietViewPreview.meta.selectedTemplate")}</div>
              <div className="mt-2 text-sm font-black">{t(DIET_META.templateKey)}</div>
            </div>
          </div>
        </section>

        {MEAL_GROUPS.map((meal) => {
          const Icon = meal.icon;

          return (
            <section
              key={meal.key}
              className="overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(160deg,rgba(18,34,49,0.95),rgba(11,22,35,0.9))] shadow-[0_30px_80px_-45px_rgba(0,0,0,0.9)]"
            >
              <div className={cn("relative p-4", `bg-gradient-to-l ${meal.accent}`)}>
                <div className="absolute inset-0 opacity-40 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
                <div className="relative flex items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="text-xl font-black">{t(meal.titleKey)}</div>
                      <div className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[10px] font-black text-slate-200">
                        {t("nutritionDietViewPreview.choiceCount", { count: format.number(meal.itemKeys.length) })}
                      </div>
                    </div>
                    <div className="text-xs leading-6 text-slate-300">{t(meal.subtitleKey)}</div>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-[18px] border border-white/10 bg-white/10 text-amber-300">
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
              </div>

              <div className="space-y-3 p-4">
                {meal.itemKeys.map((itemKey, index) => {
                  const item = t(itemKey);
                  const dayMealKey = `day-${selectedDay}-${meal.key}`;
                  const selectedIndex = completedItems[dayMealKey];
                  const done = selectedIndex === index;
                  const mealHasSelection = typeof selectedIndex === "number";

                  return (
                    <div
                      key={`${meal.key}-${index}`}
                      className={cn(
                        "rounded-[22px] border px-4 py-4 transition",
                        done
                          ? "border-emerald-400/25 bg-emerald-400/10"
                          : mealHasSelection
                            ? "border-white/10 bg-white/[0.02] opacity-70"
                          : "border-white/10 bg-white/[0.03]",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-2">
                          <div className={cn("text-sm font-bold leading-7", done ? "text-emerald-100" : "text-white")}>
                            {`${format.number(index + 1)}. ${item}`}
                          </div>
                          <div className="text-[11px] leading-6 text-slate-400">
                            {t("nutritionDietViewPreview.mealItemHint")}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setSelectedMeal({ mealKey: meal.key, mealTitle: t(meal.titleKey), itemTitle: item, itemIndex: index })}
                          className={cn(
                            "shrink-0 rounded-full border px-3 py-2 text-[11px] font-black transition",
                            done
                              ? "border-emerald-300/25 bg-emerald-300/15 text-emerald-100"
                              : mealHasSelection
                                ? "border-white/10 bg-white/[0.04] text-slate-300"
                              : "border-amber-300/20 bg-amber-300/10 text-amber-200 hover:bg-amber-300/15",
                          )}
                        >
                          {done ? t("nutritionDietViewPreview.mealAction.done") : mealHasSelection ? t("nutritionDietViewPreview.mealAction.replace") : t("nutritionDietViewPreview.mealAction.eat")}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}

        <section className="grid gap-4">
          <div className="rounded-[28px] border border-cyan-400/20 bg-cyan-400/10 p-4 shadow-[0_28px_70px_-48px_rgba(34,211,238,0.65)]">
            <div className="flex items-center gap-2 text-sm font-black text-cyan-100">
              <Droplets className="h-5 w-5 text-cyan-300" />
              {t("nutritionDietViewPreview.water.title")}
            </div>
            <div className="mt-3 flex items-end justify-between gap-3">
              <div>
                <div className="text-2xl font-black text-white">{t("nutritionDietViewPreview.water.target", { count: format.number(WATER_TARGET_GLASSES) })}</div>
                <div className="mt-2 text-xs leading-7 text-cyan-100/80">
                  {t("nutritionDietViewPreview.water.summary", {
                    day: format.number(selectedDay),
                    consumed: format.number(consumedWaterGlasses),
                    remaining: format.number(remainingWaterGlasses),
                  })}
                </div>
              </div>
              <div className="rounded-[20px] border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-center">
                <div className="text-[11px] font-bold text-cyan-100">{t("nutritionDietViewPreview.water.completion")}</div>
                <div className="mt-1 text-lg font-black text-white">{t("nutritionDietViewPreview.percentValue", { percent: format.number(waterPercent) })}</div>
              </div>
            </div>

            <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#22d3ee,#38bdf8,#a5f3fc)] transition-all"
                style={{ width: `${Math.min(waterPercent, 100)}%` }}
              />
            </div>

            <div className="mt-4 grid grid-cols-5 gap-2">
              {Array.from({ length: WATER_TARGET_GLASSES }, (_, index) => {
                const glassNumber = index + 1;
                const active = glassNumber <= consumedWaterGlasses;

                return (
                  <button
                    key={glassNumber}
                    type="button"
                    onClick={() => {
                      setWaterProgress((current) => ({
                        ...current,
                        [selectedDay]: glassNumber,
                      }));
                    }}
                    className={cn(
                      "rounded-[18px] border px-2 py-3 text-center transition",
                      active
                        ? "border-cyan-300/30 bg-cyan-300/15 text-white"
                        : "border-white/10 bg-white/[0.04] text-cyan-100/80",
                    )}
                  >
                    <Droplets className={cn("mx-auto h-4 w-4", active ? "text-cyan-200" : "text-cyan-300/60")} />
                    <div className="mt-1 text-[11px] font-black">{format.number(glassNumber)}</div>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 rounded-[18px] border-cyan-300/20 bg-white/5 text-cyan-100 hover:bg-white/10"
                onClick={() => {
                  setWaterProgress((current) => ({
                    ...current,
                    [selectedDay]: Math.min((current[selectedDay] ?? 0) + 1, WATER_TARGET_GLASSES),
                  }));
                }}
              >
                {t("nutritionDietViewPreview.water.addGlass")}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-[18px] border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                onClick={() => {
                  setWaterProgress((current) => ({
                    ...current,
                    [selectedDay]: 0,
                  }));
                }}
              >
                {t("nutritionDietViewPreview.water.clear")}
              </Button>
            </div>
          </div>

          <div className="rounded-[28px] border border-violet-400/20 bg-violet-400/10 p-4 shadow-[0_28px_70px_-48px_rgba(167,139,250,0.5)]">
            <div className="flex items-center gap-2 text-sm font-black text-violet-100">
              <Pill className="h-5 w-5 text-violet-300" />
              {t("nutritionDietViewPreview.supplements.title")}
            </div>
            <div className="mt-4 space-y-2">
              {SUPPLEMENT_KEYS.map((supplementKey, index) => {
                const item = t(supplementKey);
                const completionKey = `day-${selectedDay}-supplement-${index}`;
                const isDone = completedSupplements[completionKey] === true;

                return (
                  <button
                    key={supplementKey}
                    type="button"
                    onClick={() => {
                      setCompletedSupplements((current) => ({
                        ...current,
                        [completionKey]: !isDone,
                      }));
                    }}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-[18px] border px-3 py-3 text-start text-sm leading-7 transition",
                      isDone
                        ? "border-emerald-400/25 bg-emerald-400/12 text-white"
                        : "border-white/10 bg-white/[0.05] text-white hover:bg-white/[0.08]",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-full border transition",
                          isDone
                            ? "border-emerald-300/30 bg-emerald-300/15 text-emerald-100"
                            : "border-violet-300/20 bg-violet-300/10 text-violet-200",
                        )}
                      >
                        {isDone ? <CheckCircle2 className="h-4 w-4" /> : <Pill className="h-4 w-4" />}
                      </div>
                      <span>{item}</span>
                    </div>
                    <div
                      className={cn(
                        "rounded-full border px-3 py-1 text-[11px] font-black transition",
                        isDone
                          ? "border-emerald-300/25 bg-emerald-300/15 text-emerald-100"
                          : "border-white/10 bg-white/5 text-violet-100",
                      )}
                    >
                      {isDone ? t("nutritionDietViewPreview.supplements.done") : t("nutritionDietViewPreview.supplements.log")}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-[28px] border border-amber-400/20 bg-[linear-gradient(160deg,rgba(251,191,36,0.12),rgba(255,255,255,0.03))] p-4 shadow-[0_28px_70px_-48px_rgba(251,191,36,0.45)]">
            <div className="flex items-center gap-2 text-sm font-black text-amber-100">
              <BadgeCheck className="h-5 w-5 text-amber-300" />
              {t("nutritionDietViewPreview.notes.title")}
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
          title={t("nutritionDietViewPreview.audio.title")}
          description={t("nutritionDietViewPreview.audio.description")}
          tracks={audioTracks}
          accent="cyan"
        />

        <Button
          type="button"
          className="h-14 w-full rounded-[20px] bg-[linear-gradient(135deg,#f59e0b,#fbbf24)] font-black text-slate-950 shadow-[0_25px_60px_-28px_rgba(245,158,11,0.92)] hover:opacity-95"
        >
          {t("nutritionDietViewPreview.downloadPdf")}
          <Download className="ms-2 h-5 w-5" />
        </Button>
      </div>

      <Dialog open={Boolean(selectedMeal)} onOpenChange={(open) => !open && setSelectedMeal(null)}>
        <DialogContent dir={dir} className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              {t("nutritionDietViewPreview.dialog.title")}
            </DialogTitle>
            <DialogDescription className="leading-8">
              {t("nutritionDietViewPreview.dialog.description")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 rounded-[20px] border border-border/70 bg-background/40 p-4 text-start">
            <div className="text-xs font-bold text-muted-foreground">{t("nutritionDietViewPreview.dialog.selectedDay")}</div>
            <div className="font-black">{t("nutritionDietViewPreview.dayValue", { day: format.number(selectedDay) })}</div>
            <div className="text-xs font-bold text-muted-foreground">{t("nutritionDietViewPreview.dialog.meal")}</div>
            <div className="font-black">{selectedMeal?.mealTitle}</div>
            <div className="text-xs font-bold text-muted-foreground">{t("nutritionDietViewPreview.dialog.selectedItem")}</div>
            <div className="text-sm leading-7">{selectedMeal?.itemTitle}</div>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              className="flex-1 rounded-2xl"
              onClick={() => {
                if (selectedMeal) {
                  setCompletedItems((current) => ({
                    ...current,
                    [`day-${selectedDay}-${selectedMeal.mealKey}`]: selectedMeal.itemIndex,
                  }));
                }
                setSelectedMeal(null);
              }}
            >
              {t("nutritionDietViewPreview.dialog.confirm")}
            </Button>
            <Button type="button" variant="outline" className="flex-1 rounded-2xl" onClick={() => setSelectedMeal(null)}>
              {t("common.close")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
