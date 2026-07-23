import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Info, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { applyAppearance, readCachedAppearance } from "@/lib/appearance";
import type { AboutSettings, AppearanceSettings } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { useLocale, useT } from "@/i18n/locale";

const defaultState: AboutSettings = {
  enabled: false,
  title: "",
  body: "",
  imageUrl: null,
};

export default function AboutPage() {
  const t = useT();
  const { dir, isRtl } = useLocale();
  const [loading, setLoading] = useState(true);
  const [about, setAbout] = useState<AboutSettings>(defaultState);
  const [storeName, setStoreName] = useState("");
  const [appearance, setAppearance] = useState<AppearanceSettings | null>(() => readCachedAppearance());
  const activeBookingTemplate =
    appearance?.bookingTemplate === "pink" ||
    appearance?.bookingTemplate === "blue" ||
    appearance?.bookingTemplate === "green" ||
    appearance?.bookingTemplate === "red" ||
    appearance?.bookingTemplate === "purple" ||
    appearance?.bookingTemplate === "yellow" ||
    appearance?.bookingTemplate === "olive"
      ? appearance.bookingTemplate
      : null;

  useEffect(() => {
    Promise.all([api.about.get(), api.appearance.get()]).then(([aboutRes, appearanceRes]) => {
      if (aboutRes.success) {
        setAbout({ ...defaultState, ...aboutRes.data });
      }

      if (appearanceRes.success) {
        setAppearance(appearanceRes.data);
        setStoreName(appearanceRes.data.storeName?.trim() || "");
        applyAppearance(appearanceRes.data);
      }

      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (activeBookingTemplate) {
      document.body.dataset.bookingTemplate = activeBookingTemplate;
    } else {
      delete document.body.dataset.bookingTemplate;
    }

    return () => {
      delete document.body.dataset.bookingTemplate;
    };
  }, [activeBookingTemplate]);

  return (
    <div className={`about-page min-h-screen bg-background pb-12 text-foreground ${activeBookingTemplate ? `about-template-${activeBookingTemplate}` : ""}`} dir={dir}>
      <header className="about-header sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="space-y-1">
            <h1 className="text-xl font-bold">{t("aboutPage.title")}</h1>
            <p className="text-sm text-muted-foreground">
              {storeName ? t("aboutPage.descriptionWithStore", { storeName }) : t("aboutPage.description")}
            </p>
          </div>
          <Link href="/">
            <Button
              variant="outline"
              size="icon"
              title={t("aboutPage.back")}
              className="about-back-button h-10 w-10 rounded-2xl border-border bg-background/40 hover:bg-background/70"
            >
              <ArrowRight className={`h-5 w-5 ${isRtl ? "" : "rotate-180"}`} />
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-5xl px-4 py-6">
        {loading ? (
          <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">
            <Loader2 className="me-2 h-5 w-5 animate-spin" />
            {t("common.loading")}
          </div>
        ) : !about.enabled ? (
          <div className="about-empty-state flex min-h-[50vh] flex-col items-center justify-center rounded-[2rem] border border-dashed border-border/70 bg-card/30 px-6 text-center">
            <Info className="mb-4 h-14 w-14 text-primary/70" />
            <h2 className="text-2xl font-bold">{t("aboutPage.disabled.title")}</h2>
            <p className="mt-3 max-w-xl text-sm leading-8 text-muted-foreground">
              {t("aboutPage.disabled.description")}
            </p>
          </div>
        ) : (
          <div className="about-content-card overflow-hidden rounded-[2rem] border border-border/70 bg-card/50 shadow-sm">
            {about.imageUrl && (
              <div className="relative h-64 w-full overflow-hidden sm:h-80 lg:h-[24rem]">
                <img src={about.imageUrl} alt={about.title || t("aboutPage.title")} className="h-full w-full object-cover" />
                <div className="about-image-overlay absolute inset-0 bg-gradient-to-t from-background via-background/35 to-transparent" />
              </div>
            )}

            <div className="space-y-5 p-6 sm:p-8">
              <div className="space-y-2">
                <div className="about-badge inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-sm text-primary">
                  <Info className="h-4 w-4" />
                  {t("aboutPage.badge")}
                </div>
                <h2 className="text-2xl font-bold sm:text-3xl">
                  {about.title?.trim() || storeName || t("aboutPage.title")}
                </h2>
              </div>

              <div className="about-body-card rounded-[1.5rem] border border-border/60 bg-background/35 p-5 sm:p-6">
                <p className="whitespace-pre-wrap text-sm leading-8 text-muted-foreground sm:text-base">
                  {about.body?.trim() || t("aboutPage.bodyMissing")}
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
