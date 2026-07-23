import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, ImagePlus, LayoutDashboard, Loader2, UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";
import { getInitialTenantMeta } from "@/lib/bootstrap";
import { clearStorefrontCache } from "@/lib/storefront-cache";
import type { StoreHomeSettings } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { useLocale, useT } from "@/i18n/locale";
import type { MessageKey } from "@/i18n/messages";

type ToggleableStoreHomeSettingsKey =
  | "showCategories"
  | "showBestsellers"
  | "showGraphicBanner"
  | "showPopularProducts"
  | "showLatestProducts"
  | "showFaq"
  | "showBannerOnMainSite"
  | "preferStoreAsDefaultLanding"
  | "showBookingEntryOnStore";

const OPTIONS: Array<{
  key: ToggleableStoreHomeSettingsKey;
  titleKey: MessageKey;
  descriptionKey: MessageKey;
}> = [
  {
    key: "showCategories",
    titleKey: "panelStoreHome.options.showCategories.title",
    descriptionKey: "panelStoreHome.options.showCategories.description",
  },
  {
    key: "showBestsellers",
    titleKey: "panelStoreHome.options.showBestsellers.title",
    descriptionKey: "panelStoreHome.options.showBestsellers.description",
  },
  {
    key: "showGraphicBanner",
    titleKey: "panelStoreHome.options.showGraphicBanner.title",
    descriptionKey: "panelStoreHome.options.showGraphicBanner.description",
  },
  {
    key: "showPopularProducts",
    titleKey: "panelStoreHome.options.showPopularProducts.title",
    descriptionKey: "panelStoreHome.options.showPopularProducts.description",
  },
  {
    key: "showLatestProducts",
    titleKey: "panelStoreHome.options.showLatestProducts.title",
    descriptionKey: "panelStoreHome.options.showLatestProducts.description",
  },
  {
    key: "showFaq",
    titleKey: "panelStoreHome.options.showFaq.title",
    descriptionKey: "panelStoreHome.options.showFaq.description",
  },
  {
    key: "showBannerOnMainSite",
    titleKey: "panelStoreHome.options.showBannerOnMainSite.title",
    descriptionKey: "panelStoreHome.options.showBannerOnMainSite.description",
  },
  {
    key: "preferStoreAsDefaultLanding",
    titleKey: "panelStoreHome.options.preferStoreAsDefaultLanding.title",
    descriptionKey: "panelStoreHome.options.preferStoreAsDefaultLanding.description",
  },
  {
    key: "showBookingEntryOnStore",
    titleKey: "panelStoreHome.options.showBookingEntryOnStore.title",
    descriptionKey: "panelStoreHome.options.showBookingEntryOnStore.description",
  },
];

const defaultSettings: StoreHomeSettings = {
  showCategories: true,
  showBestsellers: true,
  showGraphicBanner: true,
  showPopularProducts: true,
  showLatestProducts: true,
  showFaq: true,
  showBannerOnMainSite: false,
  preferStoreAsDefaultLanding: false,
  showBookingEntryOnStore: false,
  mainSiteBannerImageUrl: null,
  mainSiteBannerTitle: null,
  mainSiteBannerDescription: null,
  graphicBannerImageUrl: null,
  graphicBannerBadge: null,
  graphicBannerTitle: null,
  graphicBannerDescription: null,
  graphicBannerButtonLabel: null,
  graphicBannerLink: null,
};

