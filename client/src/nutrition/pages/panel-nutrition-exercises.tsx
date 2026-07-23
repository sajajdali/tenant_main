import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Layers3, Loader2, Pencil, Plus, Search, Sparkles, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import type { NutritionExerciseGroup, NutritionExerciseItem } from "@/lib/types";
import { EXERCISE_ICON_OPTIONS, getNutritionExerciseIcon } from "@/nutrition/lib/exercise-helpers";
import { useFormat, useLocale, useT } from "@/i18n/locale";
import type { MessageKey } from "@/i18n/messages";

type GroupFormState = {
  title: string;
  slug: string;
  description: string;
  iconKey: string;
  accentColor: string;
  softColor: string;
  sortOrder: string;
  isActive: boolean;
};

type ExerciseFormState = {
  groupId: string;
  title: string;
  slug: string;
  description: string;
  iconKey: string;
  badgeText: string;
  searchTerms: string;
  supportsIntensity: boolean;
  supportsDistance: boolean;
  supportsSpeed: boolean;
  defaultIntensity: "light" | "moderate" | "vigorous";
  metLight: string;
  metModerate: string;
  metVigorous: string;
  sortOrder: string;
  isActive: boolean;
};

const EMPTY_GROUP_FORM: GroupFormState = {
  title: "",
  slug: "",
  description: "",
  iconKey: "Dumbbell",
  accentColor: "#f59e0b",
  softColor: "#451a03",
  sortOrder: "0",
  isActive: true,
};

const EMPTY_EXERCISE_FORM: ExerciseFormState = {
  groupId: "",
  title: "",
  slug: "",
  description: "",
  iconKey: "Activity",
  badgeText: "",
  searchTerms: "",
  supportsIntensity: true,
  supportsDistance: false,
  supportsSpeed: false,
  defaultIntensity: "moderate",
  metLight: "",
  metModerate: "",
  metVigorous: "",
  sortOrder: "0",
  isActive: true,
};

function toSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]+/g, "")
    .replace(/-+/g, "-");
}

function resolveTenantExerciseAdminError(message: string | null | undefined, t: (key: MessageKey) => string) {
  const raw = String(message ?? "").trim();

  if (raw.toLowerCase().includes("migration")) {
    return t("panelNutritionExercises.errors.migrationRequired");
  }

  return raw || t("panelNutritionExercises.errors.tryAgain");
}

