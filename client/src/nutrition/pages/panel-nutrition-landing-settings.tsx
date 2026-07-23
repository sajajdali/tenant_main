import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, ArrowRight, Check, ExternalLink, LayoutTemplate, Loader2, Save, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import type { NutritionLandingSettings } from "@/lib/types";
import {
  getNutritionBookingBannerSettings,
  getNutritionLandingVariantSettings,
  NUTRITION_BOOKING_BANNER_DEFAULT,
  NUTRITION_LANDING_DEFAULTS,
  NUTRITION_LANDING_FIELD_DEFS,
  NUTRITION_LANDING_VARIANTS,
  type NutritionLandingVariant,
} from "@/nutrition/lib/landing-presets";
import { getInitialTenantMeta } from "@/lib/bootstrap";
import { useLocale, useT } from "@/i18n/locale";
import type { MessageKey } from "@/i18n/messages";

function createDefaultState(): NutritionLandingSettings {
  return {
    available: true,
    preferAsDefault: false,
    activeVariant: "classic",
    variants: {
      classic: { ...NUTRITION_LANDING_DEFAULTS.classic },
      diet: { ...NUTRITION_LANDING_DEFAULTS.diet },
      all_features: { ...NUTRITION_LANDING_DEFAULTS.all_features },
      diet_priority: { ...NUTRITION_LANDING_DEFAULTS.diet_priority },
    },
    bookingBanner: { ...NUTRITION_BOOKING_BANNER_DEFAULT },
  };
}