export default function PanelStoreSettingsHomePage() {
  const tenantMeta = getInitialTenantMeta();
  const { toast } = useToast();
  const { dir, isRtl } = useLocale();
  const t = useT();
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<ToggleableStoreHomeSettingsKey | null>(null);
  const [settings, setSettings] = useState<StoreHomeSettings>(defaultSettings);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [bannerSaving, setBannerSaving] = useState(false);
  const [removeBanner, setRemoveBanner] = useState(false);
  const [graphicBannerFile, setGraphicBannerFile] = useState<File | null>(null);
  const [graphicBannerPreview, setGraphicBannerPreview] = useState<string | null>(null);
  const [graphicBannerSaving, setGraphicBannerSaving] = useState(false);
  const [removeGraphicBanner, setRemoveGraphicBanner] = useState(false);

  useEffect(() => {
    api.store.getHomeSettings().then((res) => {
      if (res.success) {
        setSettings(res.data);
      }

      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!bannerFile) {
      return;
    }

    const objectUrl = URL.createObjectURL(bannerFile);
    setBannerPreview(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [bannerFile]);

  useEffect(() => {
    if (!graphicBannerFile) {
      return;
    }

    const objectUrl = URL.createObjectURL(graphicBannerFile);
    setGraphicBannerPreview(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [graphicBannerFile]);

  const currentBannerUrl = useMemo(() => {
    if (removeBanner) {
      return null;
    }

    return bannerPreview || settings.mainSiteBannerImageUrl || null;
  }, [bannerPreview, removeBanner, settings.mainSiteBannerImageUrl]);

  const currentGraphicBannerUrl = useMemo(() => {
    if (removeGraphicBanner) {
      return null;
    }

    return graphicBannerPreview || settings.graphicBannerImageUrl || null;
  }, [graphicBannerPreview, removeGraphicBanner, settings.graphicBannerImageUrl]);

  const handleToggle = async (key: ToggleableStoreHomeSettingsKey, checked: boolean) => {
    const nextState = { ...settings, [key]: checked };
    setSettings(nextState);
    setSavingKey(key);

    const res = await api.store.updateHomeSettings(nextState);

    setSavingKey(null);

    if (!res.success) {
      setSettings(settings);
      toast({
        variant: "destructive",
        title: t("panelStoreHome.toast.saveFailed"),
        description: res.message || t("panelStoreHome.toast.settingsFailed"),
      });
      return;
    }

    toast({
      title: t("panelStoreHome.toast.settingsSaved"),
      description: t("panelStoreHome.toast.settingsSavedDescription"),
    });
  };

  const handleBannerSave = async () => {
    setBannerSaving(true);

    const res = await api.store.updateHomeBanner({
      showBannerOnMainSite: settings.showBannerOnMainSite,
      image: bannerFile,
      removeImage: removeBanner,
      mainSiteBannerTitle: settings.mainSiteBannerTitle || "",
      mainSiteBannerDescription: settings.mainSiteBannerDescription || "",
    });

    setBannerSaving(false);

    if (!res.success) {
      toast({
        variant: "destructive",
        title: t("panelStoreHome.toast.saveFailed"),
        description: res.message || t("panelStoreHome.toast.mainBannerFailed"),
      });
      return;
    }

    setSettings(res.data);
    setBannerFile(null);
    setBannerPreview(null);
    setRemoveBanner(false);
    toast({
      title: t("panelStoreHome.toast.bannerSaved"),
      description: t("panelStoreHome.toast.mainBannerSavedDescription"),
    });
  };

  const handleGraphicBannerSave = async () => {
    setGraphicBannerSaving(true);

    const res = await api.store.updateHomeBanner({
      graphicBannerImage: graphicBannerFile,
      removeGraphicBannerImage: removeGraphicBanner,
      graphicBannerBadge: settings.graphicBannerBadge || "",
      graphicBannerTitle: settings.graphicBannerTitle || "",
      graphicBannerDescription: settings.graphicBannerDescription || "",
      graphicBannerButtonLabel: settings.graphicBannerButtonLabel || "",
      graphicBannerLink: settings.graphicBannerLink || "",
    });

    setGraphicBannerSaving(false);

    if (!res.success) {
      toast({
        variant: "destructive",
        title: t("panelStoreHome.toast.saveFailed"),
        description: res.message || t("panelStoreHome.toast.graphicBannerFailed"),
      });
      return;
    }

    setSettings(res.data);
    setGraphicBannerFile(null);
    setGraphicBannerPreview(null);
    setRemoveGraphicBanner(false);
    toast({
      title: t("panelStoreHome.toast.bannerSaved"),
      description: t("panelStoreHome.toast.graphicBannerSavedDescription"),
    });
  };

  const handleClearStorefrontCache = () => {
    clearStorefrontCache(tenantMeta);
    toast({
      title: t("panelStoreHome.toast.cacheCleared"),
      description: t("panelStoreHome.toast.cacheClearedDescription"),
    });
  };

  return (
    <div className="min-h-screen bg-background pb-20 text-foreground" dir={dir}>
      <div className="absolute inset-x-0 top-0 -z-10 h-[320px] bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.16),_transparent_40%),linear-gradient(180deg,rgba(24,35,61,0.96),rgba(15,23,42,0))]" />

      <header className="sticky top-0 z-10 border-b border-border/70 bg-card/80 backdrop-blur-md">
        <div className="container mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div className="space-y-1">
            <div className="text-sm text-primary">{t("panelStoreHome.eyebrow")}</div>
            <h1 className="text-2xl font-black">{t("panelStoreHome.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("panelStoreHome.description")}</p>
          </div>

          <Link href="/panel/store-settings/general">
            <Button variant="outline" size="icon" title={t("common.back")} className="h-11 w-11 rounded-2xl border-border bg-background/40 hover:bg-background/70">
              <ArrowRight className={`h-5 w-5 ${isRtl ? "" : "rotate-180"}`} />
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-5xl space-y-5 px-4 py-6">
        {loading ? (
          <div className="flex h-56 items-center justify-center rounded-[30px] border border-border/70 bg-card/50 text-muted-foreground">
            <Loader2 className="me-2 h-5 w-5 animate-spin" />
            {t("panelStoreHome.loading")}
          </div>
        ) : (
          <>
            <Card className="border-border/70 bg-card/60">
              <CardContent className="space-y-3 p-5 sm:p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                    <LayoutDashboard className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-xl font-black">{t("panelStoreHome.controls.title")}</h2>
                    <p className="text-sm text-muted-foreground">
                      {t("panelStoreHome.controls.description")}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-border/70 bg-background/25 p-4">
                  <div className="space-y-1">
                    <div className="font-bold">{t("panelStoreHome.cache.title")}</div>
                    <div className="text-sm text-muted-foreground">
                      {t("panelStoreHome.cache.description")}
                    </div>
                  </div>
                  <Button type="button" variant="outline" className="rounded-2xl" onClick={handleClearStorefrontCache}>
                    {t("panelStoreHome.cache.clear")}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              {OPTIONS.map((option) => (
                <Card key={option.key} className="border-border/70 bg-card/60">
                  <CardContent className="space-y-4 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="font-black">{t(option.titleKey)}</div>
                        <div className="text-sm leading-7 text-muted-foreground">{t(option.descriptionKey)}</div>
                      </div>
                      <div className="flex min-w-[94px] items-center justify-end gap-2 rounded-[18px] border border-border/70 bg-background/35 px-3 py-2">
                        {savingKey === option.key ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : null}
                        <Switch
                          checked={settings[option.key]}
                          onCheckedChange={(checked) => handleToggle(option.key, checked)}
                          disabled={savingKey === option.key}
                        />
                      </div>
                    </div>

                    <div className={`rounded-[20px] border px-4 py-3 text-sm ${settings[option.key] ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300" : "border-amber-500/20 bg-amber-500/10 text-amber-300"}`}>
                      {settings[option.key] ? t("panelStoreHome.optionState.visible") : t("panelStoreHome.optionState.hidden")}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {settings.showGraphicBanner && (
              <Card className="border-border/70 bg-card/60">
                <CardContent className="space-y-5 p-5 sm:p-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                      <ImagePlus className="h-6 w-6" />
                    </div>
                    <div className="space-y-1">
                      <h2 className="text-xl font-black">{t("panelStoreHome.graphicBanner.title")}</h2>
                      <p className="text-sm text-muted-foreground">
                        {t("panelStoreHome.graphicBanner.description")}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
                    <div className="space-y-4">
                      <div className="rounded-[1.5rem] border border-dashed border-primary/25 bg-background/25 p-4">
                        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-[1.25rem] border border-border/70 bg-background/35 px-4 py-4 transition hover:border-primary/40 hover:bg-background/50">
                          <div className="space-y-1 text-start">
                            <div className="font-bold">{t("panelStoreHome.graphicBanner.uploadTitle")}</div>
                            <div className="text-sm text-muted-foreground">
                              {t("panelStoreHome.graphicBanner.uploadDescription")}
                            </div>
                          </div>
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                            <UploadCloud className="h-5 w-5" />
                          </div>
                          <input
                            type="file"
                            accept=".jpg,.jpeg,.png,.gif,.webp,.avif,image/jpeg,image/png,image/gif,image/webp,image/avif"
                            className="hidden"
                            onChange={(event) => {
                              const file = event.target.files?.[0] || null;
                              setGraphicBannerFile(file);
                              setRemoveGraphicBanner(false);
                            }}
                          />
                        </label>
                      </div>

                      <div className="grid gap-3 rounded-[1.25rem] border border-border/70 bg-background/20 p-4">
                        <div className="space-y-2">
                          <div className="text-sm font-bold">{t("panelStoreHome.graphicBanner.badgeLabel")}</div>
                          <Input
                            value={settings.graphicBannerBadge || ""}
                            onChange={(event) =>
                              setSettings((current) => ({
                                ...current,
                                graphicBannerBadge: event.target.value,
                              }))
                            }
                            placeholder={t("panelStoreHome.graphicBanner.badgePlaceholder")}
                          />
                        </div>
                        <div className="space-y-2">
                          <div className="text-sm font-bold">{t("panelStoreHome.graphicBanner.titleLabel")}</div>
                          <Input
                            value={settings.graphicBannerTitle || ""}
                            onChange={(event) =>
                              setSettings((current) => ({
                                ...current,
                                graphicBannerTitle: event.target.value,
                              }))
                            }
                            placeholder={t("panelStoreHome.graphicBanner.titlePlaceholder")}
                          />
                        </div>
                        <div className="space-y-2">
                          <div className="text-sm font-bold">{t("panelStoreHome.graphicBanner.descriptionLabel")}</div>
                          <Textarea
                            value={settings.graphicBannerDescription || ""}
                            onChange={(event) =>
                              setSettings((current) => ({
                                ...current,
                                graphicBannerDescription: event.target.value,
                              }))
                            }
                            rows={4}
                            placeholder={t("panelStoreHome.graphicBanner.descriptionPlaceholder")}
                          />
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="space-y-2">
                            <div className="text-sm font-bold">{t("panelStoreHome.graphicBanner.buttonLabel")}</div>
                            <Input
                              value={settings.graphicBannerButtonLabel || ""}
                              onChange={(event) =>
                                setSettings((current) => ({
                                  ...current,
                                  graphicBannerButtonLabel: event.target.value,
                                }))
                              }
                              placeholder={t("panelStoreHome.graphicBanner.buttonPlaceholder")}
                            />
                          </div>
                          <div className="space-y-2">
                            <div className="text-sm font-bold">{t("panelStoreHome.graphicBanner.linkLabel")}</div>
                            <Input
                              value={settings.graphicBannerLink || ""}
                              onChange={(event) =>
                                setSettings((current) => ({
                                  ...current,
                                  graphicBannerLink: event.target.value,
                                }))
                              }
                              placeholder={t("panelStoreHome.graphicBanner.linkPlaceholder")}
                              dir="ltr"
                              className="text-start"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        {settings.graphicBannerImageUrl && !removeGraphicBanner && (
                          <Button
                            type="button"
                            variant="outline"
                            className="rounded-2xl"
                            onClick={() => {
                              setRemoveGraphicBanner(true);
                              setGraphicBannerFile(null);
                              setGraphicBannerPreview(null);
                            }}
                          >
                            <X className="me-2 h-4 w-4" />
                            {t("panelStoreHome.graphicBanner.removeCurrent")}
                          </Button>
                        )}

                        <Button
                          type="button"
                          className="rounded-2xl"
                          disabled={graphicBannerSaving}
                          onClick={handleGraphicBannerSave}
                        >
                          {graphicBannerSaving ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
                          {t("panelStoreHome.graphicBanner.save")}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="text-sm font-bold">{t("panelStoreHome.graphicBanner.previewTitle")}</div>
                      <div className="overflow-hidden rounded-[2rem] border border-border/70 bg-background/25">
                        {currentGraphicBannerUrl ? (
                          <img src={currentGraphicBannerUrl} alt={t("panelStoreHome.graphicBanner.previewAlt")} className="h-56 w-full object-cover" />
                        ) : (
                          <div className="flex h-56 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
                            <ImagePlus className="h-7 w-7 text-primary/70" />
                            {t("panelStoreHome.graphicBanner.emptyImage")}
                          </div>
                        )}
                      </div>
                      <div className="rounded-[1.5rem] border border-border/70 bg-background/25 p-4 text-start">
                        <div className="space-y-2">
                          <div className="text-xs font-semibold text-primary">
                            {settings.graphicBannerBadge || t("panelStoreHome.graphicBanner.previewBadgeFallback")}
                          </div>
                          <div className="text-lg font-black text-foreground">
                            {settings.graphicBannerTitle || t("panelStoreHome.graphicBanner.previewTitleFallback")}
                          </div>
                          <div className="text-sm leading-7 text-muted-foreground">
                            {settings.graphicBannerDescription || t("panelStoreHome.graphicBanner.previewDescriptionFallback")}
                          </div>
                          {settings.graphicBannerButtonLabel ? (
                            <div className="inline-flex rounded-2xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
                              {settings.graphicBannerButtonLabel}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {settings.showBannerOnMainSite && (
              <Card className="border-border/70 bg-card/60">
                <CardContent className="space-y-5 p-5 sm:p-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                      <ImagePlus className="h-6 w-6" />
                    </div>
                    <div className="space-y-1">
                      <h2 className="text-xl font-black">{t("panelStoreHome.mainBanner.title")}</h2>
                      <p className="text-sm text-muted-foreground">
                        {t("panelStoreHome.mainBanner.description")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("panelStoreHome.mainBanner.activationHint")}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
                    <div className="space-y-4">
                      <div className="rounded-[1.5rem] border border-dashed border-primary/25 bg-background/25 p-4">
                        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-[1.25rem] border border-border/70 bg-background/35 px-4 py-4 transition hover:border-primary/40 hover:bg-background/50">
                          <div className="space-y-1 text-start">
                            <div className="font-bold">{t("panelStoreHome.mainBanner.uploadTitle")}</div>
                            <div className="text-sm text-muted-foreground">
                              {t("panelStoreHome.mainBanner.uploadDescription")}
                            </div>
                          </div>
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                            <UploadCloud className="h-5 w-5" />
                          </div>
                          <input
                            type="file"
                            accept=".jpg,.jpeg,.png,.gif,.webp,.avif,image/jpeg,image/png,image/gif,image/webp,image/avif"
                            className="hidden"
                            onChange={(event) => {
                              const file = event.target.files?.[0] || null;
                              setBannerFile(file);
                              setRemoveBanner(false);
                            }}
                          />
                        </label>
                      </div>

                      <div className="grid gap-3 rounded-[1.25rem] border border-border/70 bg-background/20 p-4">
                        <div className="space-y-2">
                          <div className="text-sm font-bold">{t("panelStoreHome.mainBanner.titleLabel")}</div>
                          <Input
                            value={settings.mainSiteBannerTitle || ""}
                            onChange={(event) =>
                              setSettings((current) => ({
                                ...current,
                                mainSiteBannerTitle: event.target.value,
                              }))
                            }
                            placeholder={t("panelStoreHome.mainBanner.titlePlaceholder")}
                          />
                        </div>
                        <div className="space-y-2">
                          <div className="text-sm font-bold">{t("panelStoreHome.mainBanner.descriptionLabel")}</div>
                          <Textarea
                            value={settings.mainSiteBannerDescription || ""}
                            onChange={(event) =>
                              setSettings((current) => ({
                                ...current,
                                mainSiteBannerDescription: event.target.value,
                              }))
                            }
                            rows={3}
                            placeholder={t("panelStoreHome.mainBanner.descriptionPlaceholder")}
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        {settings.mainSiteBannerImageUrl && !removeBanner && (
                          <Button
                            type="button"
                            variant="outline"
                            className="rounded-2xl"
                            onClick={() => {
                              setRemoveBanner(true);
                              setBannerFile(null);
                              setBannerPreview(null);
                            }}
                          >
                            <X className="me-2 h-4 w-4" />
                            {t("panelStoreHome.mainBanner.removeCurrent")}
                          </Button>
                        )}

                        <Button
                          type="button"
                          className="rounded-2xl"
                          disabled={bannerSaving}
                          onClick={handleBannerSave}
                        >
                          {bannerSaving ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
                          {t("panelStoreHome.mainBanner.save")}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="text-sm font-bold">{t("panelStoreHome.mainBanner.previewTitle")}</div>
                      <div className="overflow-hidden rounded-[2rem] border border-border/70 bg-background/25">
                        {currentBannerUrl ? (
                          <img src={currentBannerUrl} alt={t("panelStoreHome.mainBanner.previewAlt")} className="h-56 w-full object-cover" />
                        ) : (
                          <div className="flex h-56 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
                            <ImagePlus className="h-7 w-7 text-primary/70" />
                            {t("panelStoreHome.mainBanner.emptyImage")}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  );
}
