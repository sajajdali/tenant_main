import { useEffect, useMemo } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  BellRing,
  CalendarClock,
  CircleHelp,
  Eye,
  House,
  Info,
  LayoutGrid,
  ListChecks,
  Menu,
  MessageSquareText,
  Phone,
  PhoneCall,
  ReceiptText,
  ShoppingBag,
  SmilePlus,
  Sparkles,
  Store,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";
import { getLandingHeaderMenuItems, getLandingPath, getLandingSiteSettings } from "@/lib/landing-site";
import { LandingAuthDialog } from "@/components/landing-auth-dialog";
import { LandingAuthButton } from "@/components/landing-auth-button";
import { PhoneText } from "@/i18n/ltr-text";
import { useFormat, useLocale, useT } from "@/i18n/locale";
import type { MessageKey } from "@/i18n/messages";

type FeatureItem = {
  id: string;
  titleKey: MessageKey;
  shortKey: MessageKey;
  detailKey: MessageKey;
  imageUrls: string[];
  icon: typeof Sparkles;
};

const featureItems: FeatureItem[] = [
  {
    id: "booking",
    titleKey: "landingFeatures.feature.booking.title",
    shortKey: "landingFeatures.feature.booking.short",
    detailKey: "landingFeatures.feature.booking.detail",
    imageUrls: ["/booking-app/opengraph.jpg", "/icon-512.png", "/apple-touch-icon.png"],
    icon: CalendarClock,
  },
  {
    id: "reminder",
    titleKey: "landingFeatures.feature.reminder.title",
    shortKey: "landingFeatures.feature.reminder.short",
    detailKey: "landingFeatures.feature.reminder.detail",
    imageUrls: ["/booking-app/opengraph.jpg", "/icon-512.png", "/apple-touch-icon.png"],
    icon: BellRing,
  },
  {
    id: "campaign",
    titleKey: "landingFeatures.feature.campaign.title",
    shortKey: "landingFeatures.feature.campaign.short",
    detailKey: "landingFeatures.feature.campaign.detail",
    imageUrls: ["/booking-app/opengraph.jpg", "/icon-512.png", "/apple-touch-icon.png"],
    icon: MessageSquareText,
  },
  {
    id: "store",
    titleKey: "landingFeatures.feature.store.title",
    shortKey: "landingFeatures.feature.store.short",
    detailKey: "landingFeatures.feature.store.detail",
    imageUrls: ["/booking-app/opengraph.jpg", "/icon-512.png", "/apple-touch-icon.png"],
    icon: ShoppingBag,
  },
  {
    id: "brand",
    titleKey: "landingFeatures.feature.brand.title",
    shortKey: "landingFeatures.feature.brand.short",
    detailKey: "landingFeatures.feature.brand.detail",
    imageUrls: ["/booking-app/opengraph.jpg", "/icon-512.png", "/apple-touch-icon.png"],
    icon: Store,
  },
  {
    id: "team",
    titleKey: "landingFeatures.feature.team.title",
    shortKey: "landingFeatures.feature.team.short",
    detailKey: "landingFeatures.feature.team.detail",
    imageUrls: ["/booking-app/opengraph.jpg", "/icon-512.png", "/apple-touch-icon.png"],
    icon: Users,
  },
  {
    id: "checkout",
    titleKey: "landingFeatures.feature.checkout.title",
    shortKey: "landingFeatures.feature.checkout.short",
    detailKey: "landingFeatures.feature.checkout.detail",
    imageUrls: ["/booking-app/opengraph.jpg", "/icon-512.png", "/apple-touch-icon.png"],
    icon: Wallet,
  },
  {
    id: "automation",
    titleKey: "landingFeatures.feature.automation.title",
    shortKey: "landingFeatures.feature.automation.short",
    detailKey: "landingFeatures.feature.automation.detail",
    imageUrls: ["/booking-app/opengraph.jpg", "/icon-512.png", "/apple-touch-icon.png"],
    icon: Wrench,
  },
];

