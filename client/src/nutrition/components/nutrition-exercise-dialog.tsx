import { useEffect, useMemo, useState } from "react";
import { Flame, Loader2, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useFormat, useLocale, useT } from "@/i18n/locale";
import { cn } from "@/lib/utils";
import type { NutritionExerciseGroup, NutritionExerciseItem } from "@/lib/types";
import { estimateExerciseCalories, getNutritionExerciseIcon } from "@/nutrition/lib/exercise-helpers";

type ExerciseDraft = {
  exerciseId: string;
  intensity: "light" | "moderate" | "vigorous";
  durationMinutes: string;
  distanceKm: string;
  speedKmh: string;
  weightKg: string;
  notes: string;
};

const EMPTY_DRAFT: ExerciseDraft = {
  exerciseId: "",
  intensity: "moderate",
  durationMinutes: "20",
  distanceKm: "",
  speedKmh: "",
  weightKg: "",
  notes: "",
};

export function NutritionExerciseDialog({
  open,
  onOpenChange,
  groups,
  initialWeightKg,
  activeDate,
  targetCalories,
  saving,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: NutritionExerciseGroup[];
  initialWeightKg?: number | null;
  activeDate: string;
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
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<ExerciseDraft>(EMPTY_DRAFT);

  useEffect(() => {
    if (!open) {
      return;
    }

    setSearch("");
    setDraft((current) => ({
      ...EMPTY_DRAFT,
      exerciseId: current.exerciseId || groups[0]?.exercises[0]?.id || "",
      weightKg: initialWeightKg ? String(initialWeightKg) : current.weightKg,
    }));
  }, [groups, initialWeightKg, open]);

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

  const allExercises = useMemo(() => groups.flatMap((group) => group.exercises), [groups]);
  const selectedExercise = useMemo(
    () => allExercises.find((exercise) => exercise.id === draft.exerciseId) ?? filteredGroups[0]?.exercises[0] ?? groups[0]?.exercises[0] ?? null,
    [allExercises, draft.exerciseId, filteredGroups, groups],
  );

  useEffect(() => {
    if (selectedExercise && draft.exerciseId === "") {
      setDraft((current) => ({ ...current, exerciseId: selectedExercise.id }));
    }
  }, [draft.exerciseId, selectedExercise]);

  const estimatedCalories = useMemo(() => estimateExerciseCalories(selectedExercise, {
    intensity: draft.intensity,
    durationMinutes: Number(draft.durationMinutes || 0),
    distanceKm: draft.distanceKm ? Number(draft.distanceKm) : null,
    speedKmh: draft.speedKmh ? Number(draft.speedKmh) : null,
    weightKg: Number(draft.weightKg || 0),
  }), [draft.distanceKm, draft.durationMinutes, draft.intensity, draft.speedKmh, draft.weightKg, selectedExercise]);

  const recommendationText = targetCalories && targetCalories > 0
    ? t("nutritionExerciseDialog.recommendation.withTarget", { calories: format.number(targetCalories) })
    : t("nutritionExerciseDialog.recommendation.default");
  const intensityLabel = t(`nutritionExerciseDialog.intensity.${draft.intensity}`);

  const submit = async () => {
    if (!selectedExercise) {
      return;
    }

    await onSubmit({
      exerciseRef: selectedExercise.id,
      intensity: draft.intensity,
      durationMinutes: Number(draft.durationMinutes || 0),
      distanceKm: selectedExercise.supportsDistance && draft.distanceKm ? Number(draft.distanceKm) : null,
      speedKmh: selectedExercise.supportsSpeed && draft.speedKmh ? Number(draft.speedKmh) : null,
      weightKg: Number(draft.weightKg || 0),
      notes: draft.notes.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir={dir} className="border-white/10 bg-[#081521] text-white sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-start">
            <Sparkles className="h-5 w-5 text-emerald-300" />
            {t("nutritionExerciseDialog.title", { date: format.date(activeDate) })}
          </DialogTitle>
          <DialogDescription className="text-start leading-7 text-slate-300">{recommendationText}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 lg:grid-cols-[1.1fr,0.9fr]">
          <div className="space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("nutritionExerciseDialog.searchPlaceholder")} className="h-12 rounded-2xl border-white/10 bg-white/5 ps-11 text-white" />
            </div>
            <ScrollArea className="h-[420px] rounded-[28px] border border-white/10 bg-white/[0.03] p-4">
              <div className="space-y-5">
                {filteredGroups.map((group) => (
                  <section key={group.id} className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="text-sm font-black text-white">{group.title}</div>
                      <div className="h-px flex-1 bg-white/10" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {group.exercises.map((exercise) => {
                        const Icon = getNutritionExerciseIcon(exercise.iconKey);
                        const isActive = exercise.id === selectedExercise?.id;

                        return (
                          <button
                            key={exercise.id}
                            type="button"
                            onClick={() => setDraft((current) => ({ ...current, exerciseId: exercise.id, intensity: (exercise.defaultIntensity as "light" | "moderate" | "vigorous") || current.intensity }))}
                            className={cn(
                              "rounded-[24px] border p-4 text-start transition-all",
                              isActive
                                ? "border-emerald-300/45 bg-emerald-400/10 shadow-[0_20px_50px_-35px_rgba(16,185,129,0.55)]"
                                : "border-white/10 bg-white/[0.04] hover:bg-white/[0.08]",
                            )}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex h-12 w-12 items-center justify-center rounded-[18px] border border-white/10 bg-white/[0.06]">
                                <Icon className={cn("h-5 w-5", isActive ? "text-emerald-200" : "text-amber-300")} />
                              </div>
                              <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-1 text-[10px] font-bold text-slate-200">
                                {exercise.badgeText || group.title}
                              </span>
                            </div>
                            <div className="mt-3 text-sm font-black text-white">{exercise.title}</div>
                            <div className="mt-2 text-[11px] leading-6 text-slate-300">{exercise.description || t("nutritionExerciseDialog.exerciseFallbackDescription")}</div>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            </ScrollArea>
          </div>

          <div className="space-y-4 rounded-[28px] border border-white/10 bg-[linear-gradient(160deg,rgba(15,25,38,0.98),rgba(8,18,31,0.96))] p-4">
            {selectedExercise ? (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-emerald-200/75">{selectedExercise.groupTitle}</div>
                    <div className="mt-1 text-xl font-black text-white">{selectedExercise.title}</div>
                    <div className="mt-2 text-xs leading-6 text-slate-300">{selectedExercise.description}</div>
                  </div>
                  <div className="rounded-[20px] border border-white/10 bg-white/[0.05] px-3 py-2 text-center">
                    <div className="text-[10px] font-bold text-slate-400">{t("nutritionExerciseDialog.estimatedCalories")}</div>
                    <div className="mt-1 text-lg font-black text-amber-300">{format.number(estimatedCalories)}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>{t("nutritionExerciseDialog.durationLabel")}</Label>
                    <Input dir="ltr" value={draft.durationMinutes} onChange={(event) => setDraft((current) => ({ ...current, durationMinutes: event.target.value }))} className="rounded-2xl border-white/10 bg-white/5 text-start text-white" inputMode="numeric" placeholder={t("nutritionExerciseDialog.durationPlaceholder")} />
                  </div>
                  <div className="grid gap-2">
                    <Label>{t("nutritionExerciseDialog.weightLabel")}</Label>
                    <Input dir="ltr" value={draft.weightKg} onChange={(event) => setDraft((current) => ({ ...current, weightKg: event.target.value }))} className="rounded-2xl border-white/10 bg-white/5 text-start text-white" inputMode="decimal" placeholder={t("nutritionExerciseDialog.weightPlaceholder")} />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label>{t("nutritionExerciseDialog.intensityLabel")}</Label>
                  <Select value={draft.intensity} onValueChange={(value) => setDraft((current) => ({ ...current, intensity: value as "light" | "moderate" | "vigorous" }))}>
                    <SelectTrigger className="rounded-2xl border-white/10 bg-white/5 text-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">{t("nutritionExerciseDialog.intensity.light")}</SelectItem>
                      <SelectItem value="moderate">{t("nutritionExerciseDialog.intensity.moderate")}</SelectItem>
                      <SelectItem value="vigorous">{t("nutritionExerciseDialog.intensity.vigorous")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {(selectedExercise.supportsDistance || selectedExercise.supportsSpeed) ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-2">
                      <Label>{t("nutritionExerciseDialog.distanceLabel")}</Label>
                      <Input dir="ltr" value={draft.distanceKm} onChange={(event) => setDraft((current) => ({ ...current, distanceKm: event.target.value }))} disabled={!selectedExercise.supportsDistance} className="rounded-2xl border-white/10 bg-white/5 text-start text-white disabled:opacity-50" inputMode="decimal" placeholder={selectedExercise.supportsDistance ? t("nutritionExerciseDialog.distancePlaceholder") : t("nutritionExerciseDialog.notRequired")} />
                    </div>
                    <div className="grid gap-2">
                      <Label>{t("nutritionExerciseDialog.speedLabel")}</Label>
                      <Input dir="ltr" value={draft.speedKmh} onChange={(event) => setDraft((current) => ({ ...current, speedKmh: event.target.value }))} disabled={!selectedExercise.supportsSpeed} className="rounded-2xl border-white/10 bg-white/5 text-start text-white disabled:opacity-50" inputMode="decimal" placeholder={selectedExercise.supportsSpeed ? t("nutritionExerciseDialog.speedPlaceholder") : t("nutritionExerciseDialog.notRequired")} />
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-2">
                  <Label>{t("nutritionExerciseDialog.notesLabel")}</Label>
                  <Textarea value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} className="min-h-24 rounded-2xl border-white/10 bg-white/5 text-white" placeholder={t("nutritionExerciseDialog.notesPlaceholder")} />
                </div>

                <div className="rounded-[24px] border border-amber-300/20 bg-amber-400/10 p-4">
                  <div className="flex items-center gap-2 text-sm font-black text-amber-100">
                    <Flame className="h-4 w-4 text-amber-300" />
                    {t("nutritionExerciseDialog.summaryTitle")}
                  </div>
                  <div className="mt-3 text-sm leading-7 text-white">
                    {t("nutritionExerciseDialog.summaryMain", {
                      duration: format.number(Number(draft.durationMinutes || 0)),
                      exercise: selectedExercise.title,
                      intensity: intensityLabel,
                    })}
                    {selectedExercise.supportsSpeed && draft.speedKmh ? t("nutritionExerciseDialog.summarySpeed", { speed: format.number(Number(draft.speedKmh)) }) : ""}
                    {selectedExercise.supportsDistance && draft.distanceKm ? t("nutritionExerciseDialog.summaryDistance", { distance: format.number(Number(draft.distanceKm)) }) : ""}
                  </div>
                  <div className="mt-2 text-xs text-amber-100/80">
                    {t("nutritionExerciseDialog.summaryWeight", { weight: format.number(Number(draft.weightKg || 0)) })}
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.03] p-6 text-sm leading-7 text-slate-300">
                {t("nutritionExerciseDialog.empty")}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" className="rounded-2xl border-white/10 bg-white/5 text-white hover:bg-white/[0.08]" onClick={() => onOpenChange(false)}>
            {t("common.close")}
          </Button>
          <Button
            onClick={() => void submit()}
            disabled={saving || !selectedExercise || Number(draft.durationMinutes || 0) <= 0 || Number(draft.weightKg || 0) <= 0}
            className="rounded-2xl bg-emerald-400 text-slate-950 hover:bg-emerald-300"
          >
            {saving ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
            {t("nutritionExerciseDialog.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
