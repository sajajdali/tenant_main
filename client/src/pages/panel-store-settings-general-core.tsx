import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, ArrowRight, Loader2, MessageSquareText, Power, Store, ToggleLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";
import type { StoreGeneralSettings, StoreHomeSettings } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { useLocale } from "@/i18n/locale";

const defaultSettings: StoreGeneralSettings = {
  enabled: true,
  smsEnabled: false,
  smsTemplateAfterOrder: "",
  smsTemplateAfterApproval: "",
  smsTemplateAfterShippingCode: "",
  smsTemplateAfterRejection: "",
};

export default function PanelStoreSettingsGeneralCorePage() {
  const { toast } = useToast();
  const { dir, isRtl, t } = useLocale();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<StoreGeneralSettings>(defaultSettings);
  const [homeSettings, setHomeSettings] = useState<StoreHomeSettings | null>(null);
  const [mainSiteBannerSaving, setMainSiteBannerSaving] = useState(false);
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;

  useEffect(() => {
    Promise.all([api.store.getGeneralSettings(), api.store.getHomeSettings()]).then(([generalRes, homeRes]) => {
      if (generalRes.success) {
        setSettings(generalRes.data);
      }
      if (homeRes.success) {
        setHomeSettings(homeRes.data);
      }
      setLoading(false);
    });
  }, []);

  const persistSettings = async (nextSettings: StoreGeneralSettings, options?: { immediateMessage?: { title: string; description: string } }) => {
    setSaving(true);
    const previous = settings;
    setSettings(nextSettings);

    const res = await api.store.updateGeneralSettings(nextSettings);

    setSaving(false);

    if (!res.success) {
      setSettings(previous);
      toast({
        variant: "destructive",
        title: t("panelStore.generalCore.toast.saveFailedTitle"),
        description: res.message || t("panelStore.generalCore.toast.saveFailedDescription"),
      });
      return false;
    }

    setSettings(res.data);

    if (options?.immediateMessage) {
      toast({
        title: options.immediateMessage.title,
        description: options.immediateMessage.description,
      });
    }

    return true;
  };

  const handleStoreToggle = async (checked: boolean) => {
    await persistSettings(
      {
        ...settings,
        enabled: checked,
      },
      {
        immediateMessage: checked
          ? {
              title: t("panelStore.generalCore.toast.storeEnabledTitle"),
              description: t("panelStore.generalCore.toast.storeEnabledDescription"),
            }
          : {
              title: t("panelStore.generalCore.toast.storeDisabledTitle"),
              description: t("panelStore.generalCore.toast.storeDisabledDescription"),
            },
      },
    );
  };

  const handleMainSiteBannerToggle = async (checked: boolean) => {
    if (!homeSettings) {
      return;
    }

    const previous = homeSettings;
    const next = {
      ...homeSettings,
      showBannerOnMainSite: checked,
    };
    setHomeSettings(next);
    setMainSiteBannerSaving(true);

    const res = await api.store.updateHomeSettings(next);
    setMainSiteBannerSaving(false);

    if (!res.success) {
      setHomeSettings(previous);
      toast({
        variant: "destructive",
        title: t("panelStore.generalCore.toast.saveFailedTitle"),
        description: res.message || t("panelStore.generalCore.toast.mainSiteBannerSaveFailedDescription"),
      });
      return;
    }

    setHomeSettings(res.data);
    toast({
      title: checked ? t("panelStore.generalCore.toast.mainSiteBannerEnabledTitle") : t("panelStore.generalCore.toast.mainSiteBannerDisabledTitle"),
      description: checked
        ? t("panelStore.generalCore.toast.mainSiteBannerEnabledDescription")
        : t("panelStore.generalCore.toast.mainSiteBannerDisabledDescription"),
    });
  };

  return (
    <div className="min-h-screen bg-background pb-20 text-foreground" dir={dir}>
      <div className="absolute inset-x-0 top-0 -z-10 h-[320px] bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.16),_transparent_40%),linear-gradient(180deg,rgba(24,35,61,0.96),rgba(15,23,42,0))]" />

      <header className="sticky top-0 z-10 border-b border-border/70 bg-card/80 backdrop-blur-md">
        <div className="container mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div className="space-y-1">
            <div className="text-sm text-primary">{t("panelStore.generalCore.eyebrow")}</div>
            <h1 className="text-2xl font-black">{t("panelStore.generalCore.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("panelStore.generalCore.description")}</p>
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
            {t("panelStore.generalCore.loading")}
          </div>
        ) : (
          <>
            <Card className="border-border/70 bg-card/60">
              <CardContent className="space-y-6 p-5 sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-[22px] border border-primary/20 bg-primary/10 text-primary">
                      <Store className="h-6 w-6" />
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-xl font-black">{t("panelStore.generalCore.storeStatus.title")}</h2>
                      <p className="max-w-2xl text-sm leading-8 text-muted-foreground">
                        {t("panelStore.generalCore.storeStatus.description")}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 rounded-[24px] border border-border/70 bg-background/35 px-4 py-3">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <ToggleLeft className="h-4 w-4 text-primary" />}
                    <div className="text-sm font-bold">{settings.enabled ? t("panelStore.generalCore.status.active") : t("panelStore.generalCore.status.inactive")}</div>
                    <Switch checked={settings.enabled} onCheckedChange={handleStoreToggle} disabled={saving} />
                  </div>
                </div>

                <div className={`rounded-[26px] border p-5 ${settings.enabled ? "border-emerald-500/20 bg-emerald-500/10" : "border-amber-500/20 bg-amber-500/10"}`}>
                  <div className="mb-2 flex items-center gap-2 font-bold">
                    <Power className={`h-4 w-4 ${settings.enabled ? "text-emerald-300" : "text-amber-300"}`} />
                    {settings.enabled ? t("panelStore.generalCore.storeStatus.enabledTitle") : t("panelStore.generalCore.storeStatus.disabledTitle")}
                  </div>
                  <div className="text-sm leading-7 text-muted-foreground">
                    {settings.enabled
                      ? t("panelStore.generalCore.storeStatus.enabledDescription")
                      : t("panelStore.generalCore.storeStatus.disabledDescription")}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/60">
              <CardContent className="space-y-6 p-5 sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-[22px] border border-primary/20 bg-primary/10 text-primary">
                      <Store className="h-6 w-6" />
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-xl font-black">{t("panelStore.generalCore.mainSiteBanner.title")}</h2>
                      <p className="max-w-2xl text-sm leading-8 text-muted-foreground">
                        {t("panelStore.generalCore.mainSiteBanner.description")}
                      </p>
                      <p className="text-xs leading-6 text-muted-foreground">
                        {t("panelStore.generalCore.mainSiteBanner.hint")}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 rounded-[24px] border border-border/70 bg-background/35 px-4 py-3">
                    {mainSiteBannerSaving ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <ToggleLeft className="h-4 w-4 text-primary" />}
                    <div className="text-sm font-bold">{homeSettings?.showBannerOnMainSite ? t("panelStore.generalCore.status.active") : t("panelStore.generalCore.status.inactive")}</div>
                    <Switch
                      checked={homeSettings?.showBannerOnMainSite ?? false}
                      onCheckedChange={handleMainSiteBannerToggle}
                      disabled={mainSiteBannerSaving || !homeSettings}
                    />
                  </div>
                </div>

                <div className={`rounded-[26px] border p-5 ${homeSettings?.showBannerOnMainSite ? "border-emerald-500/20 bg-emerald-500/10" : "border-amber-500/20 bg-amber-500/10"}`}>
                  <div className="mb-2 flex items-center gap-2 font-bold">
                    <Power className={`h-4 w-4 ${homeSettings?.showBannerOnMainSite ? "text-emerald-300" : "text-amber-300"}`} />
                    {homeSettings?.showBannerOnMainSite ? t("panelStore.generalCore.mainSiteBanner.enabledTitle") : t("panelStore.generalCore.mainSiteBanner.disabledTitle")}
                  </div>
                  <div className="text-sm leading-7 text-muted-foreground">
                    {homeSettings?.showBannerOnMainSite
                      ? t("panelStore.generalCore.mainSiteBanner.enabledDescription")
                      : t("panelStore.generalCore.mainSiteBanner.disabledDescription")}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/60">
              <CardContent className="space-y-6 p-5 sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-[22px] border border-primary/20 bg-primary/10 text-primary">
                      <MessageSquareText className="h-6 w-6" />
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-xl font-black">{t("panelStore.generalCore.sms.title")}</h2>
                      <p className="max-w-2xl text-sm leading-8 text-muted-foreground">
                        {t("panelStore.generalCore.sms.description")}
                      </p>
                    </div>
                  </div>

                  <Link href="/panel/sms-settings">
                    <Button variant="outline" className="rounded-[18px] border-border bg-background/40">
                      {t("panelStore.generalCore.sms.manage")}
                    </Button>
                  </Link>
                </div>

                <div className="rounded-[26px] border border-dashed border-border/70 bg-background/25 p-5 text-sm leading-7 text-muted-foreground">
                  {t("panelStore.generalCore.sms.centralizedNote")}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
