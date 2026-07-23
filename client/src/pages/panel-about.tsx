import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, ImagePlus, Info, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { AboutSettings, TenantMeta } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { getAudienceLabels } from "@/lib/audience";
import { getInitialTenantMeta } from "@/lib/bootstrap";
import { SupportExpiredLock } from "@/components/support-expired-lock";
import { useLocale, useT } from "@/i18n/locale";

const defaultState: AboutSettings = {
  enabled: false,
  title: "",
  body: "",
  imageUrl: null,
  seoEnabled: false,
  seoTitle: "",
  seoDescription: "",
  seoKeywords: "",
  seoIndexable: true,
};

export default function PanelAboutPage() {
  const { isAdmin, isPrimaryAdmin } = useAuth();
  const { toast } = useToast();
  const t = useT();
  const { dir, isRtl } = useLocale();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [state, setState] = useState<AboutSettings>(defaultState);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [tenantMeta, setTenantMeta] = useState<TenantMeta | null>(() => getInitialTenantMeta());
  const labels = getAudienceLabels(tenantMeta);

  const saveAboutSettings = async (nextState: AboutSettings) => {
    setSaving(true);
    const res = await api.about.update({
      enabled: nextState.enabled,
      title: nextState.title,
      body: nextState.body,
      seoEnabled: nextState.seoEnabled,
      seoTitle: nextState.seoTitle,
      seoDescription: nextState.seoDescription,
      seoKeywords: nextState.seoKeywords,
      seoIndexable: nextState.seoIndexable,
      image: imageFile,
      removeImage: !imageFile && !imagePreview && !nextState.imageUrl,
    });
    setSaving(false);

    if (!res.success) {
      toast({ variant: "destructive", title: t("common.error"), description: res.message });
      return { success: false as const };
    }

    setState(res.data);
    setImageFile(null);
    setImagePreview(null);
    return { success: true as const, message: res.message };
  };

  useEffect(() => {
    api.about.get().then((res) => {
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

  if (!isPrimaryAdmin) {
    return null;
  }

  if (tenantMeta?.supportExpired) {
    return <SupportExpiredLock businessLabel={labels.business} isAdmin={isAdmin} />;
  }

  const effectiveImage = imagePreview || state.imageUrl || null;

  return (
    <div className="min-h-screen bg-background pb-20 text-foreground" dir={dir}>
      <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="space-y-1">
            <h1 className="text-xl font-bold">{t("panelAbout.title")}</h1>
          </div>
          <Link href="/panel">
            <Button variant="outline" size="icon" className="h-10 w-10 rounded-2xl border-border bg-background/40 hover:bg-background/70">
              <ArrowRight className={`h-5 w-5 ${isRtl ? "rotate-180" : ""}`} />
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-5xl space-y-6 px-4 py-6">
        {loading ? (
          <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
            <Loader2 className="me-2 h-5 w-5 animate-spin" />
            {t("common.loading")}
          </div>
        ) : (
          <>
            <Card className="border-border/70 bg-card/60">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      <Info className="h-5 w-5 text-primary" />
                      {t("panelAbout.activation.title")}
                    </CardTitle>
                    <CardDescription>{t("panelAbout.activation.description")}</CardDescription>
                  </div>
                  <Switch
                    checked={state.enabled}
                    disabled={saving}
                    onCheckedChange={async (checked) => {
                      const previousState = state;
                      const nextState = { ...state, enabled: checked };
                      setState(nextState);

                      const result = await saveAboutSettings(nextState);
                      if (!result.success) {
                        setState(previousState);
                        return;
                      }

                      toast({
                        title: checked ? t("panelAbout.toast.enabled") : t("panelAbout.toast.disabled"),
                      });
                    }}
                  />
                </div>
              </CardHeader>
            </Card>

            {state.enabled ? (
            <Card className="border-border/70 bg-card/60">
              <CardHeader>
                <CardTitle>{t("panelAbout.content.title")}</CardTitle>
                <CardDescription>{t("panelAbout.content.description")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="about-title">{t("panelAbout.content.titleLabel")}</Label>
                  <Input
                    id="about-title"
                    value={state.title}
                    onChange={(e) => setState((current) => ({ ...current, title: e.target.value }))}
                    placeholder={t("panelAbout.content.titlePlaceholder")}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="about-image">{t("panelAbout.content.image")}</Label>
                  <Input
                    id="about-image"
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setImageFile(file);
                      setImagePreview(file ? URL.createObjectURL(file) : null);
                    }}
                  />
                </div>

                {effectiveImage && (
                  <div className="overflow-hidden rounded-[1.75rem] border border-border/70 bg-background/30">
                    <img src={effectiveImage} alt={t("panelAbout.content.imageAlt")} className="h-64 w-full object-cover" />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="about-body">{t("panelAbout.content.body")}</Label>
                  <Textarea
                    id="about-body"
                    value={state.body}
                    onChange={(e) => setState((current) => ({ ...current, body: e.target.value }))}
                    placeholder={t("panelAbout.content.bodyPlaceholder")}
                    className="min-h-48 text-start leading-8"
                  />
                </div>

                <div className="flex flex-wrap justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setImageFile(null);
                      setImagePreview(null);
                      setState((current) => ({ ...current, imageUrl: null }));
                    }}
                  >
                    {t("panelAbout.content.removeImage")}
                  </Button>
                  <Button
                    disabled={saving}
                    onClick={async () => {
                      const result = await saveAboutSettings(state);
                      if (!result.success) {
                        return;
                      }

                      toast({ title: t("panelAbout.toast.saved"), description: result.message });
                    }}
                  >
                    {saving ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <ImagePlus className="me-2 h-4 w-4" />}
                    {t("panelAbout.content.save")}
                  </Button>
                </div>
              </CardContent>
            </Card>
            ) : null}

            {state.enabled ? (
            <Card className="border-border/70 bg-card/60">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <CardTitle>{t("panelAbout.seo.title")}</CardTitle>
                    <CardDescription>{t("panelAbout.seo.description")}</CardDescription>
                  </div>
                  <Switch
                    checked={!!state.seoEnabled}
                    onCheckedChange={(checked) => setState((current) => ({ ...current, seoEnabled: checked }))}
                  />
                </div>
              </CardHeader>
              <CardContent className={`space-y-5 transition-opacity ${state.seoEnabled ? "opacity-100" : "pointer-events-none opacity-45"}`}>
                <div className="space-y-2">
                  <Label htmlFor="about-seo-title">{t("panelAbout.seo.titleLabel")}</Label>
                  <Input
                    id="about-seo-title"
                    value={state.seoTitle || ""}
                    onChange={(e) => setState((current) => ({ ...current, seoTitle: e.target.value }))}
                    placeholder={t("panelAbout.seo.titlePlaceholder")}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="about-seo-description">{t("panelAbout.seo.descriptionLabel")}</Label>
                  <Textarea
                    id="about-seo-description"
                    value={state.seoDescription || ""}
                    onChange={(e) => setState((current) => ({ ...current, seoDescription: e.target.value }))}
                    placeholder={t("panelAbout.seo.descriptionPlaceholder")}
                    className="min-h-28 text-start leading-8"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="about-seo-keywords">{t("panelAbout.seo.keywordsLabel")}</Label>
                  <Input
                    id="about-seo-keywords"
                    value={state.seoKeywords || ""}
                    onChange={(e) => setState((current) => ({ ...current, seoKeywords: e.target.value }))}
                    placeholder={t("panelAbout.seo.keywordsPlaceholder")}
                  />
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-background/30 px-4 py-3">
                  <div className="space-y-1">
                    <div className="font-medium">{t("panelAbout.seo.indexable")}</div>
                    <div className="text-sm text-muted-foreground">{t("panelAbout.seo.indexableDescription")}</div>
                  </div>
                  <Switch
                    checked={state.seoIndexable !== false}
                    onCheckedChange={(checked) => setState((current) => ({ ...current, seoIndexable: checked }))}
                  />
                </div>
              </CardContent>
            </Card>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}
