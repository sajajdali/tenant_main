import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, ArrowRight, Headphones, Loader2, Music4, Pencil, Plus, Save, Trash2, UploadCloud, Waves } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { NutritionAudioGuidanceAsset } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useFormat, useLocale, useT } from "@/i18n/locale";

type TemplateOption = {
  id: string;
  name: string;
  label: string;
};

type FormState = {
  id: string | null;
  templateId: string;
  sessionNumber: string;
  title: string;
  description: string;
  sortOrder: string;
  isActive: boolean;
  audioFile: File | null;
};

function emptyForm(): FormState {
  return {
    id: null,
    templateId: "all",
    sessionNumber: "",
    title: "",
    description: "",
    sortOrder: "0",
    isActive: true,
    audioFile: null,
  };
}

export default function PanelNutritionAudioGuidancePage() {
  const { isAdmin, isLoading } = useAuth();
  const { toast } = useToast();
  const t = useT();
  const format = useFormat();
  const { dir, isRtl } = useLocale();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [items, setItems] = useState<NutritionAudioGuidanceAsset[]>([]);
  const [form, setForm] = useState<FormState>(() => emptyForm());

  const load = async () => {
    setLoading(true);
    const result = await api.nutritionAudioGuidance.list();

    if (result.success) {
      setTemplates(result.data.templates ?? []);
      setItems(result.data.items ?? []);
    } else {
      toast({ variant: "destructive", title: t("panelNutritionAudio.toast.loadFailed"), description: result.message });
    }

    setLoading(false);
  };

  useEffect(() => {
    if (isLoading || !isAdmin) {
      return;
    }

    void load();
  }, [isAdmin, isLoading]);

  const stats = useMemo(() => {
    return {
      total: items.length,
      active: items.filter((item) => item.isActive).length,
      global: items.filter((item) => !item.templateId).length,
      scoped: items.filter((item) => item.sessionNumber).length,
    };
  }, [items]);

  const resetForm = () => setForm(emptyForm());

  const startEdit = (item: NutritionAudioGuidanceAsset) => {
    setForm({
      id: item.id,
      templateId: item.templateId ?? "all",
      sessionNumber: item.sessionNumber ? String(item.sessionNumber) : "",
      title: item.title,
      description: item.description ?? "",
      sortOrder: String(item.sortOrder ?? 0),
      isActive: item.isActive,
      audioFile: null,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = async () => {
    if (!form.title.trim()) {
      toast({ variant: "destructive", title: t("panelNutritionAudio.toast.titleRequired"), description: t("panelNutritionAudio.toast.titleRequiredDescription") });
      return;
    }

    if (!form.id && !form.audioFile) {
      toast({ variant: "destructive", title: t("panelNutritionAudio.toast.fileRequired"), description: t("panelNutritionAudio.toast.fileRequiredDescription") });
      return;
    }

    const body = new FormData();
    body.append("title", form.title.trim());
    body.append("description", form.description.trim());
    body.append("sort_order", form.sortOrder || "0");
    body.append("is_active", form.isActive ? "1" : "0");
    body.append("nutrition_diet_template_id", form.templateId === "all" ? "" : form.templateId);
    body.append("session_number", form.sessionNumber.trim());

    if (form.audioFile) {
      body.append("audio", form.audioFile);
    }

    if (form.id) {
      body.append("_method", "PUT");
    }

    setSubmitting(true);
    const result = form.id
      ? await api.nutritionAudioGuidance.update(form.id, body)
      : await api.nutritionAudioGuidance.create(body);

    if (result.success) {
      toast({ title: form.id ? t("panelNutritionAudio.toast.updated") : t("panelNutritionAudio.toast.created") });
      resetForm();
      await load();
    } else {
      toast({ variant: "destructive", title: t("panelNutritionAudio.toast.saveFailed"), description: result.message });
    }

    setSubmitting(false);
  };

  const remove = async (id: string) => {
    setDeletingId(id);
    const result = await api.nutritionAudioGuidance.remove(id);

    if (result.success) {
      toast({ title: t("panelNutritionAudio.toast.deleted") });
      if (form.id === id) {
        resetForm();
      }
      await load();
    } else {
      toast({ variant: "destructive", title: t("panelNutritionAudio.toast.deleteFailed"), description: result.message });
    }

    setDeletingId(null);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a101a] p-4 text-white" dir={dir}>
        <div className="flex items-center gap-2 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          {t("panelNutritionAudio.loading")}
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a101a] p-4 text-white" dir={dir}>
        <div className="w-full max-w-md space-y-4 text-center">
          <h1 className="text-xl font-bold">{t("panelNutritionAudio.accessDenied.title")}</h1>
          <p className="leading-7 text-slate-400">{t("panelNutritionAudio.accessDenied.description")}</p>
          <Link href="/panel">
            <Button>{t("panelNutritionAudio.backToPanel")}</Button>
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
            <h1 className="text-xl font-bold">{t("panelNutritionAudio.title")}</h1>
          </div>
          <Link href="/panel">
            <Button variant="outline" size="icon" title={t("panelNutritionAudio.back")} className="h-10 w-10 rounded-2xl border-border bg-background/40 hover:bg-background/70">
              {isRtl ? <ArrowRight className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}
            </Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: t("panelNutritionAudio.stats.total"), value: stats.total, icon: Music4, tone: "bg-amber-400/10 text-amber-300" },
            { label: t("panelNutritionAudio.stats.active"), value: stats.active, icon: Waves, tone: "bg-emerald-400/10 text-emerald-300" },
            { label: t("panelNutritionAudio.stats.global"), value: stats.global, icon: Headphones, tone: "bg-cyan-400/10 text-cyan-300" },
            { label: t("panelNutritionAudio.stats.scoped"), value: stats.scoped, icon: UploadCloud, tone: "bg-violet-400/10 text-violet-300" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-center gap-3">
                <div className={`flex h-12 w-12 items-center justify-center rounded-[18px] ${stat.tone}`}>
                  <stat.icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-500">{stat.label}</div>
                  <div className="mt-1 text-xl font-black text-white">{format.number(stat.value)}</div>
                </div>
              </div>
            </div>
          ))}
        </section>

        <Card className="border-white/10 bg-[linear-gradient(180deg,rgba(18,26,40,0.92),rgba(11,16,27,0.94))]">
          <CardHeader>
            <CardTitle className="text-white">{form.id ? t("panelNutritionAudio.form.editTitle") : t("panelNutritionAudio.form.createTitle")}</CardTitle>
            <CardDescription className="text-slate-400">{t("panelNutritionAudio.form.description")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-slate-300">{t("panelNutritionAudio.form.titleLabel")}</Label>
                <Input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} className="rounded-2xl border-white/10 bg-white/5 text-white" placeholder={t("panelNutritionAudio.form.titlePlaceholder")} />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">{t("panelNutritionAudio.form.descriptionLabel")}</Label>
                <Textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} className="min-h-[120px] rounded-2xl border-white/10 bg-white/5 text-white" placeholder={t("panelNutritionAudio.form.descriptionPlaceholder")} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-slate-300">{t("panelNutritionAudio.form.templateLabel")}</Label>
                  <Select value={form.templateId} onValueChange={(value) => setForm((current) => ({ ...current, templateId: value }))}>
                    <SelectTrigger className="rounded-2xl border-white/10 bg-white/5 text-white">
                      <SelectValue placeholder={t("panelNutritionAudio.form.templatePlaceholder")} />
                    </SelectTrigger>
                    <SelectContent dir={dir}>
                      <SelectItem value="all">{t("panelNutritionAudio.form.allTemplates")}</SelectItem>
                      {templates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>{template.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">{t("panelNutritionAudio.form.sessionLabel")}</Label>
                  <Input value={form.sessionNumber} onChange={(event) => setForm((current) => ({ ...current, sessionNumber: event.target.value }))} className="rounded-2xl border-white/10 bg-white/5 text-white" placeholder={t("panelNutritionAudio.form.sessionPlaceholder")} />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-slate-300">{t("panelNutritionAudio.form.sortOrderLabel")}</Label>
                  <Input value={form.sortOrder} onChange={(event) => setForm((current) => ({ ...current, sortOrder: event.target.value }))} className="rounded-2xl border-white/10 bg-white/5 text-white" />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">{t("panelNutritionAudio.form.fileLabel")}</Label>
                  <Input type="file" accept="audio/*" onChange={(event) => setForm((current) => ({ ...current, audioFile: event.target.files?.[0] ?? null }))} className="rounded-2xl border-white/10 bg-white/5 text-white file:me-3 file:rounded-xl file:border-0 file:bg-amber-400 file:px-3 file:py-2 file:text-slate-950" />
                </div>
              </div>

              <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-black text-white">{t("panelNutritionAudio.form.activeTitle")}</div>
                    <div className="mt-1 text-sm leading-7 text-slate-400">{t("panelNutritionAudio.form.activeDescription")}</div>
                  </div>
                  <Switch checked={form.isActive} onCheckedChange={(checked) => setForm((current) => ({ ...current, isActive: checked }))} />
                </div>
              </div>

              <div className="rounded-[24px] border border-cyan-400/20 bg-cyan-400/10 p-4 text-sm leading-7 text-cyan-50">
                {t("panelNutritionAudio.form.scopeHint")}
              </div>

              <div className="flex flex-wrap justify-end gap-3">
                {form.id ? (
                  <Button type="button" variant="outline" className="rounded-2xl border-white/10 bg-white/5 text-slate-200 hover:bg-white/10" onClick={resetForm}>
                    {t("panelNutritionAudio.form.cancelEdit")}
                  </Button>
                ) : null}
                <Button type="button" disabled={submitting} onClick={submit} className="rounded-2xl bg-[linear-gradient(135deg,#f59e0b,#fbbf24)] px-5 font-black text-slate-950 hover:opacity-95">
                  {submitting ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : form.id ? <Save className="me-2 h-4 w-4" /> : <Plus className="me-2 h-4 w-4" />}
                  {form.id ? t("panelNutritionAudio.form.saveChanges") : t("panelNutritionAudio.form.submit")}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-[linear-gradient(180deg,rgba(18,26,40,0.92),rgba(11,16,27,0.94))]">
          <CardHeader>
            <CardTitle className="text-white">{t("panelNutritionAudio.list.title")}</CardTitle>
            <CardDescription className="text-slate-400">{t("panelNutritionAudio.list.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex h-52 items-center justify-center text-slate-400">
                <Loader2 className="me-2 h-5 w-5 animate-spin" />
                {t("panelNutritionAudio.list.loading")}
              </div>
            ) : items.length === 0 ? (
              <div className="flex h-52 flex-col items-center justify-center rounded-[2rem] border border-dashed border-white/10 bg-white/[0.02] text-center">
                <Headphones className="mb-3 h-10 w-10 text-amber-300/80" />
                <div className="font-bold text-white">{t("panelNutritionAudio.list.empty")}</div>
              </div>
            ) : (
              <div className="grid gap-4 xl:grid-cols-2">
                {items.map((item) => (
                  <div key={item.id} className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-lg font-black text-white">{item.title}</div>
                          <span className={`rounded-full px-3 py-1 text-[11px] font-black ${item.isActive ? "bg-emerald-400/15 text-emerald-300" : "bg-white/10 text-slate-300"}`}>
                            {item.isActive ? t("panelNutritionAudio.status.active") : t("panelNutritionAudio.status.inactive")}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400">{item.scopeLabel}</div>
                        {item.description ? <div className="text-sm leading-7 text-slate-300">{item.description}</div> : null}
                      </div>
                      <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-amber-400/10 text-amber-300">
                        <Music4 className="h-5 w-5" />
                      </div>
                    </div>

                    <audio controls preload="none" src={item.fileUrl} className="mt-4 w-full" />

                    <div className="mt-4 flex flex-wrap justify-end gap-2">
                      <Button type="button" variant="outline" className="rounded-2xl border-white/10 bg-white/5 text-slate-200 hover:bg-white/10" onClick={() => startEdit(item)}>
                        <Pencil className="me-2 h-4 w-4" />
                        {t("panelNutritionAudio.actions.edit")}
                      </Button>
                      <Button type="button" variant="outline" className="rounded-2xl border-rose-400/20 bg-rose-400/10 text-rose-100 hover:bg-rose-400/20" disabled={deletingId === item.id} onClick={() => void remove(item.id)}>
                        {deletingId === item.id ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Trash2 className="me-2 h-4 w-4" />}
                        {t("panelNutritionAudio.actions.delete")}
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
