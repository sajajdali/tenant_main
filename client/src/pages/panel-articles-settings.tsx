import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, BookOpenText, Loader2, Menu, Newspaper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { getAudienceLabels } from "@/lib/audience";
import { getInitialTenantMeta } from "@/lib/bootstrap";
import type { ArticleSectionSettings, TenantMeta } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { SupportExpiredLock } from "@/components/support-expired-lock";
import { useLocale, useT } from "@/i18n/locale";

const defaultSettings: ArticleSectionSettings = {
  enabled: false,
  showInMenu: false,
};

export default function PanelArticlesSettingsPage() {
  const { isAdmin, isPrimaryAdmin } = useAuth();
  const { toast } = useToast();
  const t = useT();
  const { dir, isRtl } = useLocale();
  const [tenantMeta, setTenantMeta] = useState<TenantMeta | null>(() => getInitialTenantMeta());
  const [settings, setSettings] = useState<ArticleSectionSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<keyof ArticleSectionSettings | null>(null);
  const labels = getAudienceLabels(tenantMeta);

  useEffect(() => {
    Promise.all([api.articles.settings(), api.meta.get()]).then(([settingsRes, metaRes]) => {
      if (settingsRes.success) {
        setSettings(settingsRes.data);
      }

      if (metaRes.success) {
        setTenantMeta(metaRes.data);
      }

      setLoading(false);
    });
  }, []);

  if (!isPrimaryAdmin) {
    return null;
  }

  if (tenantMeta?.supportExpired) {
    return <SupportExpiredLock businessLabel={labels.business} isAdmin={isAdmin} />;
  }

  const handleToggle = async (key: keyof ArticleSectionSettings, checked: boolean) => {
    const previousState = settings;
    const nextState = { ...settings, [key]: checked };
    setSettings(nextState);
    setSavingKey(key);

    const res = await api.articles.updateSettings(nextState);
    setSavingKey(null);

    if (!res.success) {
      setSettings(previousState);
      toast({
        variant: "destructive",
        title: t("panelArticlesSettings.toast.saveFailed"),
        description: res.message || t("panelArticlesSettings.toast.saveFailedDescription"),
      });
      return;
    }

    setSettings(res.data);
    setTenantMeta((current) => (current ? { ...current, articlesSettings: res.data } : current));
    toast({
      title: t("panelArticlesSettings.toast.saved"),
      description: key === "enabled"
        ? checked
          ? t("panelArticlesSettings.toast.enabled")
          : t("panelArticlesSettings.toast.disabled")
        : checked
          ? t("panelArticlesSettings.toast.menuEnabled")
          : t("panelArticlesSettings.toast.menuDisabled"),
    });
  };

  return (
    <div className="panel-article-settings-page min-h-screen bg-background pb-20 text-foreground" dir={dir}>
      <div className="panel-article-settings-glow absolute inset-x-0 top-0 -z-10 h-[320px] bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.16),_transparent_40%),linear-gradient(180deg,rgba(24,35,61,0.96),rgba(15,23,42,0))]" />

      <header className="panel-article-settings-header sticky top-0 z-10 border-b border-border/70 bg-card/80 backdrop-blur-md">
        <div className="container mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div className="space-y-1">
            <div className="text-sm text-primary">{t("panelArticlesSettings.eyebrow")}</div>
            <h1 className="text-2xl font-black">{t("panelArticlesSettings.title")}</h1>
          </div>

          <Link href="/panel/articles">
            <Button variant="outline" size="icon" title={t("panelArticlesSettings.back")} className="h-11 w-11 rounded-2xl border-border bg-background/40 hover:bg-background/70">
              <ArrowRight className={`h-5 w-5 ${isRtl ? "rotate-180" : ""}`} />
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-5xl space-y-5 px-4 py-6">
        {loading ? (
          <div className="flex h-56 items-center justify-center rounded-[30px] border border-border/70 bg-card/50 text-muted-foreground">
            <Loader2 className="me-2 h-5 w-5 animate-spin" />
            {t("panelArticlesSettings.loading")}
          </div>
        ) : (
          <>
            <Card className="article-settings-intro border-border/70 bg-card/60">
              <CardContent className="space-y-3 p-5 sm:p-6">
                <div className="flex items-center gap-3">
                  <div className="article-settings-icon flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                    <BookOpenText className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-xl font-black">{t("panelArticlesSettings.intro.title")}</h2>
                    <p className="text-sm text-muted-foreground">{t("panelArticlesSettings.intro.description")}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              <Card className="article-settings-option-card article-settings-option-card--enabled border-border/70 bg-gradient-to-br from-[#123a56]/90 via-card to-card">
                <CardContent className="space-y-4 p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-lg font-black">
                        <Newspaper className="h-5 w-5 text-primary" />
                        {t("panelArticlesSettings.enabled.title")}
                      </div>
                      <p className="text-sm leading-7 text-muted-foreground">{t("panelArticlesSettings.enabled.description")}</p>
                    </div>
                    <div className="article-settings-switch-shell flex min-w-[94px] items-center justify-end gap-2 rounded-[18px] border border-border/70 bg-background/35 px-3 py-2">
                      {savingKey === "enabled" ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : null}
                      <Switch
                        checked={settings.enabled}
                        onCheckedChange={(checked) => handleToggle("enabled", checked)}
                        disabled={savingKey !== null}
                      />
                    </div>
                  </div>

                  <div className={`article-settings-status rounded-[20px] border px-4 py-3 text-sm ${settings.enabled ? "article-settings-status--success border-emerald-500/20 bg-emerald-500/10 text-emerald-300" : "article-settings-status--warning border-amber-500/20 bg-amber-500/10 text-amber-300"}`}>
                    {settings.enabled ? t("panelArticlesSettings.enabled.statusOn") : t("panelArticlesSettings.enabled.statusOff")}
                  </div>
                </CardContent>
              </Card>

              <Card className="article-settings-option-card article-settings-option-card--menu border-border/70 bg-gradient-to-br from-[#123f4f]/90 via-card to-card">
                <CardContent className="space-y-4 p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-lg font-black">
                        <Menu className="h-5 w-5 text-primary" />
                        {t("panelArticlesSettings.menu.title")}
                      </div>
                      <p className="text-sm leading-7 text-muted-foreground">{t("panelArticlesSettings.menu.description")}</p>
                    </div>
                    <div className="article-settings-switch-shell flex min-w-[94px] items-center justify-end gap-2 rounded-[18px] border border-border/70 bg-background/35 px-3 py-2">
                      {savingKey === "showInMenu" ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : null}
                      <Switch
                        checked={settings.showInMenu}
                        onCheckedChange={(checked) => handleToggle("showInMenu", checked)}
                        disabled={savingKey !== null}
                      />
                    </div>
                  </div>

                  <div className={`article-settings-status rounded-[20px] border px-4 py-3 text-sm ${settings.enabled && settings.showInMenu ? "article-settings-status--success border-emerald-500/20 bg-emerald-500/10 text-emerald-300" : "article-settings-status--neutral border-slate-400/15 bg-background/35 text-slate-300"}`}>
                    {settings.enabled && settings.showInMenu
                      ? t("panelArticlesSettings.menu.statusOn")
                      : t("panelArticlesSettings.menu.statusOff")}
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
