import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Loader2, Plus, Search, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import type { NutritionAiPromptPreset } from "@/lib/types";
import { useFormat, useLocale, useT } from "@/i18n/locale";

type FormState = {
  title: string;
  body: string;
  sortOrder: string;
  isActive: boolean;
};

const emptyForm: FormState = {
  title: "",
  body: "",
  sortOrder: "0",
  isActive: true,
};

export default function PanelNutritionAiPromptPresetsPage() {
  const { toast } = useToast();
  const t = useT();
  const format = useFormat();
  const { dir, isRtl } = useLocale();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<NutritionAiPromptPreset[]>([]);
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const load = async () => {
    setLoading(true);
    const result = await api.nutritionAiPromptPresets.list();

    if (result.success) {
      setItems(result.data.items ?? []);
    } else {
      toast({ variant: "destructive", title: t("panelNutritionAiPromptPresets.toast.loadFailed"), description: result.message });
    }

    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const filteredItems = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) {
      return items;
    }

    return items.filter((item) => (`${item.title} ${item.body}`).toLowerCase().includes(keyword));
  }, [items, query]);

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const submit = async () => {
    if (!form.title.trim() || !form.body.trim()) {
      return;
    }

    setSaving(true);
    const payload = {
      title: form.title.trim(),
      body: form.body.trim(),
      sortOrder: Number(form.sortOrder) || 0,
      isActive: form.isActive,
    };

    const result = editingId
      ? await api.nutritionAiPromptPresets.update(editingId, payload)
      : await api.nutritionAiPromptPresets.create(payload);

    if (result.success) {
      toast({ title: editingId ? t("panelNutritionAiPromptPresets.toast.updated") : t("panelNutritionAiPromptPresets.toast.created") });
      resetForm();
      await load();
    } else {
      toast({ variant: "destructive", title: t("panelNutritionAiPromptPresets.toast.saveFailed"), description: result.message });
    }

    setSaving(false);
  };

  const removeItem = async (id: string) => {
    const result = await api.nutritionAiPromptPresets.remove(id);

    if (result.success) {
      toast({ title: t("panelNutritionAiPromptPresets.toast.deleted") });
      if (editingId === id) {
        resetForm();
      }
      await load();
    } else {
      toast({ variant: "destructive", title: t("panelNutritionAiPromptPresets.toast.deleteFailed"), description: result.message });
    }
  };

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-[#06131d] pb-24 text-white" dir={dir}>
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.16),transparent_22%),linear-gradient(180deg,rgba(6,19,29,0.97),rgba(4,10,17,1))]" />

      <header className="sticky top-0 z-20 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="space-y-1">
            <h1 className="text-xl font-bold">{t("panelNutritionAiPromptPresets.title")}</h1>
          </div>
          <Link href="/panel">
            <Button variant="outline" size="icon" title={t("panelNutritionAiPromptPresets.back")} className="h-10 w-10 rounded-2xl border-border bg-background/40 hover:bg-background/70">
              <ArrowRight className={`h-5 w-5 ${isRtl ? "rotate-180" : ""}`} />
            </Button>
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl space-y-5 px-4 py-6">
        <section className="grid gap-5 lg:grid-cols-[0.95fr,1.05fr]">
          <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(160deg,rgba(18,34,49,0.95),rgba(11,22,35,0.9))] p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-lg font-black">
                <Sparkles className="h-5 w-5 text-amber-300" />
                {editingId ? t("panelNutritionAiPromptPresets.form.editTitle") : t("panelNutritionAiPromptPresets.form.createTitle")}
              </div>
              {editingId ? (
                <Button type="button" variant="outline" className="rounded-[16px] border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]" onClick={resetForm}>
                  {t("panelNutritionAiPromptPresets.form.new")}
                </Button>
              ) : null}
            </div>

            <div className="mt-5 space-y-3">
              <Input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder={t("panelNutritionAiPromptPresets.form.titlePlaceholder")} className="border-white/10 bg-white/[0.04] text-white" />
              <Textarea value={form.body} onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))} placeholder={t("panelNutritionAiPromptPresets.form.bodyPlaceholder")} className="min-h-[260px] border-white/10 bg-white/[0.04] text-white" />
              <div className="grid gap-3 md:grid-cols-2">
                <Input dir="ltr" value={form.sortOrder} onChange={(event) => setForm((current) => ({ ...current, sortOrder: event.target.value }))} placeholder={t("panelNutritionAiPromptPresets.form.sortOrderPlaceholder")} className="border-white/10 bg-white/[0.04] text-white" />
                <button
                  type="button"
                  onClick={() => setForm((current) => ({ ...current, isActive: !current.isActive }))}
                  className={`rounded-[16px] border px-4 py-3 text-start ${form.isActive ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100" : "border-white/10 bg-white/[0.04] text-slate-300"}`}
                >
                  {form.isActive ? t("panelNutritionAiPromptPresets.status.active") : t("panelNutritionAiPromptPresets.status.inactive")}
                </button>
              </div>
              <Button type="button" disabled={saving || !form.title.trim() || !form.body.trim()} onClick={() => void submit()} className="h-12 w-full rounded-[18px] bg-amber-400 font-black text-slate-950">
                {saving ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Plus className="me-2 h-4 w-4" />}
                {editingId ? t("panelNutritionAiPromptPresets.form.save") : t("panelNutritionAiPromptPresets.form.submit")}
              </Button>
            </div>
          </div>

          <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(160deg,rgba(18,34,49,0.95),rgba(11,22,35,0.9))] p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="text-lg font-black">{t("panelNutritionAiPromptPresets.list.title")}</div>
              <Link href="/panel/nutrition/requests">
                <Button variant="outline" className="rounded-[16px] border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]">
                  {t("panelNutritionAiPromptPresets.backToRequests")}
                </Button>
              </Link>
            </div>

            <div className="relative mt-4">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("panelNutritionAiPromptPresets.searchPlaceholder")} className="border-white/10 bg-white/[0.04] ps-10 text-white" />
            </div>

            <div className="pretty-scrollbar mt-4 max-h-[540px] space-y-3 overflow-y-auto ps-1">
              {loading ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-8 text-center text-sm text-slate-300">
                  {t("common.loading")}
                </div>
              ) : filteredItems.length ? filteredItems.map((item) => (
                <div key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-black text-white">{item.title}</div>
                      <div className="mt-2 line-clamp-4 text-sm leading-7 text-slate-300 whitespace-pre-wrap">{item.body}</div>
                    </div>
                    <div className="space-y-2">
                      <div className={`rounded-full border px-2 py-1 text-[10px] font-black ${item.isActive ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100" : "border-white/10 bg-white/[0.04] text-slate-300"}`}>
                        {item.isActive ? t("panelNutritionAiPromptPresets.status.active") : t("panelNutritionAiPromptPresets.status.inactive")}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <div className="text-xs text-slate-400">{t("panelNutritionAiPromptPresets.list.sortOrder", { value: format.number(item.sortOrder) })}</div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-[14px] border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]"
                        onClick={() => {
                          setEditingId(item.id);
                          setForm({
                            title: item.title,
                            body: item.body,
                            sortOrder: String(item.sortOrder),
                            isActive: item.isActive,
                          });
                        }}
                      >
                        {t("panelNutritionAiPromptPresets.actions.edit")}
                      </Button>
                      <Button type="button" variant="outline" className="rounded-[14px] border-rose-300/20 bg-rose-300/10 text-rose-100 hover:bg-rose-300/15" onClick={() => void removeItem(item.id)}>
                        <Trash2 className="me-2 h-4 w-4" />
                        {t("panelNutritionAiPromptPresets.actions.delete")}
                      </Button>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-8 text-center text-sm text-slate-400">
                  {t("panelNutritionAiPromptPresets.list.empty")}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