export default function PanelNutritionLandingSettingsPage() {
  const t = useT();
  const { dir, isRtl } = useLocale();
  const { toast } = useToast();
  const tenantMeta = getInitialTenantMeta();
  const audienceSlug = tenantMeta?.audience?.slug || "";
  const isNutritionAudience = ["nutritionists", "nutrition-doctors"].includes(audienceSlug);

  const [settings, setSettings] = useState<NutritionLandingSettings>(createDefaultState);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<NutritionLandingVariant>("classic");
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [pendingBannerImage, setPendingBannerImage] = useState<File | null>(null);
  const [removeBannerImage, setRemoveBannerImage] = useState(false);

  useEffect(() => {
    if (!isNutritionAudience) {
      setLoading(false);
      return;
    }

    api.nutritionLanding.getSettings().then((res) => {
      if (res.success) {
        setSettings({
          available: true,
          preferAsDefault: res.data.preferAsDefault ?? false,
          activeVariant: res.data.activeVariant ?? "classic",
          variants: {
            classic: getNutritionLandingVariantSettings({ nutritionLanding: res.data } as never, "classic"),
            diet: getNutritionLandingVariantSettings({ nutritionLanding: res.data } as never, "diet"),
            all_features: getNutritionLandingVariantSettings({ nutritionLanding: res.data } as never, "all_features"),
            diet_priority: getNutritionLandingVariantSettings({ nutritionLanding: res.data } as never, "diet_priority"),
          },
          bookingBanner: getNutritionBookingBannerSettings({ nutritionLanding: res.data } as never),
        });
        setSelectedVariant(res.data.activeVariant ?? "classic");
      }
      setLoading(false);
    });
  }, [isNutritionAudience]);

  const selectedVariantMeta = useMemo(
    () => NUTRITION_LANDING_VARIANTS.find((item) => item.key === selectedVariant),
    [selectedVariant],
  );

  const selectedVariantSettings = settings.variants[selectedVariant] ?? NUTRITION_LANDING_DEFAULTS[selectedVariant];
  const getVariantLabel = (variant: NutritionLandingVariant) => t(`nutritionEntryLanding.variant.${variant}` as MessageKey);
  const getVariantDescription = (variant: NutritionLandingVariant) => t(`panelNutritionLandingSettings.variantDescription.${variant}` as MessageKey);
  const getFieldLabel = (variant: NutritionLandingVariant, key: string) => t(`panelNutritionLandingSettings.field.${variant}.${key}` as MessageKey);

  const updateField = (key: string, value: string) => {
    setSettings((current) => ({
      ...current,
      variants: {
        ...current.variants,
        [selectedVariant]: {
          ...(current.variants[selectedVariant] ?? NUTRITION_LANDING_DEFAULTS[selectedVariant]),
          content: {
            ...((current.variants[selectedVariant] ?? NUTRITION_LANDING_DEFAULTS[selectedVariant]).content),
            [key]: value,
          },
        },
      },
    }));
  };

  const updateBookingBannerField = (key: string, value: string) => {
    setSettings((current) => ({
      ...current,
      bookingBanner: {
        ...(current.bookingBanner ?? NUTRITION_BOOKING_BANNER_DEFAULT),
        content: {
          ...((current.bookingBanner ?? NUTRITION_BOOKING_BANNER_DEFAULT).content),
          [key]: value,
        },
      },
    }));
  };

  const handleSave = async () => {
    setSaving(true);

    const res = await api.nutritionLanding.updateSettings(settings);
    if (!res.success) {
      setSaving(false);
      toast({ variant: "destructive", title: t("common.error"), description: res.message || t("panelNutritionLandingSettings.toast.saveFailed") });
      return;
    }

    let nextPayload = res.data;

    if (pendingImage || removeImage) {
      const imageRes = await api.nutritionLanding.updateVariantImage(selectedVariant, {
        image: pendingImage,
        removeImage,
      });

      if (!imageRes.success) {
        setSaving(false);
        toast({ variant: "destructive", title: t("common.error"), description: imageRes.message || t("panelNutritionLandingSettings.toast.imageSaveFailed") });
        return;
      }

      nextPayload = imageRes.data;
    }

    if (pendingBannerImage || removeBannerImage) {
      const bannerImageRes = await api.nutritionLanding.updateBookingBannerImage({
        image: pendingBannerImage,
        removeImage: removeBannerImage,
      });

      if (!bannerImageRes.success) {
        setSaving(false);
        toast({ variant: "destructive", title: t("common.error"), description: bannerImageRes.message || t("panelNutritionLandingSettings.toast.bannerImageSaveFailed") });
        return;
      }

      nextPayload = bannerImageRes.data;
    }

    setSettings({
      available: true,
      preferAsDefault: nextPayload.preferAsDefault ?? false,
      activeVariant: nextPayload.activeVariant ?? "classic",
      variants: {
        classic: getNutritionLandingVariantSettings({ nutritionLanding: nextPayload } as never, "classic"),
        diet: getNutritionLandingVariantSettings({ nutritionLanding: nextPayload } as never, "diet"),
        all_features: getNutritionLandingVariantSettings({ nutritionLanding: nextPayload } as never, "all_features"),
        diet_priority: getNutritionLandingVariantSettings({ nutritionLanding: nextPayload } as never, "diet_priority"),
      },
      bookingBanner: getNutritionBookingBannerSettings({ nutritionLanding: nextPayload } as never),
    });
    setPendingImage(null);
    setRemoveImage(false);
    setPendingBannerImage(null);
    setRemoveBannerImage(false);
    setSaving(false);
    toast({ title: t("panelNutritionLandingSettings.toast.savedTitle"), description: t("panelNutritionLandingSettings.toast.savedDescription") });
  };

  if (!isNutritionAudience) {
    return (
      <div className="min-h-screen bg-background px-4 py-8 text-foreground" dir={dir}>
        <div className="mx-auto max-w-3xl">
          <Card className="border-border/70 bg-card/60">
            <CardHeader>
              <CardTitle>{t("panelNutritionLandingSettings.accessDenied.title")}</CardTitle>
              <CardDescription>{t("panelNutritionLandingSettings.accessDenied.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/panel">
                <Button variant="outline">{t("panelNutritionLandingSettings.backToPanel")}</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background px-4 py-8 text-foreground" dir={dir}>
        <div className="mx-auto flex max-w-3xl items-center justify-center rounded-[28px] border border-border/70 bg-card/60 p-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 text-foreground" dir={dir}>
      <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="space-y-2">
            <h1 className="text-xl font-bold">{t("panelNutritionLandingSettings.title")}</h1>
          </div>
          <Link href="/panel">
            <Button variant="outline" size="icon" title={t("common.back")} className="h-10 w-10 rounded-2xl border-border bg-background/40 hover:bg-background/70">
              {isRtl ? <ArrowRight className="h-5 w-5 rotate-180" /> : <ArrowLeft className="h-5 w-5" />}
            </Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <Card className="border-border/70 bg-card/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              {t("panelNutritionLandingSettings.defaultCard.title")}
            </CardTitle>
            <CardDescription>{t("panelNutritionLandingSettings.defaultCard.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-[1fr_220px] md:items-end">
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-[22px] border border-border/70 bg-background/35 px-4 py-3">
                <div className="space-y-1">
                  <div className="font-bold">{t("panelNutritionLandingSettings.preferDefault.title")}</div>
                  <div className="text-xs text-muted-foreground">{t("panelNutritionLandingSettings.preferDefault.description")}</div>
                </div>
                <Switch
                  checked={settings.preferAsDefault}
                  onCheckedChange={(checked) => setSettings((current) => ({ ...current, preferAsDefault: checked }))}
                />
              </div>

              <div className="flex items-center justify-between rounded-[22px] border border-border/70 bg-background/35 px-4 py-3">
                <div className="space-y-1">
                  <div className="font-bold">{t("panelNutritionLandingSettings.bookingBanner.title")}</div>
                  <div className="text-xs text-muted-foreground">{t("panelNutritionLandingSettings.bookingBanner.description")}</div>
                </div>
                <Switch
                  checked={settings.bookingBanner.enabled}
                  onCheckedChange={(checked) =>
                    setSettings((current) => ({
                      ...current,
                      bookingBanner: {
                        ...(current.bookingBanner ?? NUTRITION_BOOKING_BANNER_DEFAULT),
                        enabled: checked,
                      },
                    }))
                  }
                />
              </div>

              {settings.bookingBanner.enabled ? (
                <div className="rounded-[22px] border border-primary/20 bg-primary/5 p-4">
                  <div className="mb-4 space-y-1 text-start">
                    <div className="font-bold">{t("panelNutritionLandingSettings.bookingBanner.settingsTitle")}</div>
                    <div className="text-xs leading-7 text-muted-foreground">
                      {t("panelNutritionLandingSettings.bookingBanner.settingsDescription")}
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-[220px_1fr]">
                    <div className="space-y-3">
                      <div className="overflow-hidden rounded-[24px] border border-border/70 bg-background/35">
                        <img
                          src={removeBannerImage ? "/booking-app/nutrition-hero.jpg" : (pendingBannerImage ? URL.createObjectURL(pendingBannerImage) : (settings.bookingBanner.imageUrl || "/booking-app/nutrition-hero.jpg"))}
                          alt={t("panelNutritionLandingSettings.bookingBanner.imageAlt")}
                          className="h-44 w-full object-cover"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="booking-banner-image">{t("panelNutritionLandingSettings.bookingBanner.imageLabel")}</Label>
                        <Input
                          id="booking-banner-image"
                          type="file"
                          accept="image/*"
                          onChange={(event) => {
                            setPendingBannerImage(event.target.files?.[0] ?? null);
                            setRemoveBannerImage(false);
                          }}
                        />
                      </div>

                      <div className="flex items-center justify-between rounded-[18px] border border-border/70 bg-background/35 px-3 py-3">
                        <div className="text-sm">{t("panelNutritionLandingSettings.bookingBanner.removeImage")}</div>
                        <Switch checked={removeBannerImage} onCheckedChange={setRemoveBannerImage} />
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="booking-banner-badge">{t("panelNutritionLandingSettings.bookingBanner.badgeLabel")}</Label>
                        <Input
                          id="booking-banner-badge"
                          value={settings.bookingBanner.content.badge ?? ""}
                          onChange={(event) => updateBookingBannerField("badge", event.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="booking-banner-cta">{t("panelNutritionLandingSettings.bookingBanner.ctaLabel")}</Label>
                        <Input
                          id="booking-banner-cta"
                          value={settings.bookingBanner.content.cta_label ?? ""}
                          onChange={(event) => updateBookingBannerField("cta_label", event.target.value)}
                        />
                      </div>

                      <div className="md:col-span-2 space-y-2">
                        <Label htmlFor="booking-banner-title">{t("panelNutritionLandingSettings.bookingBanner.titleLabel")}</Label>
                        <Input
                          id="booking-banner-title"
                          value={settings.bookingBanner.content.title ?? ""}
                          onChange={(event) => updateBookingBannerField("title", event.target.value)}
                        />
                      </div>

                      <div className="md:col-span-2 space-y-2">
                        <Label htmlFor="booking-banner-description">{t("panelNutritionLandingSettings.bookingBanner.descriptionLabel")}</Label>
                        <Textarea
                          id="booking-banner-description"
                          value={settings.bookingBanner.content.description ?? ""}
                          onChange={(event) => updateBookingBannerField("description", event.target.value)}
                          className="min-h-[120px]"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="space-y-2">
                <Label>{t("panelNutritionLandingSettings.activeVariantLabel")}</Label>
                <select
                  dir={dir}
                  value={settings.activeVariant}
                  onChange={(e) => setSettings((current) => ({ ...current, activeVariant: e.target.value as NutritionLandingVariant }))}
                  className="w-full rounded-2xl border border-border bg-background/40 px-3 py-3 text-start"
                >
                  {NUTRITION_LANDING_VARIANTS.map((item) => (
                    <option key={item.key} value={item.key}>
                      {getVariantLabel(item.key)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <Link href={NUTRITION_LANDING_VARIANTS.find((item) => item.key === settings.activeVariant)?.previewPath || "/nutrition/landing-classic"}>
              <Button variant="outline" className="h-12 w-full rounded-2xl">
                {t("panelNutritionLandingSettings.activePreview")}
              </Button>
            </Link>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving} className="rounded-2xl px-6">
                {saving ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Save className="me-2 h-4 w-4" />}
                {t("panelNutritionLandingSettings.saveLandingAndBanner")}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <div className="space-y-4">
            {NUTRITION_LANDING_VARIANTS.map((item) => {
              const active = settings.activeVariant === item.key;
              const editing = selectedVariant === item.key;

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    setSelectedVariant(item.key);
                    setPendingImage(null);
                    setRemoveImage(false);
                  }}
                  className={`w-full rounded-[26px] border p-4 text-start transition ${
                    editing ? "border-primary bg-primary/10 shadow-[0_10px_30px_-18px_hsl(var(--primary)/0.65)]" : "border-border/70 bg-card/50 hover:border-primary/35"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="font-black">{getVariantLabel(item.key)}</div>
                      <div className="text-xs leading-7 text-muted-foreground">{getVariantDescription(item.key)}</div>
                    </div>
                    {active ? (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
                        <Check className="h-4 w-4" />
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <a
                      href={item.previewPath}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-xs font-bold text-primary"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <ExternalLink className="h-4 w-4" />
                      {t("panelNutritionLandingSettings.preview")}
                    </a>
                    <div className={`rounded-full px-3 py-1 text-[11px] font-black ${active ? "bg-emerald-500/15 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
                      {active ? t("panelNutritionLandingSettings.status.active") : t("panelNutritionLandingSettings.status.inactive")}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <Card className="border-border/70 bg-card/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LayoutTemplate className="h-5 w-5 text-primary" />
                {t("panelNutritionLandingSettings.variantSettingsTitle", { variant: selectedVariantMeta ? getVariantLabel(selectedVariantMeta.key) : "" })}
              </CardTitle>
              <CardDescription>
                {t("panelNutritionLandingSettings.variantSettingsDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-[220px_1fr]">
                <div className="space-y-3">
                  <div className="overflow-hidden rounded-[24px] border border-border/70 bg-background/35">
                    <img
                      src={removeImage ? "/booking-app/nutrition-hero.jpg" : (pendingImage ? URL.createObjectURL(pendingImage) : (selectedVariantSettings.imageUrl || "/booking-app/nutrition-hero.jpg"))}
                      alt={selectedVariantMeta ? getVariantLabel(selectedVariantMeta.key) : t("panelNutritionLandingSettings.landingImageAlt")}
                      className="h-44 w-full object-cover"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="landing-image">{t("panelNutritionLandingSettings.landingImageLabel")}</Label>
                    <Input
                      id="landing-image"
                      type="file"
                      accept="image/*"
                      onChange={(event) => {
                        setPendingImage(event.target.files?.[0] ?? null);
                        setRemoveImage(false);
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-[18px] border border-border/70 bg-background/35 px-3 py-3">
                    <div className="text-sm">{t("panelNutritionLandingSettings.removeLandingImage")}</div>
                    <Switch checked={removeImage} onCheckedChange={setRemoveImage} />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {NUTRITION_LANDING_FIELD_DEFS[selectedVariant].map((field) => (
                    <div key={field.key} className={field.multiline ? "md:col-span-2 space-y-2" : "space-y-2"}>
                      <Label htmlFor={field.key}>{getFieldLabel(selectedVariant, field.key)}</Label>
                      {field.multiline ? (
                        <Textarea
                          id={field.key}
                          value={selectedVariantSettings.content[field.key] ?? ""}
                          onChange={(event) => updateField(field.key, event.target.value)}
                          className="min-h-[120px]"
                        />
                      ) : (
                        <Input
                          id={field.key}
                          value={selectedVariantSettings.content[field.key] ?? ""}
                          onChange={(event) => updateField(field.key, event.target.value)}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving} className="rounded-2xl px-6">
                  {saving ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Save className="me-2 h-4 w-4" />}
                  {t("panelNutritionLandingSettings.saveSettings")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

      </main>
    </div>
  );
}
