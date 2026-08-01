import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  BadgeCheck,
  BriefcaseBusiness,
  CheckCircle2,
  CircleHelp,
  Gem,
  House,
  Info,
  LayoutGrid,
  ListChecks,
  Menu,
  Phone,
  PhoneCall,
  ReceiptText,
  ShieldCheck,
  SmilePlus,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { getInitialTenantMeta } from "@/lib/bootstrap";
import { getLandingHeaderMenuItems, getLandingPath, getLandingSiteSettings } from "@/lib/landing-site";
import { LandingAuthDialog } from "@/components/landing-auth-dialog";
import { LandingAuthButton } from "@/components/landing-auth-button";
import { PhoneText } from "@/i18n/ltr-text";
import { useLocale, useT } from "@/i18n/locale";
import type { MessageKey } from "@/i18n/messages";

const capabilities = [
  {
    titleKey: "landingAbout.capability.ux.title",
    descriptionKey: "landingAbout.capability.ux.description",
    icon: Sparkles,
  },
  {
    titleKey: "landingAbout.capability.tech.title",
    descriptionKey: "landingAbout.capability.tech.description",
    icon: ShieldCheck,
  },
  {
    titleKey: "landingAbout.capability.growth.title",
    descriptionKey: "landingAbout.capability.growth.description",
    icon: Target,
  },
  {
    titleKey: "landingAbout.capability.operation.title",
    descriptionKey: "landingAbout.capability.operation.description",
    icon: BriefcaseBusiness,
  },
] satisfies Array<{ titleKey: MessageKey; descriptionKey: MessageKey; icon: typeof Sparkles }>;

