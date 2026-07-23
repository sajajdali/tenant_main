import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Loader2, MapPinned, Navigation, PhoneCall } from "lucide-react";
import { api } from "@/lib/api";
import { applyAppearance, readCachedAppearance } from "@/lib/appearance";
import type { AppearanceSettings, ContactSettings } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { PhoneText } from "@/i18n/ltr-text";
import { useLocale, useT } from "@/i18n/locale";
const ContactLocationMap = lazy(async () => {
  const module = await import("@/components/contact-location-map");
  return { default: module.ContactLocationMap };
});

const defaultState: ContactSettings = {
  enabled: false,
  phones: [],
  locationEnabled: false,
  provinceId: null,
  provinceName: "",
  cityId: null,
  cityName: "",
  latitude: null,
  longitude: null,
  address: "",
};

function normalizePhoneLink(value: string) {
  return `tel:${value.replace(/[^\d+]/g, "")}`;
}

export default function ContactPage() {
  const t = useT();
  const { dir, isRtl } = useLocale();
  const [loading, setLoading] = useState(true);
  const [contact, setContact] = useState<ContactSettings>(defaultState);
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
    Promise.all([api.contact.get(), api.appearance.get()]).then(([contactRes, appearanceRes]) => {
      if (contactRes.success) {
        setContact({ ...defaultState, ...contactRes.data });
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

  const routeLink = useMemo(() => {
    if (!contact.latitude || !contact.longitude) {
      return "";
    }

    return `https://www.google.com/maps/dir/?api=1&destination=${contact.latitude},${contact.longitude}`;
  }, [contact.latitude, contact.longitude]);

  return (
    <div className={`contact-page min-h-screen bg-background pb-16 text-foreground ${activeBookingTemplate ? `contact-template-${activeBookingTemplate}` : ""}`} dir={dir}>
      <header className="contact-header sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="space-y-1">
            <h1 className="text-xl font-bold">{t("contactPage.title")}</h1>
            <p className="text-sm text-muted-foreground">
              {storeName ? t("contactPage.descriptionWithStore", { storeName }) : t("contactPage.description")}
            </p>
          </div>
          <Link href="/">
            <Button
              variant="outline"
              size="icon"
              title={t("contactPage.back")}
              className="contact-back-button h-10 w-10 rounded-2xl border-border bg-background/40 hover:bg-background/70"
            >
              <ArrowRight className={`h-5 w-5 ${isRtl ? "" : "rotate-180"}`} />
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-6xl px-4 py-6">
        {loading ? (
          <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">
            <Loader2 className="me-2 h-5 w-5 animate-spin" />
            {t("common.loading")}
          </div>
        ) : !contact.enabled ? (
          <div className="contact-empty-state flex min-h-[50vh] flex-col items-center justify-center rounded-[2rem] border border-dashed border-border/70 bg-card/30 px-6 text-center">
            <PhoneCall className="mb-4 h-14 w-14 text-primary/70" />
            <h2 className="text-2xl font-bold">{t("contactPage.disabled.title")}</h2>
            <p className="mt-3 max-w-xl text-sm leading-8 text-muted-foreground">
              {t("contactPage.disabled.description")}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <section className={`contact-hero overflow-hidden rounded-[2rem] border border-primary/20 ${isRtl ? "bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.22),transparent_35%),linear-gradient(135deg,rgba(15,23,42,0.95),rgba(17,24,39,0.92))]" : "bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.22),transparent_35%),linear-gradient(225deg,rgba(15,23,42,0.95),rgba(17,24,39,0.92))]"} p-6 shadow-[0_22px_80px_rgba(0,0,0,0.22)] sm:p-8`}>
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:items-end">
                <div className="space-y-4">
                  <div className="contact-hero-badge inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-sm text-primary">
                    <PhoneCall className="h-4 w-4" />
                    {t("contactPage.heroBadge")}
                  </div>
                  <h2 className="text-3xl font-black leading-tight sm:text-4xl">
                    {storeName ? t("contactPage.heroTitleWithStore", { storeName }) : t("contactPage.heroTitle")}
                  </h2>
                  <p className="max-w-2xl text-sm leading-8 text-slate-300 sm:text-base">
                    {t("contactPage.heroDescription")}
                  </p>
                </div>

                {routeLink && (
                  <div className="flex justify-start lg:justify-end">
                    <a href={routeLink} target="_blank" rel="noreferrer">
                      <Button className="contact-primary-action h-12 rounded-full px-6 text-base shadow-lg shadow-primary/20">
                        <Navigation className="me-2 h-4 w-4" />
                        {t("contactPage.route")}
                      </Button>
                    </a>
                  </div>
                )}
              </div>
            </section>

            {contact.phones.length > 0 && (
              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {contact.phones.map((phone) => (
                  <a
                    key={phone.id}
                    href={normalizePhoneLink(phone.number)}
                    className="contact-phone-card group overflow-hidden rounded-[1.8rem] border border-border/70 bg-card/60 p-5 shadow-sm transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_18px_50px_rgba(0,0,0,0.16)]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-2 text-start">
                        <div className="text-sm text-primary">{phone.title || t("contactPage.phoneTitle")}</div>
                        <div className="text-2xl font-black tracking-wide text-foreground">
                          <PhoneText>{phone.number}</PhoneText>
                        </div>
                        <div className="text-sm text-muted-foreground">{t("contactPage.phoneHint")}</div>
                      </div>
                      <div className="contact-phone-icon flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 transition-transform group-hover:scale-105">
                        <PhoneCall className="h-6 w-6" />
                      </div>
                    </div>
                  </a>
                ))}
              </section>
            )}

            {contact.locationEnabled && (contact.address?.trim() || (contact.latitude && contact.longitude)) && (
              <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
                <div className="contact-map-card overflow-hidden rounded-[2rem] border border-border/70 bg-card/50 shadow-sm">
                  {contact.latitude && contact.longitude ? (
                    <Suspense
                      fallback={
                        <div className="flex h-[320px] items-center justify-center bg-background/30 text-muted-foreground">
                          {t("contactPage.mapLoading")}
                        </div>
                      }
                    >
                      <ErrorBoundary
                        fallback={
                          <div className="flex h-[320px] items-center justify-center bg-background/30 text-muted-foreground">
                            {t("contactPage.mapError")}
                          </div>
                        }
                      >
                        <ContactLocationMap
                          center={{ lat: contact.latitude, lng: contact.longitude }}
                          marker={{ lat: contact.latitude, lng: contact.longitude }}
                          interactive={false}
                          title={storeName ? t("contactPage.mapTitleWithStore", { storeName }) : t("contactPage.mapTitle")}
                        />
                      </ErrorBoundary>
                    </Suspense>
                  ) : (
                    <div className="flex h-[320px] items-center justify-center bg-background/30 text-muted-foreground">
                      {t("contactPage.mapMissing")}
                    </div>
                  )}
                </div>

                <div className="contact-address-card space-y-4 rounded-[2rem] border border-border/70 bg-card/60 p-6 shadow-sm">
                  <div className="contact-address-badge inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-sm text-primary">
                    <MapPinned className="h-4 w-4" />
                    {t("contactPage.addressBadge")}
                  </div>

                  <div className="space-y-3">
                    {(contact.provinceName || contact.cityName) && (
                      <div className="text-lg font-bold">
                        {[contact.provinceName, contact.cityName].filter(Boolean).join("، ")}
                      </div>
                    )}
                    <p className="whitespace-pre-wrap text-sm leading-8 text-muted-foreground">
                      {contact.address?.trim() || t("contactPage.addressMissing")}
                    </p>
                  </div>

                  {routeLink && (
                    <a href={routeLink} target="_blank" rel="noreferrer" className="block">
                      <Button className="contact-primary-action w-full rounded-2xl">
                        <Navigation className="me-2 h-4 w-4" />
                        {t("contactPage.openRoute")}
                      </Button>
                    </a>
                  )}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