export default function PanelNutritionExercisesPage() {
  const { toast } = useToast();
  const t = useT();
  const format = useFormat();
  const { dir, isRtl } = useLocale();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [groups, setGroups] = useState<NutritionExerciseGroup[]>([]);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [exerciseDialogOpen, setExerciseDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<NutritionExerciseGroup | null>(null);
  const [editingExercise, setEditingExercise] = useState<NutritionExerciseItem | null>(null);
  const [groupForm, setGroupForm] = useState<GroupFormState>(EMPTY_GROUP_FORM);
  const [exerciseForm, setExerciseForm] = useState<ExerciseFormState>(EMPTY_EXERCISE_FORM);

  const loadItems = async () => {
    setLoading(true);
    const result = await api.nutritionExercises.adminList();

    if (result.success) {
      setGroups(result.data.groups ?? []);
    } else {
      toast({ variant: "destructive", title: t("panelNutritionExercises.toast.loadFailed"), description: result.message || t("panelNutritionExercises.toast.loadFailedDescription") });
    }

    setLoading(false);
  };

  useEffect(() => {
    void loadItems();
  }, []);

  const filteredGroups = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) {
      return groups;
    }

    return groups
      .map((group) => ({
        ...group,
        exercises: group.exercises.filter((exercise) => {
          const haystack = [
            exercise.title,
            exercise.description,
            exercise.badgeText,
            exercise.searchTerms,
            group.title,
          ].join(" ").toLowerCase();

          return haystack.includes(keyword);
        }),
      }))
      .filter((group) => group.title.toLowerCase().includes(keyword) || group.exercises.length > 0);
  }, [groups, search]);

  const totalExercises = useMemo(() => groups.reduce((sum, group) => sum + group.exercises.length, 0), [groups]);
  const customGroupsCount = useMemo(() => groups.filter((group) => group.isCustom).length, [groups]);
  const customExercisesCount = useMemo(
    () => groups.reduce((sum, group) => sum + group.exercises.filter((exercise) => exercise.isCustom).length, 0),
    [groups],
  );

  const openCreateGroup = () => {
    setEditingGroup(null);
    setGroupForm(EMPTY_GROUP_FORM);
    setGroupDialogOpen(true);
  };

  const openEditGroup = (group: NutritionExerciseGroup) => {
    setEditingGroup(group);
    setGroupForm({
      title: group.title,
      slug: group.slug,
      description: group.description ?? "",
      iconKey: group.iconKey ?? "Dumbbell",
      accentColor: group.accentColor ?? "#f59e0b",
      softColor: group.softColor ?? "#451a03",
      sortOrder: String(group.sortOrder ?? 0),
      isActive: group.isActive,
    });
    setGroupDialogOpen(true);
  };

  const openCreateExercise = (groupId?: string) => {
    setEditingExercise(null);
    setExerciseForm({ ...EMPTY_EXERCISE_FORM, groupId: groupId ?? groups[0]?.id ?? "" });
    setExerciseDialogOpen(true);
  };

  const openEditExercise = (exercise: NutritionExerciseItem) => {
    setEditingExercise(exercise);
    setExerciseForm({
      groupId: exercise.groupId,
      title: exercise.title,
      slug: exercise.slug,
      description: exercise.description ?? "",
      iconKey: exercise.iconKey ?? "Activity",
      badgeText: exercise.badgeText ?? "",
      searchTerms: exercise.searchTerms ?? "",
      supportsIntensity: exercise.supportsIntensity,
      supportsDistance: exercise.supportsDistance,
      supportsSpeed: exercise.supportsSpeed,
      defaultIntensity: (exercise.defaultIntensity as "light" | "moderate" | "vigorous") ?? "moderate",
      metLight: exercise.metLight != null ? String(exercise.metLight) : "",
      metModerate: exercise.metModerate != null ? String(exercise.metModerate) : "",
      metVigorous: exercise.metVigorous != null ? String(exercise.metVigorous) : "",
      sortOrder: String(exercise.sortOrder ?? 0),
      isActive: exercise.isActive,
    });
    setExerciseDialogOpen(true);
  };

  const saveGroup = async () => {
    setSaving(true);

    const payload = {
      title: groupForm.title,
      slug: groupForm.slug || toSlug(groupForm.title),
      description: groupForm.description || undefined,
      iconKey: groupForm.iconKey,
      accentColor: groupForm.accentColor,
      softColor: groupForm.softColor,
      sortOrder: Number(groupForm.sortOrder || 0),
      isActive: groupForm.isActive,
    };

    const result = editingGroup
      ? await api.nutritionExercises.updateGroup(editingGroup.id, payload)
      : await api.nutritionExercises.createGroup(payload);

    if (result.success) {
      toast({ title: editingGroup ? t("panelNutritionExercises.toast.groupUpdated") : t("panelNutritionExercises.toast.groupCreated") });
      setGroupDialogOpen(false);
      await loadItems();
    } else {
      toast({ variant: "destructive", title: t("panelNutritionExercises.toast.saveFailed"), description: resolveTenantExerciseAdminError(result.message, t) });
    }

    setSaving(false);
  };

  const saveExercise = async () => {
    setSaving(true);

    const payload = {
      groupId: exerciseForm.groupId,
      title: exerciseForm.title,
      slug: exerciseForm.slug || toSlug(exerciseForm.title),
      description: exerciseForm.description || undefined,
      iconKey: exerciseForm.iconKey,
      badgeText: exerciseForm.badgeText || undefined,
      searchTerms: exerciseForm.searchTerms || undefined,
      supportsIntensity: exerciseForm.supportsIntensity,
      supportsDistance: exerciseForm.supportsDistance,
      supportsSpeed: exerciseForm.supportsSpeed,
      defaultIntensity: exerciseForm.defaultIntensity,
      metLight: exerciseForm.metLight ? Number(exerciseForm.metLight) : null,
      metModerate: exerciseForm.metModerate ? Number(exerciseForm.metModerate) : null,
      metVigorous: exerciseForm.metVigorous ? Number(exerciseForm.metVigorous) : null,
      sortOrder: Number(exerciseForm.sortOrder || 0),
      isActive: exerciseForm.isActive,
    };

    const result = editingExercise
      ? await api.nutritionExercises.updateExercise(editingExercise.id, payload)
      : await api.nutritionExercises.createExercise(payload);

    if (result.success) {
      toast({ title: editingExercise ? t("panelNutritionExercises.toast.exerciseUpdated") : t("panelNutritionExercises.toast.exerciseCreated") });
      setExerciseDialogOpen(false);
      await loadItems();
    } else {
      toast({ variant: "destructive", title: t("panelNutritionExercises.toast.saveFailed"), description: resolveTenantExerciseAdminError(result.message, t) });
    }

    setSaving(false);
  };

  const deleteGroup = async (group: NutritionExerciseGroup) => {
    if (!window.confirm(t("panelNutritionExercises.confirm.deleteGroup", { title: group.title }))) {
      return;
    }

    const result = await api.nutritionExercises.deleteGroup(group.id);
    if (result.success) {
      toast({ title: t("panelNutritionExercises.toast.groupDeleted") });
      await loadItems();
    } else {
      toast({ variant: "destructive", title: t("panelNutritionExercises.toast.deleteFailed"), description: resolveTenantExerciseAdminError(result.message, t) });
    }
  };

  const deleteExercise = async (exercise: NutritionExerciseItem) => {
    if (!window.confirm(t("panelNutritionExercises.confirm.deleteExercise", { title: exercise.title }))) {
      return;
    }

    const result = await api.nutritionExercises.deleteExercise(exercise.id);
    if (result.success) {
      toast({ title: t("panelNutritionExercises.toast.exerciseDeleted") });
      await loadItems();
    } else {
      toast({ variant: "destructive", title: t("panelNutritionExercises.toast.deleteFailed"), description: resolveTenantExerciseAdminError(result.message, t) });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#071521] text-white" dir={dir}>
        <div className="mx-auto flex max-w-5xl items-center justify-center px-4 py-20">
          <Loader2 className="h-7 w-7 animate-spin text-amber-300" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#071521] pb-20 text-white" dir={dir}>
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,rgba(34,197,94,0.14),transparent_28%),radial-gradient(circle_at_top_left,rgba(249,115,22,0.14),transparent_24%),linear-gradient(180deg,#071521,#04101a)]" />

      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#071521]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <div>
            <div className="text-xs font-bold text-emerald-200/70">{t("panelNutritionExercises.header.eyebrow")}</div>
            <h1 className="text-xl font-black">{t("panelNutritionExercises.header.title")}</h1>
          </div>
          <Link href="/panel">
            <Button variant="outline" size="icon" title={t("panelNutritionExercises.back")} className="rounded-2xl border-white/15 bg-white/[0.04] text-white hover:bg-white/[0.08]">
              {isRtl ? <ArrowRight className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}
            </Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-5 px-4 py-6">
        <section className="rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(6,20,31,0.98),rgba(9,24,36,0.94))] p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-[11px] font-bold text-emerald-100">
                <Sparkles className="h-3.5 w-3.5" />
                {t("panelNutritionExercises.hero.badge")}
              </div>
              <div>
                <h2 className="text-2xl font-black text-white">{t("panelNutritionExercises.hero.title")}</h2>
                <p className="mt-2 max-w-3xl text-sm leading-8 text-slate-300">
                  {t("panelNutritionExercises.hero.description")}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-[22px] border border-white/10 bg-white/[0.04] px-4 py-3">
                <div className="text-[11px] font-bold text-slate-400">{t("panelNutritionExercises.stats.groups")}</div>
                <div className="mt-2 text-xl font-black text-white">{format.number(groups.length)}</div>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-white/[0.04] px-4 py-3">
                <div className="text-[11px] font-bold text-slate-400">{t("panelNutritionExercises.stats.exercises")}</div>
                <div className="mt-2 text-xl font-black text-white">{format.number(totalExercises)}</div>
              </div>
              <div className="rounded-[22px] border border-emerald-300/15 bg-emerald-400/10 px-4 py-3">
                <div className="text-[11px] font-bold text-emerald-100/75">{t("panelNutritionExercises.stats.customGroups")}</div>
                <div className="mt-2 text-xl font-black text-emerald-200">{format.number(customGroupsCount)}</div>
              </div>
              <div className="rounded-[22px] border border-amber-300/15 bg-amber-400/10 px-4 py-3">
                <div className="text-[11px] font-bold text-amber-100/75">{t("panelNutritionExercises.stats.customExercises")}</div>
                <div className="mt-2 text-xl font-black text-amber-200">{format.number(customExercisesCount)}</div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[320px,minmax(0,1fr)]">
          <Card className="rounded-[30px] border border-white/10 bg-white/[0.04] text-white">
            <CardHeader className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-[16px] border border-white/10 bg-white/[0.05]">
                  <Layers3 className="h-5 w-5 text-emerald-300" />
                </div>
                <div>
                  <CardTitle className="text-lg font-black">{t("panelNutritionExercises.groups.title")}</CardTitle>
                  <CardDescription className="mt-1 text-slate-300">{t("panelNutritionExercises.groups.description")}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button onClick={openCreateGroup} className="w-full rounded-2xl bg-emerald-400 text-slate-950 hover:bg-emerald-300">
                <Plus className="me-2 h-4 w-4" />
                {t("panelNutritionExercises.groups.new")}
              </Button>
              <div className="space-y-3">
                {groups.map((group) => {
                  const Icon = getNutritionExerciseIcon(group.iconKey);
                  return (
                    <div key={group.id} className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-[16px] border border-white/10" style={{ background: `linear-gradient(135deg, ${group.softColor ?? "#0f172a"}, ${group.accentColor ?? "#22c55e"})` }}>
                            <Icon className="h-4.5 w-4.5 text-white" />
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="font-black text-white">{group.title}</div>
                              {group.isCustom ? <span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold text-amber-200">{t("panelNutritionExercises.badge.custom")}</span> : null}
                            </div>
                            <div className="mt-1 text-xs text-slate-400">{t("panelNutritionExercises.exerciseCount", { count: format.number(group.exercises.length) })}</div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="icon" className="h-8.5 w-8.5 rounded-xl border-white/10 bg-white/5 text-white" onClick={() => openEditGroup(group)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="icon" className="h-8.5 w-8.5 rounded-xl border-rose-400/20 bg-rose-400/10 text-rose-200" onClick={() => void deleteGroup(group)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      {group.description ? <div className="mt-3 text-xs leading-6 text-slate-300">{group.description}</div> : null}
                      <Button variant="outline" className="mt-3 w-full rounded-2xl border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]" onClick={() => openCreateExercise(group.id)}>
                        <Plus className="me-2 h-4 w-4" />
                        {t("panelNutritionExercises.exercises.add")}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[30px] border border-white/10 bg-white/[0.04] text-white">
            <CardHeader className="space-y-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle className="text-lg font-black">{t("panelNutritionExercises.list.title")}</CardTitle>
                  <CardDescription className="mt-2 text-slate-300">{t("panelNutritionExercises.list.description")}</CardDescription>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="relative min-w-[280px] flex-1">
                    <Search className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("panelNutritionExercises.list.searchPlaceholder")} className="h-12 rounded-2xl border-white/10 bg-white/5 ps-11 text-white" />
                  </div>
                  <Button onClick={() => openCreateExercise()} className="h-12 rounded-2xl bg-amber-400 px-5 text-slate-950 hover:bg-amber-300">
                    <Plus className="me-2 h-4 w-4" />
                    {t("panelNutritionExercises.exercises.new")}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {filteredGroups.length === 0 ? (
                <div className="rounded-[26px] border border-dashed border-white/10 bg-white/[0.02] px-6 py-10 text-center text-sm leading-8 text-slate-400">
                  {t("panelNutritionExercises.list.emptySearch")}
                </div>
              ) : null}
              {filteredGroups.map((group) => (
                <section key={group.id} className="space-y-3 rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] p-4">
                  <div className="flex items-center justify-between gap-3 border-b border-white/8 pb-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm font-black text-white">{group.title}</div>
                        {group.isCustom ? <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-bold text-emerald-200">{t("panelNutritionExercises.badge.customGroup")}</span> : null}
                      </div>
                      <div className="mt-1 text-xs text-slate-400">{t("panelNutritionExercises.itemsCount", { count: format.number(group.exercises.length) })}</div>
                    </div>
                    <Button variant="outline" className="rounded-2xl border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]" onClick={() => openCreateExercise(group.id)}>
                      <Plus className="me-2 h-4 w-4" />
                      {t("panelNutritionExercises.exercises.add")}
                    </Button>
                  </div>
                  <div className="grid gap-3 xl:grid-cols-2">
                    {group.exercises.map((exercise) => {
                      const Icon = getNutritionExerciseIcon(exercise.iconKey);
                      return (
                        <div key={exercise.id} className="rounded-[22px] border border-white/10 bg-[linear-gradient(160deg,rgba(17,24,39,0.86),rgba(13,18,32,0.82))] p-4 transition-all hover:border-white/20">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="flex h-12 w-12 items-center justify-center rounded-[18px] border border-white/10 bg-white/[0.06]">
                                <Icon className="h-5 w-5 text-amber-300" />
                              </div>
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <div className="font-black">{exercise.title}</div>
                                  {exercise.isCustom ? <span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold text-amber-200">{t("panelNutritionExercises.badge.custom")}</span> : null}
                                </div>
                                <div className="mt-1 text-xs text-slate-400">{exercise.badgeText || group.title}</div>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl border-white/10 bg-white/5 text-white" onClick={() => openEditExercise(exercise)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl border-rose-400/20 bg-rose-400/10 text-rose-200" onClick={() => void deleteExercise(exercise)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          {exercise.description ? <div className="mt-3 text-xs leading-6 text-slate-300">{exercise.description}</div> : null}
                          <div className="mt-4 grid gap-2 sm:grid-cols-3">
                            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-bold text-slate-200">{t("panelNutritionExercises.met.light", { value: exercise.metLight ?? "—" })}</div>
                            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-bold text-slate-200">{t("panelNutritionExercises.met.moderate", { value: exercise.metModerate ?? "—" })}</div>
                            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-bold text-slate-200">{t("panelNutritionExercises.met.vigorous", { value: exercise.metVigorous ?? "—" })}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </CardContent>
          </Card>
        </section>
      </main>

      <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
        <DialogContent dir={dir} className="max-h-[88vh] overflow-hidden border-white/10 bg-[#081521] p-0 text-white sm:max-w-xl">
          <div className="flex max-h-[88vh] flex-col">
            <div className="shrink-0 border-b border-white/10 px-6 pb-4 pt-6">
              <DialogHeader>
                <DialogTitle>{editingGroup ? t("panelNutritionExercises.groupDialog.editTitle") : t("panelNutritionExercises.groupDialog.createTitle")}</DialogTitle>
                <DialogDescription className="text-slate-300">{t("panelNutritionExercises.groupDialog.description")}</DialogDescription>
              </DialogHeader>
            </div>
            <div className="pretty-scrollbar min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label>{t("panelNutritionExercises.groupDialog.titleLabel")}</Label>
                  <Input value={groupForm.title} onChange={(event) => setGroupForm((current) => ({ ...current, title: event.target.value, slug: current.slug || toSlug(event.target.value) }))} className="rounded-2xl border-white/10 bg-white/5 text-white" />
                </div>
                <div className="grid gap-2">
                  <Label>{t("panelNutritionExercises.fields.slug")}</Label>
                  <Input value={groupForm.slug} onChange={(event) => setGroupForm((current) => ({ ...current, slug: toSlug(event.target.value) }))} className="rounded-2xl border-white/10 bg-white/5 text-white" dir="ltr" />
                </div>
                <div className="grid gap-2">
                  <Label>{t("panelNutritionExercises.fields.description")}</Label>
                  <Textarea value={groupForm.description} onChange={(event) => setGroupForm((current) => ({ ...current, description: event.target.value }))} className="min-h-24 rounded-2xl border-white/10 bg-white/5 text-white" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>{t("panelNutritionExercises.fields.icon")}</Label>
                    <Select value={groupForm.iconKey} onValueChange={(value) => setGroupForm((current) => ({ ...current, iconKey: value }))}>
                      <SelectTrigger className="rounded-2xl border-white/10 bg-white/5 text-white"><SelectValue /></SelectTrigger>
                      <SelectContent dir={dir}>{EXERCISE_ICON_OPTIONS.map((icon) => <SelectItem key={icon} value={icon}>{icon}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>{t("panelNutritionExercises.fields.sortOrder")}</Label>
                    <Input value={groupForm.sortOrder} onChange={(event) => setGroupForm((current) => ({ ...current, sortOrder: event.target.value }))} className="rounded-2xl border-white/10 bg-white/5 text-white" inputMode="numeric" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>{t("panelNutritionExercises.fields.accentColor")}</Label>
                    <Input value={groupForm.accentColor} onChange={(event) => setGroupForm((current) => ({ ...current, accentColor: event.target.value }))} className="rounded-2xl border-white/10 bg-white/5 text-white" dir="ltr" />
                  </div>
                  <div className="grid gap-2">
                    <Label>{t("panelNutritionExercises.fields.softColor")}</Label>
                    <Input value={groupForm.softColor} onChange={(event) => setGroupForm((current) => ({ ...current, softColor: event.target.value }))} className="rounded-2xl border-white/10 bg-white/5 text-white" dir="ltr" />
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <div>
                    <div className="font-bold">{t("panelNutritionExercises.fields.active")}</div>
                    <div className="text-xs text-slate-400">{t("panelNutritionExercises.groupDialog.activeDescription")}</div>
                  </div>
                  <Switch checked={groupForm.isActive} onCheckedChange={(checked) => setGroupForm((current) => ({ ...current, isActive: checked }))} />
                </div>
              </div>
            </div>
            <DialogFooter className="shrink-0 gap-2 border-t border-white/10 px-6 py-4 sm:justify-between">
              <Button variant="outline" className="rounded-2xl border-white/10 bg-white/5 text-white" onClick={() => setGroupDialogOpen(false)}>{t("panelNutritionExercises.actions.close")}</Button>
              <Button onClick={() => void saveGroup()} disabled={saving || !groupForm.title.trim()} className="rounded-2xl bg-emerald-400 text-slate-950 hover:bg-emerald-300">
                {saving ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
                {t("panelNutritionExercises.groupDialog.save")}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={exerciseDialogOpen} onOpenChange={setExerciseDialogOpen}>
        <DialogContent dir={dir} className="max-h-[90vh] overflow-hidden border-white/10 bg-[#081521] p-0 text-white sm:max-w-2xl">
          <div className="flex max-h-[90vh] flex-col">
            <div className="shrink-0 border-b border-white/10 px-6 pb-4 pt-6">
              <DialogHeader>
                <DialogTitle>{editingExercise ? t("panelNutritionExercises.exerciseDialog.editTitle") : t("panelNutritionExercises.exerciseDialog.createTitle")}</DialogTitle>
                <DialogDescription className="text-slate-300">{t("panelNutritionExercises.exerciseDialog.description")}</DialogDescription>
              </DialogHeader>
            </div>
            <div className="pretty-scrollbar min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <div className="grid gap-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>{t("panelNutritionExercises.fields.group")}</Label>
                    <Select value={exerciseForm.groupId} onValueChange={(value) => setExerciseForm((current) => ({ ...current, groupId: value }))}>
                      <SelectTrigger className="rounded-2xl border-white/10 bg-white/5 text-white"><SelectValue placeholder={t("panelNutritionExercises.fields.groupPlaceholder")} /></SelectTrigger>
                      <SelectContent dir={dir}>{groups.map((group) => <SelectItem key={group.id} value={group.id}>{group.title}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>{t("panelNutritionExercises.fields.icon")}</Label>
                    <Select value={exerciseForm.iconKey} onValueChange={(value) => setExerciseForm((current) => ({ ...current, iconKey: value }))}>
                      <SelectTrigger className="rounded-2xl border-white/10 bg-white/5 text-white"><SelectValue /></SelectTrigger>
                      <SelectContent dir={dir}>{EXERCISE_ICON_OPTIONS.map((icon) => <SelectItem key={icon} value={icon}>{icon}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>{t("panelNutritionExercises.fields.title")}</Label>
                    <Input value={exerciseForm.title} onChange={(event) => setExerciseForm((current) => ({ ...current, title: event.target.value, slug: current.slug || toSlug(event.target.value) }))} className="rounded-2xl border-white/10 bg-white/5 text-white" />
                  </div>
                  <div className="grid gap-2">
                    <Label>{t("panelNutritionExercises.fields.slug")}</Label>
                    <Input value={exerciseForm.slug} onChange={(event) => setExerciseForm((current) => ({ ...current, slug: toSlug(event.target.value) }))} className="rounded-2xl border-white/10 bg-white/5 text-white" dir="ltr" />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>{t("panelNutritionExercises.fields.description")}</Label>
                  <Textarea value={exerciseForm.description} onChange={(event) => setExerciseForm((current) => ({ ...current, description: event.target.value }))} className="min-h-24 rounded-2xl border-white/10 bg-white/5 text-white" />
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>{t("panelNutritionExercises.fields.badgeText")}</Label>
                    <Input value={exerciseForm.badgeText} onChange={(event) => setExerciseForm((current) => ({ ...current, badgeText: event.target.value }))} className="rounded-2xl border-white/10 bg-white/5 text-white" />
                  </div>
                  <div className="grid gap-2">
                    <Label>{t("panelNutritionExercises.fields.sortOrder")}</Label>
                    <Input value={exerciseForm.sortOrder} onChange={(event) => setExerciseForm((current) => ({ ...current, sortOrder: event.target.value }))} className="rounded-2xl border-white/10 bg-white/5 text-white" inputMode="numeric" />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>{t("panelNutritionExercises.fields.searchTerms")}</Label>
                  <Input value={exerciseForm.searchTerms} onChange={(event) => setExerciseForm((current) => ({ ...current, searchTerms: event.target.value }))} className="rounded-2xl border-white/10 bg-white/5 text-white" />
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="grid gap-2">
                    <Label>{t("panelNutritionExercises.fields.metLight")}</Label>
                    <Input value={exerciseForm.metLight} onChange={(event) => setExerciseForm((current) => ({ ...current, metLight: event.target.value }))} className="rounded-2xl border-white/10 bg-white/5 text-white" inputMode="decimal" />
                  </div>
                  <div className="grid gap-2">
                    <Label>{t("panelNutritionExercises.fields.metModerate")}</Label>
                    <Input value={exerciseForm.metModerate} onChange={(event) => setExerciseForm((current) => ({ ...current, metModerate: event.target.value }))} className="rounded-2xl border-white/10 bg-white/5 text-white" inputMode="decimal" />
                  </div>
                  <div className="grid gap-2">
                    <Label>{t("panelNutritionExercises.fields.metVigorous")}</Label>
                    <Input value={exerciseForm.metVigorous} onChange={(event) => setExerciseForm((current) => ({ ...current, metVigorous: event.target.value }))} className="rounded-2xl border-white/10 bg-white/5 text-white" inputMode="decimal" />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <div>
                      <div className="font-bold">{t("panelNutritionExercises.fields.supportsIntensity")}</div>
                      <div className="text-xs text-slate-400">{t("panelNutritionExercises.exerciseDialog.intensityDescription")}</div>
                    </div>
                    <Switch checked={exerciseForm.supportsIntensity} onCheckedChange={(checked) => setExerciseForm((current) => ({ ...current, supportsIntensity: checked }))} />
                  </div>
                  <div className="grid gap-2">
                    <Label>{t("panelNutritionExercises.fields.defaultIntensity")}</Label>
                    <Select value={exerciseForm.defaultIntensity} onValueChange={(value) => setExerciseForm((current) => ({ ...current, defaultIntensity: value as "light" | "moderate" | "vigorous" }))}>
                      <SelectTrigger className="rounded-2xl border-white/10 bg-white/5 text-white"><SelectValue /></SelectTrigger>
                      <SelectContent dir={dir}>
                        <SelectItem value="light">{t("panelNutritionExercises.intensity.light")}</SelectItem>
                        <SelectItem value="moderate">{t("panelNutritionExercises.intensity.moderate")}</SelectItem>
                        <SelectItem value="vigorous">{t("panelNutritionExercises.intensity.vigorous")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <span className="font-bold">{t("panelNutritionExercises.fields.distance")}</span>
                    <Switch checked={exerciseForm.supportsDistance} onCheckedChange={(checked) => setExerciseForm((current) => ({ ...current, supportsDistance: checked }))} />
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <span className="font-bold">{t("panelNutritionExercises.fields.speed")}</span>
                    <Switch checked={exerciseForm.supportsSpeed} onCheckedChange={(checked) => setExerciseForm((current) => ({ ...current, supportsSpeed: checked }))} />
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <span className="font-bold">{t("panelNutritionExercises.fields.activeShort")}</span>
                    <Switch checked={exerciseForm.isActive} onCheckedChange={(checked) => setExerciseForm((current) => ({ ...current, isActive: checked }))} />
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter className="shrink-0 gap-2 border-t border-white/10 px-6 py-4 sm:justify-between">
              <Button variant="outline" className="rounded-2xl border-white/10 bg-white/5 text-white" onClick={() => setExerciseDialogOpen(false)}>{t("panelNutritionExercises.actions.close")}</Button>
              <Button onClick={() => void saveExercise()} disabled={saving || !exerciseForm.title.trim() || !exerciseForm.groupId} className="rounded-2xl bg-amber-400 text-slate-950 hover:bg-amber-300">
                {saving ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
                {t("panelNutritionExercises.exerciseDialog.save")}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