export default function LandingAboutPage() {
  const t = useT();
  const { dir, isRtl } = useLocale();
  const bootstrapMeta = getInitialTenantMeta();
  const landingSiteSettings = getLandingSiteSettings();
  const [menuOpen, setMenuOpen] = useState(false);
  const [phoneModalOpen, setPhoneModalOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const pageSettings = (bootstrapMeta?.landingPages?.about?.settings ?? {}) as Record<string, unknown>;
  const dynamicTexts = useMemo(() => ({
    badgeText: typeof pageSettings.badgeText === "string" && pageSettings.badgeText.trim() !== "" ? pageSettings.badgeText : t("landingAbout.badge"),
    pageTitle: typeof pageSettings.pageTitle === "string" && pageSettings.pageTitle.trim() !== "" ? pageSettings.pageTitle : t("landingAbout.title"),
    introLines: Array.isArray(pageSettings.introLines)
      ? pageSettings.introLines.filter((item): item is string => typeof item === "string" && item.trim() !== "").slice(0, 5)
      : [
          t("landingAbout.intro.1"),
          t("landingAbout.intro.2"),
          t("landingAbout.intro.3"),
          t("landingAbout.intro.4"),
          t("landingAbout.intro.5"),
        ],
    capabilities: Array.isArray(pageSettings.capabilities)
      ? pageSettings.capabilities
          .map((item, index) => {
            if (!item || typeof item !== "object") return null;
            const record = item as Record<string, unknown>;
            const title = typeof record.title === "string" ? record.title.trim() : "";
            const description = typeof record.description === "string" ? record.description.trim() : "";
            return title || description ? { title, description, icon: capabilities[index]?.icon ?? Sparkles } : null;
          })
          .filter((item): item is { title: string; description: string; icon: typeof Sparkles } => item !== null)
      : capabilities.map((item) => ({ title: t(item.titleKey), description: t(item.descriptionKey), icon: item.icon })),
    valuesTitle: typeof pageSettings.valuesTitle === "string" && pageSettings.valuesTitle.trim() !== "" ? pageSettings.valuesTitle : t("landingAbout.valuesTitle"),
    values: Array.isArray(pageSettings.values)
      ? pageSettings.values.filter((item): item is string => typeof item === "string" && item.trim() !== "").slice(0, 4)
      : [
          t("landingAbout.value.1"),
          t("landingAbout.value.2"),
          t("landingAbout.value.3"),
          t("landingAbout.value.4"),
        ],
    ctaTitle: typeof pageSettings.ctaTitle === "string" && pageSettings.ctaTitle.trim() !== "" ? pageSettings.ctaTitle : t("landingAbout.cta.title"),
    ctaDescription: typeof pageSettings.ctaDescription === "string" && pageSettings.ctaDescription.trim() !== "" ? pageSettings.ctaDescription : t("landingAbout.cta.description"),
    ctaPrimaryText: typeof pageSettings.ctaPrimaryText === "string" && pageSettings.ctaPrimaryText.trim() !== "" ? pageSettings.ctaPrimaryText : t("landingAbout.cta.primary"),
    ctaSecondaryText: typeof pageSettings.ctaSecondaryText === "string" && pageSettings.ctaSecondaryText.trim() !== "" ? pageSettings.ctaSecondaryText : t("landingAbout.cta.secondary"),
    phoneModalTitle: typeof pageSettings.phoneModalTitle === "string" && pageSettings.phoneModalTitle.trim() !== "" ? pageSettings.phoneModalTitle : t("landingAbout.phoneModal.title"),
    phoneModalDescription: typeof pageSettings.phoneModalDescription === "string" && pageSettings.phoneModalDescription.trim() !== "" ? pageSettings.phoneModalDescription : t("landingAbout.phoneModal.description"),
    footerText: typeof pageSettings.footerText === "string" && pageSettings.footerText.trim() !== "" ? pageSettings.footerText : t("landingAbout.footer"),
  }), [pageSettings, t]);

  const iconMap = { home: House, about: Info, features: LayoutGrid, plans: ListChecks, faq: CircleHelp, contact: PhoneCall, orders: ReceiptText } as const;
  const headerMenuItems = getLandingHeaderMenuItems().map((item) => ({ ...item, icon: iconMap[item.key] ?? House }));
  const phoneNumbers = landingSiteSettings.contactPhones;

  useEffect(() => {
    document.title = t("landingAbout.documentTitle", { siteTitle: landingSiteSettings.siteTitle });

    let descriptionTag = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (!descriptionTag) {
      descriptionTag = document.createElement("meta");
      descriptionTag.setAttribute("name", "description");
      document.head.appendChild(descriptionTag);
    }
    descriptionTag.setAttribute(
      "content",
      t("landingAbout.metaDescription"),
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
          <Badge className="rounded-full bg-primary/90 px-4 py-1 text-sm text-primary-foreground">{dynamicTexts.badgeText}</Badge>
          <h1 className="mt-4 text-3xl font-black leading-tight sm:text-4xl">{dynamicTexts.pageTitle}</h1>
          <div className="mt-4 space-y-1 text-sm leading-8 text-slate-300 sm:text-base">
            {dynamicTexts.introLines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          {dynamicTexts.capabilities.map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.title} className="border-border/70 bg-card/60">
                <CardHeader>
                  <div className="mb-2 flex items-center justify-between">
                    <Icon className="h-5 w-5 text-primary" />
                    <Gem className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <CardTitle className="text-base">{item.title}</CardTitle>
                  <CardDescription className="leading-8">{item.description}</CardDescription>
                </CardHeader>
              </Card>
            );
          })}
        </section>

        <section className="rounded-2xl border border-border/70 bg-card/60 p-5">
          <h3 className="text-lg font-black">{dynamicTexts.valuesTitle}</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {dynamicTexts.values.map((value) => (
              <div key={value} className="flex items-start gap-2 rounded-xl bg-background/35 p-3">
                <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-primary" />
                <p className="text-sm leading-7 text-muted-foreground">{value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-primary/25 bg-primary/5 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Users className="mt-1 h-5 w-5 text-primary" />
              <div>
                <h3 className="text-lg font-black">{dynamicTexts.ctaTitle}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{dynamicTexts.ctaDescription}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button className="rounded-2xl">
                <BadgeCheck className="me-2 h-4 w-4" />
                {dynamicTexts.ctaPrimaryText}
              </Button>
              <Link href={getLandingPath("/")}>
                <Button variant="outline" className="rounded-2xl border-primary/35 bg-transparent">
                  {dynamicTexts.ctaSecondaryText}
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/70 bg-card/70 backdrop-blur-md">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-center gap-2 text-sm sm:text-base">
            <SmilePlus className="h-4 w-4 text-primary" />
            <span className="font-semibold text-foreground">{dynamicTexts.footerText}</span>
          </div>
        </div>
      </footer>

      <Dialog open={phoneModalOpen} onOpenChange={setPhoneModalOpen}>
        <DialogContent className="max-w-md border-border/70 bg-card/95" dir={dir}>
          <DialogHeader>
            <DialogTitle>{dynamicTexts.phoneModalTitle}</DialogTitle>
            <DialogDescription>{dynamicTexts.phoneModalDescription}</DialogDescription>
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
    </div>
  );
}