export default function LandingFeaturesPage() {
  const t = useT();
  const format = useFormat();
  const { dir, isRtl } = useLocale();
  const landingSiteSettings = getLandingSiteSettings();
  const [menuOpen, setMenuOpen] = useState(false);
  const [phoneModalOpen, setPhoneModalOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [selectedFeatureId, setSelectedFeatureId] = useState<string>(featureItems[0].id);
  const [featureModalOpen, setFeatureModalOpen] = useState(false);
  const [featureSlideIndex, setFeatureSlideIndex] = useState(0);
  const selectedFeature = useMemo(
    () => featureItems.find((item) => item.id === selectedFeatureId) ?? featureItems[0],
    [selectedFeatureId],
  );

  const iconMap = { home: House, about: Info, features: LayoutGrid, plans: ListChecks, faq: CircleHelp, contact: PhoneCall, orders: ReceiptText } as const;
  const headerMenuItems = getLandingHeaderMenuItems().map((item) => ({ ...item, icon: iconMap[item.key] ?? House }));
  const phoneNumbers = landingSiteSettings.contactPhones;

  useEffect(() => {
    document.title = t("landingFeatures.documentTitle", { siteTitle: landingSiteSettings.siteTitle });

    let descriptionTag = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (!descriptionTag) {
      descriptionTag = document.createElement("meta");
      descriptionTag.setAttribute("name", "description");
      document.head.appendChild(descriptionTag);
    }
    descriptionTag.setAttribute(
      "content",
      t("landingFeatures.metaDescription"),
    );
  }, [landingSiteSettings.siteTitle, t]);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground" dir={dir}>
      <header className="sticky top-0 z-20 border-b border-border/70 bg-card/70 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <img src={landingSiteSettings.logoUrl} alt={landingSiteSettings.siteTitle} className="h-10 w-auto max-w-[170px] object-contain" />
            <div>
              <div className="text-sm text-primary">{landingSiteSettings.headerLabel}</div>
              <h2 className="text-base font-black sm:text-lg">{landingSiteSettings.siteTitle}</h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-2xl border-border bg-background/40"
              onClick={() => setPhoneModalOpen(true)}
            >
              <Phone className="h-5 w-5" />
            </Button>

            <LandingAuthButton onLoginClick={() => setLoginOpen(true)} />

            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="h-10 w-10 rounded-2xl border-border bg-background/40">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side={isRtl ? "right" : "left"} className="border-border bg-card/95 pt-12" closeClassName="end-4 start-auto" dir={dir}>
                <div className="grid gap-2 pt-2">
                  {headerMenuItems.map((item) => (
                    <Link key={item.label} href={item.href}>
                      <a
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center justify-between rounded-xl border border-border/70 bg-background/35 px-4 py-4 text-sm font-semibold text-foreground transition hover:border-primary/30 w-full block"
                      >
                        <span>{item.label}</span>
                        <item.icon className="h-4 w-4 text-primary" />
                      </a>
                    </Link>
                  ))}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-6xl flex-1 space-y-6 px-4 py-8">
        <section className="rounded-3xl border border-primary/20 bg-gradient-to-br from-[#0f1b38] via-[#0d1a35] to-[#12224a] p-6 sm:p-8">
          <Badge className="rounded-full bg-primary/90 px-4 py-1 text-sm text-primary-foreground">{t("landingFeatures.badge")}</Badge>
          <h1 className="mt-4 text-3xl font-black leading-tight sm:text-4xl">{t("landingFeatures.title")}</h1>
          <div className="mt-4 space-y-1 text-sm leading-8 text-slate-300 sm:text-base">
            <p>{t("landingFeatures.intro.1")}</p>
            <p>{t("landingFeatures.intro.2")}</p>
            <p>{t("landingFeatures.intro.3")}</p>
            <p>{t("landingFeatures.intro.4")}</p>
            <p>{t("landingFeatures.intro.5")}</p>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featureItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                className="rounded-2xl border border-border/70 bg-card/60 text-start transition hover:border-primary/25"
                onClick={() => {
                  setSelectedFeatureId(item.id);
                  setFeatureSlideIndex(0);
                  setFeatureModalOpen(true);
                }}
              >
                <CardHeader>
                  <div className="mb-2 flex items-center justify-between">
                    <Icon className="h-5 w-5 text-primary" />
                    <LayoutGrid className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <CardTitle className="text-base">{t(item.titleKey)}</CardTitle>
                  <CardDescription className="leading-7">{t(item.shortKey)}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-8 text-muted-foreground">{t(item.detailKey)}</p>
                  <div className="mt-3 inline-flex items-center gap-1 text-xs text-primary">
                    <Eye className="h-3.5 w-3.5" />
                    {t("landingFeatures.viewDetails")}
                  </div>
                </CardContent>
              </button>
            );
          })}
        </section>

        <div className="flex justify-center pt-2">
          <Link href={getLandingPath("/")}>
            <Button variant="outline" className="rounded-2xl border-primary/35 bg-transparent">
              {t("landingFeatures.backToLanding")}
            </Button>
          </Link>
        </div>
      </main>

      <footer className="border-t border-border/70 bg-card/70 backdrop-blur-md">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-center gap-2 text-sm sm:text-base">
            <SmilePlus className="h-4 w-4 text-primary" />
            <span className="font-semibold text-foreground">{t("landingFeatures.footer")}</span>
          </div>
        </div>
      </footer>

      <Dialog open={phoneModalOpen} onOpenChange={setPhoneModalOpen}>
        <DialogContent className="max-w-md border-border/70 bg-card/95" dir={dir}>
          <DialogHeader>
            <DialogTitle>{t("landingFeatures.phoneModal.title")}</DialogTitle>
            <DialogDescription>{t("landingFeatures.phoneModal.description")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {phoneNumbers.map((phone) => (
              <a
                key={phone}
                href={`tel:${phone.replace(/-/g, "")}`}
                className="flex items-center justify-between rounded-xl border border-border/70 bg-background/35 px-4 py-3 transition hover:border-primary/30"
              >
                <PhoneText className="font-semibold">{phone}</PhoneText>
                <Phone className="h-4 w-4 text-primary" />
              </a>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <LandingAuthDialog open={loginOpen} onOpenChange={setLoginOpen} />

      <Dialog open={featureModalOpen} onOpenChange={setFeatureModalOpen}>
        <DialogContent className="max-w-3xl border-border/70 bg-card/95 p-3 sm:p-4" dir={dir}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <selectedFeature.icon className="h-5 w-5 text-primary" />
              {t(selectedFeature.titleKey)}
            </DialogTitle>
            <DialogDescription>{t("landingFeatures.modal.description")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm leading-8 text-muted-foreground">{t(selectedFeature.detailKey)}</p>
            <div className="overflow-hidden rounded-2xl border border-border/70 bg-background/30">
              <img
                src={selectedFeature.imageUrls[featureSlideIndex] ?? selectedFeature.imageUrls[0]}
                alt={t(selectedFeature.titleKey)}
                className="h-[230px] w-full object-cover object-top"
                loading="lazy"
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl border-border bg-background/40"
                onClick={() =>
                  setFeatureSlideIndex((current) =>
                    current <= 0 ? selectedFeature.imageUrls.length - 1 : current - 1,
                  )
                }
              >
                {isRtl ? <ArrowRight className="me-1 h-4 w-4" /> : <ArrowLeft className="me-1 h-4 w-4" />}
                {t("common.pagination.previous")}
              </Button>
              <div className="flex items-center gap-1">
                {selectedFeature.imageUrls.map((_, index) => (
                  <button
                    key={`${selectedFeature.id}-dot-${index}`}
                    type="button"
                    onClick={() => setFeatureSlideIndex(index)}
                    className={`h-2.5 w-2.5 rounded-full transition ${index === featureSlideIndex ? "bg-primary" : "bg-muted-foreground/40"}`}
                    aria-label={t("landingFeatures.slideAria", { index: format.number(index + 1) })}
                  />
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl border-border bg-background/40"
                onClick={() =>
                  setFeatureSlideIndex((current) =>
                    current >= selectedFeature.imageUrls.length - 1 ? 0 : current + 1,
                  )
                }
              >
                {t("common.pagination.next")}
                {isRtl ? <ArrowLeft className="ms-1 h-4 w-4" /> : <ArrowRight className="ms-1 h-4 w-4" />}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
