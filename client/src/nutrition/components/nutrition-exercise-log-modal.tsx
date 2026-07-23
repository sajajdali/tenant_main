import { useEffect, useMemo, useState } from "react";
import { Check, Flame, Loader2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useFormat, useLocale, useT } from "@/i18n/locale";
import type { NutritionExerciseItem } from "@/lib/types";
import { estimateExerciseCalories, getNutritionExerciseIcon } from "@/nutrition/lib/exercise-helpers";
import { cn } from "@/lib/utils";

type ExerciseDraft = {
  intensity: "light" | "moderate" | "vigorous";
  durationMinutes: string;
  distanceKm: string;
  speedKmh: string;
  notes: string;
};

const EMPTY_DRAFT: ExerciseDraft = {
  intensity: "moderate",
  durationMinutes: "20",
  distanceKm: "",
  speedKmh: "",
  notes: "",
};

const INTENSITY_OPTIONS = ["light", "moderate", "vigorous"] as const;

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <Label className="text-[11px] font-black text-slate-300">{children}</Label>;
}

export function NutritionExerciseLogModal({
  open,
  onOpenChange,
  exercise,
  activeDate,
  initialWeightKg,
  targetCalories,
  saving,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exercise: NutritionExerciseItem | null;
  activeDate: string;
  initialWeightKg?: number | null;
  targetCalories?: number;
  saving?: boolean;
  onSubmit: (payload: {
    exerciseRef: string;
    intensity: "light" | "moderate" | "vigorous";
    durationMinutes: number;
    distanceKm?: number | null;
    speedKmh?: number | null;
    weightKg: number;
    notes?: string;
  }) => Promise<void> | void;
}) {
  const { dir } = useLocale();
  const t = useT();
  const format = useFormat();
  const [draft, setDraft] = useState<ExerciseDraft>(EMPTY_DRAFT);
  const resolvedWeightKg = Number(initialWeightKg ?? 0);
  const resolvedTargetCalories = Number(targetCalories ?? 0);

  const suggestedDurationMinutes = useMemo(() => {
    if (!exercise || resolvedTargetCalories <= 0 || resolvedWeightKg <= 0) {
      return 0;
    }

    const caloriesPerMinute = estimateExerciseCalories(exercise, {
      intensity: (exercise.defaultIntensity as "light" | "moderate" | "vigorous") || "moderate",
      durationMinutes: 1,
      weightKg: resolvedWeightKg,
    });

    if (caloriesPerMinute <= 0) {
      return 0;
    }

    return Math.max(1, Math.ceil(resolvedTargetCalories / caloriesPerMinute));
  }, [exercise, resolvedTargetCalories, resolvedWeightKg]);

  const hasRemainingTargetCalories = resolvedTargetCalories > 0;

  useEffect(() => {
    if (!open) {
      return;
    }

    setDraft({
      ...EMPTY_DRAFT,
      intensity: (exercise?.defaultIntensity as "light" | "moderate" | "vigorous") || "moderate",
      durationMinutes: suggestedDurationMinutes > 0 ? String(suggestedDurationMinutes) : EMPTY_DRAFT.durationMinutes,
    });
  }, [exercise, open, suggestedDurationMinutes]);

  const estimatedCalories = useMemo(() => estimateExerciseCalories(exercise, {
    intensity: draft.intensity,
    durationMinutes: Number(draft.durationMinutes || 0),
    distanceKm: draft.distanceKm ? Number(draft.distanceKm) : null,
    speedKmh: draft.speedKmh ? Number(draft.speedKmh) : null,
    weightKg: resolvedWeightKg,
  }), [draft.distanceKm, draft.durationMinutes, draft.intensity, draft.speedKmh, exercise, resolvedWeightKg]);

  const recommendationText = hasRemainingTargetCalories
    ? suggestedDurationMinutes > 0 && exercise
      ? t("nutritionExerciseLog.recommendation.suggested", {
        calories: format.number(resolvedTargetCalories),
        duration: format.number(suggestedDurationMinutes),
        exercise: exercise.title,
      })
      : t("nutritionExerciseLog.recommendation.target", { calories: format.number(resolvedTargetCalories) })
    : t("nutritionExerciseLog.recommendation.default");
  const displayDate = activeDate ? format.date(activeDate) : t("nutritionExerciseLog.selectedDate");
  const selectedIntensityLabel = t(`nutritionExerciseLog.intensity.${draft.intensity}`);

  const submit = async () => {
    if (!exercise) {
      return;
    }

    await onSubmit({
      exerciseRef: exercise.id,
      intensity: draft.intensity,
      durationMinutes: Number(draft.durationMinutes || 0),
      distanceKm: exercise.supportsDistance && draft.distanceKm ? Number(draft.distanceKm) : null,
      speedKmh: exercise.supportsSpeed && draft.speedKmh ? Number(draft.speedKmh) : null,
      weightKg: resolvedWeightKg,
      notes: draft.notes.trim() || undefined,
    });
  };

  const ExerciseIcon = getNutritionExerciseIcon(exercise?.iconKey);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir={dir}
        className="fixed bottom-0 top-auto max-h-[88vh] w-[calc(100%-32px)] max-w-[390px] translate-y-0 gap-0 overflow-hidden rounded-t-[22px] border border-white/10 bg-[#111620] p-0 text-white shadow-[0_-20px_80px_-54px_rgba(16,185,129,0.45)] data-[state=closed]:slide-out-to-bottom-full data-[state=open]:slide-in-from-bottom-full sm:bottom-auto sm:top-[50%] sm:max-h-[86vh] sm:translate-y-[-50%] sm:rounded-[22px] [&>button]:hidden"
      >
        <div className="flex max-h-[88vh] flex-col sm:max-h-[86vh]">
          <div className="flex justify-center pt-3">
            <span className="h-1 w-11 rounded-full bg-white/20" />
          </div>

          <div className="shrink-0 px-4 pb-2.5 pt-3.5">
            <DialogHeader className="space-y-2 text-start">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 pt-0.5">
                  <DialogTitle className="flex items-center justify-start gap-2 text-[18px] font-black leading-7 text-white">
                    <Sparkles className="h-4.5 w-4.5 shrink-0 text-emerald-300" />
                    <span>{exercise ? t("nutritionExerciseLog.titleWithExercise", { exercise: exercise.title }) : t("nutritionExerciseDialog.submit")}</span>
                  </DialogTitle>
                  <DialogDescription className="mx-auto mt-2 max-w-[320px] text-center text-[11px] font-semibold leading-5 text-slate-400">
                    {t("nutritionExerciseLog.description", { date: displayDate, recommendation: recommendationText })}
                  </DialogDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={t("common.close")}
                  onClick={() => onOpenChange(false)}
                  className="h-10 w-10 shrink-0 rounded-full border-white/10 bg-white/[0.055] text-slate-200 hover:bg-white/[0.09] hover:text-white"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </DialogHeader>
          </div>

          {exercise ? (
            <div className="pretty-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-20 pt-1 [-webkit-overflow-scrolling:touch] [scrollbar-color:rgba(52,211,153,0.45)_rgba(255,255,255,0.08)] [scrollbar-width:thin]">
              <div className="space-y-2.5">
                <div className="rounded-[16px] border border-emerald-400/25 bg-[linear-gradient(145deg,rgba(16,185,129,0.13),rgba(10,43,39,0.72))] p-3">
                  <div className="flex items-center justify-between gap-2.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-emerald-400/16 text-emerald-300">
                      <ExerciseIcon className="h-5 w-5" />
                    </div>
                    <div className="text-start">
                      <div className="text-[11px] font-black leading-4 text-emerald-300">{exercise.groupTitle}</div>
                      <div className="mt-0.5 text-[15px] font-black leading-6 text-white">{exercise.title}</div>
                      <div className="mt-1 text-[10px] font-semibold leading-4 text-slate-400">{exercise.description || t("nutritionExerciseLog.detailsFallback")}</div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <FieldLabel>{t("nutritionExerciseLog.durationLabel")}</FieldLabel>
                    <Input
                      dir="ltr"
                      value={draft.durationMinutes}
                      onChange={(event) => setDraft((current) => ({ ...current, durationMinutes: event.target.value }))}
                      className="h-10 rounded-[13px] border-2 border-emerald-400/65 bg-white/[0.045] text-center text-[14px] font-black text-white focus-visible:ring-emerald-400/40"
                      inputMode="numeric"
                      placeholder={t("nutritionExerciseDialog.durationPlaceholder")}
                    />
                  </div>
                  <div className="grid gap-2">
                    <FieldLabel>{t("nutritionExerciseLog.weightLabel")}</FieldLabel>
                    <Input
                      dir="ltr"
                      value={resolvedWeightKg > 0 ? String(resolvedWeightKg) : ""}
                      readOnly
                      disabled
                      className="h-10 rounded-[13px] border-2 border-white/10 bg-white/[0.045] text-center text-[14px] font-black text-white opacity-100 disabled:cursor-not-allowed disabled:opacity-100"
                      placeholder={t("nutritionExerciseLog.notRecorded")}
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <FieldLabel>{t("nutritionExerciseDialog.intensityLabel")}</FieldLabel>
                  <div className="grid grid-cols-3 gap-2.5">
                    {INTENSITY_OPTIONS.map((intensity) => {
                      const selected = draft.intensity === intensity;

                      return (
                        <button
                          key={intensity}
                          type="button"
                          onClick={() => setDraft((current) => ({ ...current, intensity }))}
                          className={cn(
                            "h-10 rounded-[13px] border-2 text-[12px] font-black transition",
                            selected
                              ? "border-emerald-300 bg-emerald-400/10 text-emerald-300"
                              : "border-white/10 bg-white/[0.045] text-slate-400 hover:bg-white/[0.075]",
                          )}
                        >
                          {t(`nutritionExerciseLog.intensity.${intensity}`)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <FieldLabel>{t("nutritionExerciseDialog.distanceLabel")}</FieldLabel>
                    <Input
                      dir="ltr"
                      value={draft.distanceKm}
                      onChange={(event) => setDraft((current) => ({ ...current, distanceKm: event.target.value }))}
                      className="h-10 rounded-[13px] border-2 border-white/10 bg-white/[0.045] text-center text-[13px] font-black text-white placeholder:text-slate-500 focus-visible:ring-emerald-400/35"
                      inputMode="decimal"
                      placeholder={exercise.supportsDistance ? t("nutritionExerciseDialog.distancePlaceholder") : t("nutritionExerciseLog.optional")}
                    />
                  </div>
                  <div className="grid gap-2">
                    <FieldLabel>{t("nutritionExerciseDialog.speedLabel")}</FieldLabel>
                    <Input
                      dir="ltr"
                      value={draft.speedKmh}
                      onChange={(event) => setDraft((current) => ({ ...current, speedKmh: event.target.value }))}
                      className="h-10 rounded-[13px] border-2 border-white/10 bg-white/[0.045] text-center text-[13px] font-black text-white placeholder:text-slate-500 focus-visible:ring-emerald-400/35"
                      inputMode="decimal"
                      placeholder={exercise.supportsSpeed ? t("nutritionExerciseDialog.speedPlaceholder") : t("nutritionExerciseLog.optional")}
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <FieldLabel>{t("nutritionExerciseDialog.notesLabel")}</FieldLabel>
                  <Textarea
                    value={draft.notes}
                    onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
                    className="min-h-[68px] rounded-[13px] border-2 border-white/10 bg-white/[0.045] p-3 text-[11px] font-bold leading-5 text-white placeholder:text-slate-500 focus-visible:ring-emerald-400/35"
                    placeholder={t("nutritionExerciseLog.notesPlaceholder")}
                  />
                </div>

                <div className="rounded-[14px] border border-amber-400/25 bg-[linear-gradient(145deg,rgba(245,158,11,0.12),rgba(42,30,19,0.72))] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="rounded-[11px] border border-amber-300/30 bg-amber-400/10 px-2.5 py-1.5 text-center text-amber-300">
                      <div className="text-[9px] font-black">{t("nutritionExerciseDialog.estimatedCalories")}</div>
                      <div className="text-[14px] font-black">{format.number(estimatedCalories)}</div>
                    </div>
                    <div className="flex items-center gap-1.5 text-[12px] font-black text-amber-200">
                      <span>{t("nutritionExerciseDialog.summaryTitle")}</span>
                      <Flame className="h-3.5 w-3.5 text-amber-300" />
                    </div>
                  </div>
                  <div className="mt-2 text-start text-[10px] font-semibold leading-4 text-amber-50/80">
                    {t("nutritionExerciseDialog.summaryMain", {
                      duration: format.number(Number(draft.durationMinutes || 0)),
                      exercise: exercise.title,
                      intensity: selectedIntensityLabel,
                    })}
                    {exercise.supportsSpeed && draft.speedKmh ? t("nutritionExerciseDialog.summarySpeed", { speed: format.number(Number(draft.speedKmh)) }) : ""}
                    {exercise.supportsDistance && draft.distanceKm ? t("nutritionExerciseDialog.summaryDistance", { distance: format.number(Number(draft.distanceKm)) }) : ""}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <DialogFooter className="absolute inset-x-0 bottom-0 flex-row items-center gap-2.5 border-t border-white/10 bg-[linear-gradient(180deg,rgba(17,22,32,0.86),#111620_38%)] px-4 py-3 backdrop-blur-xl sm:justify-between">
            <Button
              type="button"
              variant="outline"
              className="h-11 w-[92px] rounded-[14px] border-white/10 bg-white/[0.045] text-[12px] font-black text-white hover:bg-white/[0.08]"
              onClick={() => onOpenChange(false)}
            >
              {t("common.close")}
            </Button>
            <Button
              onClick={() => void submit()}
              disabled={saving || !exercise || Number(draft.durationMinutes || 0) <= 0 || resolvedWeightKg <= 0}
              className="h-11 flex-1 rounded-[14px] bg-emerald-400 text-[14px] font-black text-slate-950 hover:bg-emerald-300 disabled:opacity-60"
            >
              {saving ? <Loader2 className="me-2 h-3.5 w-3.5 animate-spin" /> : <Check className="me-2 h-4 w-4" />}
              {t("nutritionExerciseDialog.submit")}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
