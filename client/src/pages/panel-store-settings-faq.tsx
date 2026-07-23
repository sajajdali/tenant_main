import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, ArrowRight, HelpCircle, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import type { StoreFaqItem } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { useLocale } from "@/i18n/locale";

const createFaqItem = (): StoreFaqItem => ({
  id: `faq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  question: "",
  answer: "",
});

export default function PanelStoreSettingsFaqPage() {
  const { toast } = useToast();
  const { dir, isRtl, t, format } = useLocale();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<StoreFaqItem[]>([]);
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;

  useEffect(() => {
    api.store.getFaqSettings().then((res) => {
      if (res.success) {
        setItems(res.data.items);
      }

      setLoading(false);
    });
  }, []);

  const updateItem = (id: string, key: "question" | "answer", value: string) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, [key]: value } : item)));
  };

  const handleAdd = () => {
    setItems((current) => [...current, createFaqItem()]);
  };

  const handleRemove = (id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  };

  const handleSave = async () => {
    const normalized = items.map((item) => ({
      ...item,
      question: item.question.trim(),
      answer: item.answer.trim(),
    }));

    if (normalized.some((item) => item.question === "" || item.answer === "")) {
      toast({
        variant: "destructive",
        title: t("panelStore.faq.toast.incompleteTitle"),
        description: t("panelStore.faq.toast.incompleteDescription"),
      });
      return;
    }

    setSaving(true);
    const res = await api.store.updateFaqSettings({ items: normalized });
    setSaving(false);

    if (!res.success) {
      toast({
        variant: "destructive",
        title: t("panelStore.faq.toast.saveFailedTitle"),
        description: res.message || t("panelStore.faq.toast.saveFailedDescription"),
      });
      return;
    }

    setItems(res.data.items);
    toast({
      title: t("panelStore.faq.toast.savedTitle"),
      description: t("panelStore.faq.toast.savedDescription"),
    });
  };

  return (
    <div className="min-h-screen bg-background pb-20 text-foreground" dir={dir}>
      <div className="absolute inset-x-0 top-0 -z-10 h-[320px] bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.16),_transparent_40%),linear-gradient(180deg,rgba(24,35,61,0.96),rgba(15,23,42,0))]" />

      <header className="sticky top-0 z-10 border-b border-border/70 bg-card/80 backdrop-blur-md">
        <div className="container mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div className="space-y-1">
            <div className="text-sm text-primary">{t("panelStore.faq.eyebrow")}</div>
            <h1 className="text-2xl font-black">{t("panelStore.faq.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("panelStore.faq.description")}</p>
          </div>

          <Link href="/panel/store-settings/general">
            <Button variant="outline" size="icon" title={t("panelStore.shell.back")} className="h-11 w-11 rounded-2xl border-border bg-background/40 hover:bg-background/70">
              <BackIcon className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-5xl space-y-5 px-4 py-6">
        {loading ? (
          <div className="flex h-56 items-center justify-center rounded-[30px] border border-border/70 bg-card/50 text-muted-foreground">
            <Loader2 className="me-2 h-5 w-5 animate-spin" />
            {t("panelStore.faq.loading")}
          </div>
        ) : (
          <>
            <Card className="border-border/70 bg-card/60">
              <CardContent className="space-y-5 p-5 sm:p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-[22px] border border-primary/20 bg-primary/10 text-primary">
                      <HelpCircle className="h-6 w-6" />
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-xl font-black">{t("panelStore.faq.managerTitle")}</h2>
                      <p className="max-w-2xl text-sm leading-8 text-muted-foreground">
                        {t("panelStore.faq.managerDescription")}
                      </p>
                    </div>
                  </div>

                  <Button type="button" className="rounded-[20px] px-5" onClick={handleAdd}>
                    <Plus className="me-2 h-4 w-4" />
                    {t("panelStore.faq.add")}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              {items.length === 0 ? (
                <Card className="border-dashed border-border/70 bg-card/40">
                  <CardContent className="space-y-3 p-6 text-center">
                    <div className="text-lg font-black">{t("panelStore.faq.emptyTitle")}</div>
                    <p className="text-sm leading-7 text-muted-foreground">{t("panelStore.faq.emptyDescription")}</p>
                  </CardContent>
                </Card>
              ) : (
                items.map((item, index) => (
                  <Card key={item.id} className="border-border/70 bg-card/60">
                    <CardContent className="space-y-4 p-5 sm:p-6">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-bold text-primary">{t("panelStore.faq.itemTitle", { number: format.number(index + 1) })}</div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 rounded-2xl text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => handleRemove(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="space-y-2">
                        <div className="text-sm font-bold">{t("panelStore.faq.questionLabel")}</div>
                        <Input
                          value={item.question}
                          onChange={(e) => updateItem(item.id, "question", e.target.value)}
                          placeholder={t("panelStore.faq.questionPlaceholder")}
                          className="h-12 rounded-[18px]"
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="text-sm font-bold">{t("panelStore.faq.answerLabel")}</div>
                        <Textarea
                          value={item.answer}
                          onChange={(e) => updateItem(item.id, "answer", e.target.value)}
                          placeholder={t("panelStore.faq.answerPlaceholder")}
                          className="min-h-[140px] rounded-[20px]"
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>

            <div className="flex justify-end">
              <Button type="button" className="rounded-[20px] px-6" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
                {t("panelStore.faq.save")}
              </Button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
