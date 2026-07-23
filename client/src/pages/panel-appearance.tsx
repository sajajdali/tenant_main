import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Check, ImagePlus, LayoutTemplate, Loader2, Store, VenetianMask } from "lucide-react";
import { api } from "@/lib/api";
import { applyAppearance } from "@/lib/appearance";
import { BOOKING_TEMPLATES } from "@/lib/booking-templates";
import type { AppearanceSettings } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { getAudienceLabels } from "@/lib/audience";
import { getInitialTenantMeta } from "@/lib/bootstrap";
import type { TenantMeta } from "@/lib/types";
import { SupportExpiredLock } from "@/components/support-expired-lock";
import { useLocale, useT } from "@/i18n/locale";

const defaultState: AppearanceSettings = {
  storeName: "",
  bookingHeaderTitle: "",
  logoUrl: null,
  faviconUrl: null,
  bookingTemplate: "default",
  themeMode: "dark",
  customThemeEnabled: false,
  primaryTheme: "amber",
  accentTheme: "amber",
  backgroundTheme: "slate",
  cardTheme: "navy",
};

export default function PanelAppearancePage() {
  const { toast } = useToast();
  const t = useT();
  const { dir, isRtl } = useLocale();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [state, setState] = useState<AppearanceSettings>(defaultState);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [faviconPreview, setFaviconPreview] = useState<string | null>(null);
  const [tenantMeta, setTenantMeta] = useState<TenantMeta | null>(() => getInitialTenantMeta());
  const labels = getAudienceLabels(tenantMeta);

  useEffect(() => {
    api.appearance.get().then((res) => {
      if (res.success) {
        setState({ ...defaultState, ...res.data });
      }
      setLoading(false);
    });

    api.meta.get().then((res) => {
      if (res.success) {
        setTenantMeta(res.data);
      }
    });
  }, []);

  const effectiveLogo = logoPreview || state.logoUrl || null;
  const effectiveFavicon = faviconPreview || state.faviconUrl || null;

  if (tenantMeta?.supportExpired) {
    return <SupportExpiredLock businessLabel={labels.business} isAdmin={true} />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-20" dir={dir}>
      <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="space-y-1">
            <h1 className="text-xl font-bold">{t("panelAppearance.title")}</h1>
          </div>
          <Link href="/panel">
            <Button
              variant="outline"
              size="icon"
              title={t("common.back")}
              className="h-10 w-10 rounded-2xl border-border bg-background/40 hover:bg-background/70"
            >
              <ArrowRight className={`h-5 w-5 ${isRtl ? "rotate-180" : ""}`} />
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-6xl space-y-6 px-4 py-6">
        {loading ? (
          <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
            <Loader2 className="me-2 h-5 w-5 animate-spin" />
            {t("common.loading")}
          </div>
        ) : (
          <>
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
              <Card className="border-border/70 bg-card/60">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Store className="h-5 w-5 text-primary" />
                    {t("panelAppearance.brand.title")}
                  </CardTitle>
                  <CardDescription>{t("panelAppearance.brand.description")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="store-name">{t("panelAppearance.brand.storeName")}</Label>
                    <Input
                      id="store-name"
                      value={state.storeName}
                      onChange={(e) => setState((current) => ({ ...current, storeName: e.target.value }))}
                      placeholder={t("panelAppearance.brand.storeNamePlaceholder")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="booking-header-title">{t("panelAppearance.brand.bookingHeaderTitle")}</Label>
                    <Input
                      id="booking-header-title"
                      value={state.bookingHeaderTitle ?? ""}
                      onChange={(e) => setState((current) => ({ ...current, bookingHeaderTitle: e.target.value }))}
                      placeholder={t("panelAppearance.brand.bookingHeaderTitlePlaceholder")}
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="logo">{t("panelAppearance.brand.logo")}</Label>
                      <Input
                        id="logo"
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          setLogoFile(file);
                          setLogoPreview(file ? URL.createObjectURL(file) : null);
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="favicon">{t("panelAppearance.brand.favicon")}</Label>
                      <Input
                        id="favicon"
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          setFaviconFile(file);
                          setFaviconPreview(file ? URL.createObjectURL(file) : null);
                        }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/70 bg-card/60">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <VenetianMask className="h-5 w-5 text-primary" />
                    {t("panelAppearance.preview.title")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-[2rem] border border-border/70 bg-background/40 p-6">
                    <div className="flex items-center gap-4">
                      {effectiveLogo ? (
                        <img src={effectiveLogo} alt={t("panelAppearance.brand.logo")} className="h-16 w-16 rounded-2xl object-cover" />
                      ) : (
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-bold text-2xl">
                          {(state.storeName?.trim()?.[0] || "B").toUpperCase()}
                        </div>
                      )}
                      <div className="space-y-1">
                        <div className="text-lg font-bold">{state.storeName?.trim() || t("panelAppearance.preview.storeNameFallback")}</div>
                        <div className="text-sm text-muted-foreground">{state.bookingHeaderTitle?.trim() || t("panelAppearance.preview.bookingHeaderFallback")}</div>
                      </div>
                    </div>
                    {effectiveFavicon && (
                      <div className="mt-4 flex items-center gap-3 text-sm text-muted-foreground">
                        <img src={effectiveFavicon} alt={t("panelAppearance.brand.favicon")} className="h-6 w-6 rounded-md object-cover" />
                        {t("panelAppearance.preview.faviconSelected")}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border-border/70 bg-card/60">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LayoutTemplate className="h-5 w-5 text-primary" />
                  {t("panelAppearance.templates.title")}
                </CardTitle>
                <CardDescription>
                  {t("panelAppearance.templates.description")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2">
                  {BOOKING_TEMPLATES.map((template) => {
                    const selected = state.bookingTemplate === template.id;
                    const templatePreviewAccent =
                      template.id === "pink"
                        ? { backgroundColor: "#f4ecff", borderColor: "#dcc3f3" }
                        : template.id === "blue"
                          ? { backgroundColor: "#eaf7ff", borderColor: "#b7def4" }
                          : template.id === "red"
                            ? { backgroundColor: "#fff0f1", borderColor: "#f2b8bf" }
                            : template.id === "purple"
                              ? { backgroundColor: "#f1f2ff", borderColor: "#cfd3f5" }
                              : template.id === "yellow"
                                ? { backgroundColor: "#fff8e8", borderColor: "#f1d7aa" }
                                : template.id === "olive"
                                  ? { backgroundColor: "#f3f5e5", borderColor: "#d9dfb5" }
                          : { backgroundColor: "hsl(var(--background))", borderColor: "hsl(var(--border))" };

                    return (
                      <button
                        key={template.id}
                        type="button"
                        aria-pressed={selected}
                        data-template-selected={selected ? "true" : "false"}
                        onClick={() => setState((current) => ({ ...current, bookingTemplate: template.id }))}
                        className={`relative overflow-hidden rounded-[1.5rem] text-start transition-all duration-200 ${
                          selected
                            ? "border-[3px] bg-card -translate-y-0.5"
                            : "border border-border/70 bg-background/30 hover:-translate-y-0.5 hover:border-primary/40"
                        }`}
                        style={
                          selected
                            ? {
                                borderColor: template.accent,
                                background: `linear-gradient(145deg, ${template.accent}1f, hsl(var(--card)))`,
                                boxShadow: `0 0 0 4px ${template.accent}2e, 0 22px 48px -28px ${template.accent}cc`,
                              }
                            : undefined
                        }
                      >
                        <div className="flex items-center justify-between gap-3 p-4">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2 font-bold">
                              <span style={selected ? { color: template.accent } : undefined}>{t(template.nameKey)}</span>
                              {selected ? (
                                <span
                                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black text-white shadow-sm"
                                  style={{ backgroundColor: template.accent }}
                                >
                                  <Check className="h-3.5 w-3.5" />
                                  {t("panelAppearance.templates.selected")}
                                </span>
                              ) : null}
                            </div>
                            <div className="text-sm leading-6 text-muted-foreground">{t(template.descriptionKey)}</div>
                          </div>
                          <span
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/30 text-white transition-transform ${
                              selected ? "scale-110" : ""
                            }`}
                            style={{
                              backgroundColor: template.accent,
                              boxShadow: selected ? `0 10px 24px ${template.accent}55` : undefined,
                            }}
                          >
                            {selected ? <Check className="h-5 w-5 stroke-[3]" /> : null}
                          </span>
                        </div>
                        <div
                          className="border-t bg-background/25 p-4"
                          style={selected ? { borderColor: `${template.accent}66` } : { borderColor: "hsl(var(--border) / 0.5)" }}
                        >
                          <div
                            className="mx-auto max-w-[220px] rounded-[1.25rem] border bg-card/80 p-3"
                            style={selected ? { borderColor: `${template.accent}99` } : { borderColor: "hsl(var(--border) / 0.6)" }}
                          >
                            <div className="mb-3 flex items-center justify-between gap-2">
                              <span className="h-8 w-8 rounded-xl" style={{ backgroundColor: template.accent }} />
                              <div className="h-3 w-24 rounded-full bg-muted" />
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              {[1, 2, 3, 4, 5, 6].map((item) => (
                                <span
                                  key={item}
                                  className="h-12 rounded-xl border"
                                  style={{
                                    ...(item % 3 === 0
                                      ? templatePreviewAccent
                                      : { backgroundColor: "hsl(var(--background))", borderColor: "hsl(var(--border))" }),
                                  }}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <div className="flex flex-wrap justify-end gap-3">
                <Button
                  className="min-w-44"
                  disabled={saving}
                  onClick={async () => {
                    setSaving(true);
                    const res = await api.appearance.update({
                      storeName: state.storeName,
                      bookingHeaderTitle: state.bookingHeaderTitle,
                      bookingTemplate: state.bookingTemplate,
                      themeMode: defaultState.themeMode,
                      customThemeEnabled: false,
                      primaryTheme: defaultState.primaryTheme,
                      accentTheme: defaultState.accentTheme,
                      backgroundTheme: defaultState.backgroundTheme,
                      cardTheme: defaultState.cardTheme,
                      logo: logoFile,
                      favicon: faviconFile,
                    });
                    setSaving(false);

                    if (!res.success) {
                      toast({ variant: "destructive", title: t("common.error"), description: res.message });
                      return;
                    }

                    setState(res.data);
                    setLogoFile(null);
                    setFaviconFile(null);
                    setLogoPreview(null);
                    setFaviconPreview(null);
                    applyAppearance(res.data);
                    toast({ title: t("panelAppearance.toast.saved"), description: t("panelAppearance.toast.applying") });
                    window.setTimeout(() => {
                      window.location.reload();
                    }, 500);
                  }}
                >
                  {saving ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
                  {t("panelAppearance.save")}
                </Button>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
