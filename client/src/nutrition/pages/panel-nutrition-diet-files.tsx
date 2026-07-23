import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, ArrowRight, FileArchive, Loader2, Pencil, Plus, Search, Trash2, UploadCloud } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { NutritionDietFileGroup, NutritionDietFileItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useFormat, useLocale, useT } from "@/i18n/locale";

type FormState = {
  id: string | null;
  title: string;
  description: string;
  calories: string;
  groupId: string;
  isActive: boolean;
  file: File | null;
};

function emptyForm(): FormState {
  return {
    id: null,
    title: "",
    description: "",
    calories: "",
    groupId: "none",
    isActive: true,
    file: null,
  };
}

export default function PanelNutritionDietFilesPage() {
  const { isAdmin, isLoading } = useAuth();
  const { toast } = useToast();
  const t = useT();
  const format = useFormat();
  const { dir, isRtl } = useLocale();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [groupName, setGroupName] = useState("");
  const [groupSubmitting, setGroupSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);
  const [groups, setGroups] = useState<NutritionDietFileGroup[]>([]);
  const [items, setItems] = useState<NutritionDietFileItem[]>([]);
  const [form, setForm] = useState<FormState>(() => emptyForm());

  const load = async (q = activeQuery) => {
    setLoading(true);
    const result = await api.nutritionDietFiles.list(q);

    if (result.success) {
      setGroups(result.data.groups ?? []);
      setItems(result.data.items ?? []);
      setActiveQuery(result.data.filters.q ?? "");
      setSearchTerm(result.data.filters.q ?? "");
    } else {
      toast({ variant: "destructive", title: t("panelNutritionDietFiles.toast.loadFailed"), description: result.message });
    }

    setLoading(false);
  };

  useEffect(() => {
    if (isLoading || !isAdmin) {
      return;
    }

    void load("");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, isLoading]);

  const stats = useMemo(() => ({
    total: items.length,
    active: items.filter((item) => item.isActive).length,
    grouped: items.filter((item) => item.groupId).length,
    groupsCount: groups.length,
  }), [groups.length, items]);

  const resetForm = () => setForm(emptyForm());

  const startEdit = (item: NutritionDietFileItem) => {
    setForm({
      id: item.id,
      title: item.title,
      description: item.description ?? "",
      calories: item.calories != null ? String(item.calories) : "",
      groupId: item.groupId ?? "none",
      isActive: item.isActive,
      file: null,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = async () => {
    if (!form.title.trim()) {
      toast({ variant: "destructive", title: t("panelNutritionDietFiles.toast.titleRequired"), description: t("panelNutritionDietFiles.toast.titleRequiredDescription") });
      return;
    }

    if (!form.id && !form.file) {
      toast({ variant: "destructive", title: t("panelNutritionDietFiles.toast.fileRequired"), description: t("panelNutritionDietFiles.toast.fileRequiredDescription") });
      return;
    }

    const body = new FormData();
    body.append("title", form.title.trim());
    body.append("description", form.description.trim());
    body.append("calories", form.calories.trim());
    body.append("nutrition_diet_file_group_id", form.groupId === "none" ? "" : form.groupId);
    body.append("is_active", form.isActive ? "1" : "0");

    if (form.file) {
      body.append("file", form.file);
    }

    if (form.id) {
      body.append("_method", "PUT");
    }

    setSubmitting(true);
    const result = form.id
      ? await api.nutritionDietFiles.update(form.id, body)
      : await api.nutritionDietFiles.create(body);

    if (result.success) {
      toast({ title: form.id ? t("panelNutritionDietFiles.toast.updated") : t("panelNutritionDietFiles.toast.created") });
      resetForm();
      await load(activeQuery);
    } else {
      toast({ variant: "destructive", title: t("panelNutritionDietFiles.toast.saveFailed"), description: result.message });
    }

    setSubmitting(false);
  };

  const createGroup = async () => {
    if (!groupName.trim()) {
      toast({ variant: "destructive", title: t("panelNutritionDietFiles.toast.groupNameRequired"), description: t("panelNutritionDietFiles.toast.groupNameRequiredDescription") });
      return;
    }

    setGroupSubmitting(true);
    const result = await api.nutritionDietFiles.createGroup({ name: groupName.trim() });

    if (result.success) {
      toast({ title: t("panelNutritionDietFiles.toast.groupCreated") });
      setGroupName("");
      await load(activeQuery);
    } else {
      toast({ variant: "destructive", title: t("panelNutritionDietFiles.toast.groupSaveFailed"), description: result.message });
    }

    setGroupSubmitting(false);
  };

  const remove = async (id: string) => {
    setDeletingId(id);
    const result = await api.nutritionDietFiles.remove(id);

    if (result.success) {
      toast({ title: t("panelNutritionDietFiles.toast.deleted") });
      if (form.id === id) {
        resetForm();
      }
      await load(activeQuery);
    } else {
      toast({ variant: "destructive", title: t("panelNutritionDietFiles.toast.deleteFailed"), description: result.message });
    }

    setDeletingId(null);
  };

  const removeGroup = async (id: string) => {
    setDeletingGroupId(id);
    const result = await api.nutritionDietFiles.deleteGroup(id);

    if (result.success) {
      toast({ title: t("panelNutritionDietFiles.toast.groupDeleted") });
      await load(activeQuery);
    } else {
      toast({ variant: "destructive", title: t("panelNutritionDietFiles.toast.groupDeleteFailed"), description: result.message });
    }

    setDeletingGroupId(null);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a101a] p-4 text-white" dir={dir}>
        <div className="flex items-center gap-2 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          {t("panelNutritionDietFiles.loading")}
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a101a] p-4 text-white" dir={dir}>
        <div className="w-full max-w-md space-y-4 text-center">
          <h1 className="text-xl font-bold">{t("panelNutritionDietFiles.accessDenied.title")}</h1>
          <p className="leading-7 text-slate-400">{t("panelNutritionDietFiles.accessDenied.description")}</p>
          <Link href="/panel">
            <Button>{t("panelNutritionDietFiles.backToPanel")}</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.08),transparent_24%),linear-gradient(180deg,#090d15,#0b1220)] text-white" dir={dir}>
      <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="space-y-2">
            <h1 className="text-xl font-bold">{t("panelNutritionDietFiles.title")}</h1>
          </div>
          <Link href="/panel">
            <Button variant="outline" size="icon" title={t("panelNutritionDietFiles.back")} className="h-10 w-10 rounded-2xl border-border bg-background/40 hover:bg-background/70">
              {isRtl ? <ArrowRight className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}
            </Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: t("panelNutritionDietFiles.stats.total"), value: stats.total },
            { label: t("panelNutritionDietFiles.stats.active"), value: stats.active },
            { label: t("panelNutritionDietFiles.stats.grouped"), value: stats.grouped },
            { label: t("panelNutritionDietFiles.stats.groupsCount"), value: stats.groupsCount },
          ].map((stat) => (
            <div key={stat.label} className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4">
              <div className="text-xs font-bold text-slate-500">{stat.label}</div>
              <div className="mt-2 text-2xl font-black text-white">{format.number(stat.value)}</div>
            </div>
          ))}
        </section>

        <Card className="border-white/10 bg-[linear-gradient(180deg,rgba(18,26,40,0.92),rgba(11,16,27,0.94))]">
          <CardHeader>
            <CardTitle className="text-white">{form.id ? t("panelNutritionDietFiles.form.editTitle") : t("panelNutritionDietFiles.form.createTitle")}</CardTitle>
            <CardDescription className="text-slate-400">{t("panelNutritionDietFiles.form.description")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 lg:grid-cols-[1.2fr,0.8fr]">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-slate-300">{t("panelNutritionDietFiles.form.titleLabel")}</Label>
                <Input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} className="rounded-2xl border-white/10 bg-white/5 text-white" placeholder={t("panelNutritionDietFiles.form.titlePlaceholder")} />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">{t("panelNutritionDietFiles.form.descriptionLabel")}</Label>
                <Textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} className="min-h-[140px] rounded-2xl border-white/10 bg-white/5 text-white" placeholder={t("panelNutritionDietFiles.form.descriptionPlaceholder")} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-slate-300">{t("panelNutritionDietFiles.form.groupLabel")}</Label>
                  <Select value={form.groupId} onValueChange={(value) => setForm((current) => ({ ...current, groupId: value }))}>
                    <SelectTrigger className="rounded-2xl border-white/10 bg-white/5 text-white">
                      <SelectValue placeholder={t("panelNutritionDietFiles.form.groupPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent dir={dir}>
                      <SelectItem value="none">{t("panelNutritionDietFiles.form.noGroup")}</SelectItem>
                      {groups.map((group) => (
                        <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">{t("panelNutritionDietFiles.form.caloriesLabel")}</Label>
                  <Input value={form.calories} onChange={(event) => setForm((current) => ({ ...current, calories: event.target.value }))} className="rounded-2xl border-white/10 bg-white/5 text-white" placeholder={t("panelNutritionDietFiles.form.caloriesPlaceholder")} />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">{t("panelNutritionDietFiles.form.fileLabel")}</Label>
                <Input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx" onChange={(event) => setForm((current) => ({ ...current, file: event.target.files?.[0] ?? null }))} className="rounded-2xl border-white/10 bg-white/5 text-white file:me-4 file:rounded-xl file:border-0 file:bg-amber-400 file:px-4 file:py-2 file:font-bold file:text-slate-950" />
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                <div>
                  <div className="font-bold text-white">{t("panelNutritionDietFiles.form.activeTitle")}</div>
                  <div className="text-xs text-slate-400">{t("panelNutritionDietFiles.form.activeDescription")}</div>
                </div>
                <Switch checked={form.isActive} onCheckedChange={(checked) => setForm((current) => ({ ...current, isActive: checked }))} />
              </div>
              <div className="flex flex-wrap gap-3">
                <Button type="button" disabled={submitting} onClick={() => void submit()} className="rounded-2xl bg-amber-400 font-black text-slate-950 hover:bg-amber-300">
                  {submitting ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <UploadCloud className="me-2 h-4 w-4" />}
                  {form.id ? t("panelNutritionDietFiles.form.saveChanges") : t("panelNutritionDietFiles.form.submit")}
                </Button>
                {form.id ? (
                  <Button type="button" variant="outline" className="rounded-2xl border-white/10 bg-white/5 text-white hover:bg-white/10" onClick={resetForm}>
                    {t("panelNutritionDietFiles.form.cancelEdit")}
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-4">
                <div className="text-sm font-black text-white">{t("panelNutritionDietFiles.groups.addTitle")}</div>
                <div className="mt-2 text-xs leading-6 text-slate-400">{t("panelNutritionDietFiles.groups.addDescription")}</div>
                <div className="mt-3 space-y-2">
                  <Input value={groupName} onChange={(event) => setGroupName(event.target.value)} className="rounded-2xl border-white/10 bg-white/5 text-white" placeholder={t("panelNutritionDietFiles.groups.namePlaceholder")} />
                  <Button type="button" onClick={() => void createGroup()} disabled={groupSubmitting} className="w-full rounded-2xl">
                    {groupSubmitting ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Plus className="me-2 h-4 w-4" />}
                    {t("panelNutritionDietFiles.groups.save")}
                  </Button>
                </div>
              </div>
              <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-4">
                <div className="text-sm font-black text-white">{t("panelNutritionDietFiles.groups.listTitle")}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {groups.length ? groups.map((group) => (
                    <div key={group.id} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white">
                      <span>{group.name}</span>
                      <span className="text-slate-400">({format.number(group.filesCount ?? 0)})</span>
                      <button type="button" onClick={() => void removeGroup(group.id)} disabled={deletingGroupId === group.id} className="text-rose-300 disabled:opacity-60">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )) : (
                    <div className="text-xs text-slate-500">{t("panelNutritionDietFiles.groups.empty")}</div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-[linear-gradient(180deg,rgba(18,26,40,0.92),rgba(11,16,27,0.94))]">
          <CardHeader>
            <CardTitle className="text-white">{t("panelNutritionDietFiles.list.title")}</CardTitle>
            <CardDescription className="text-slate-400">{t("panelNutritionDietFiles.list.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <Input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} className="h-12 rounded-2xl border-white/10 bg-white/5 ps-11 text-white" placeholder={t("panelNutritionDietFiles.list.searchPlaceholder")} />
              </div>
              <Button type="button" className="h-12 rounded-2xl" onClick={() => void load(searchTerm)}>{t("panelNutritionDietFiles.list.search")}</Button>
              {activeQuery ? (
                <Button type="button" variant="outline" className="h-12 rounded-2xl border-white/10 bg-white/5 text-white hover:bg-white/10" onClick={() => void load("")}>
                  {t("panelNutritionDietFiles.list.clear")}
                </Button>
              ) : null}
            </div>

            {loading ? (
              <div className="flex h-40 items-center justify-center text-slate-400">
                <Loader2 className="me-2 h-5 w-5 animate-spin" />
                {t("panelNutritionDietFiles.list.loading")}
              </div>
            ) : items.length === 0 ? (
              <div className="rounded-[2rem] border border-dashed border-white/10 bg-white/[0.03] px-6 py-16 text-center text-slate-400">
                {t("panelNutritionDietFiles.list.empty")}
              </div>
            ) : (
              <div className="grid gap-4 xl:grid-cols-2">
                {items.map((item) => (
                  <div key={item.id} className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="text-lg font-black text-white">{item.title}</div>
                        <div className="flex flex-wrap gap-2 text-xs">
                          {item.groupName ? <span className="rounded-full bg-cyan-400/10 px-3 py-1 font-bold text-cyan-200">{item.groupName}</span> : null}
                          {item.calories != null ? <span className="rounded-full bg-amber-400/10 px-3 py-1 font-bold text-amber-200">{t("panelNutritionDietFiles.list.calories", { count: format.number(item.calories) })}</span> : null}
                          <span className={`rounded-full px-3 py-1 font-bold ${item.isActive ? "bg-emerald-400/10 text-emerald-200" : "bg-slate-500/10 text-slate-300"}`}>
                            {item.isActive ? t("panelNutritionDietFiles.status.active") : t("panelNutritionDietFiles.status.inactive")}
                          </span>
                        </div>
                      </div>
                      <div className="rounded-2xl bg-white/5 p-3 text-amber-300">
                        <FileArchive className="h-5 w-5" />
                      </div>
                    </div>
                    <div className="mt-3 text-sm leading-7 text-slate-300">{item.description || t("panelNutritionDietFiles.list.noDescription")}</div>
                    <div className="mt-3 text-xs text-slate-500">{item.fileName}</div>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <a href={item.fileUrl} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-bold text-white transition hover:bg-white/10">
                        {t("panelNutritionDietFiles.actions.view")}
                      </a>
                      <Button type="button" variant="outline" className="rounded-2xl border-white/10 bg-white/5 text-white hover:bg-white/10" onClick={() => startEdit(item)}>
                        <Pencil className="me-2 h-4 w-4" />
                        {t("panelNutritionDietFiles.actions.edit")}
                      </Button>
                      <Button type="button" variant="destructive" className="rounded-2xl" disabled={deletingId === item.id} onClick={() => void remove(item.id)}>
                        {deletingId === item.id ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Trash2 className="me-2 h-4 w-4" />}
                        {t("panelNutritionDietFiles.actions.delete")}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
