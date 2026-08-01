import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  ChevronDown,
  CircleHelp,
  HelpCircle,
  House,
  Info,
  LayoutGrid,
  ListChecks,
  Menu,
  Phone,
  PhoneCall,
  ReceiptText,
  SmilePlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { getInitialTenantMeta } from "@/lib/bootstrap";
import { getLandingHeaderMenuItems, getLandingSiteSettings } from "@/lib/landing-site";
import { LandingAuthDialog } from "@/components/landing-auth-dialog";
import { LandingAuthButton } from "@/components/landing-auth-button";
import { PhoneText } from "@/i18n/ltr-text";
import { useLocale, useT } from "@/i18n/locale";
import { PellehBrandLogo } from "@/components/pelleh-brand-logo";

type FaqItem = { q: string; a: string; sortOrder: number };

export default function LandingFaqPage() {
  const t = useT();
  const { dir, isRtl } = useLocale();
  const bootstrapMeta = getInitialTenantMeta();
  const landingSiteSettings = getLandingSiteSettings();
  const [menuOpen, setMenuOpen] = useState(false);
  const [phoneModalOpen, setPhoneModalOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [openFaqId, setOpenFaqId] = useState<number>(0);
  const pageSettings = (bootstrapMeta?.landingPages?.faq?.settings ?? {}) as Record<string, unknown>;
  const faqList = useMemo(() => {
    const content = (bootstrapMeta?.landingSections?.faq?.content ?? {}) as Record<string, unknown>;
    const items = Array.isArray(content.items)
      ? content.items
          .map((item, index) => {
            if (!item || typeof item !== "object") return null;
            const record = item as Record<string, unknown>;
            const q = typeof record.question === "string" ? record.question.trim() : "";
            const a = typeof record.answer === "string" ? record.answer.trim() : "";
            const sortOrder = typeof record.sortOrder === "number"
              ? record.sortOrder
              : typeof record.sort_order === "number"
                ? record.sort_order
                : index;

            return q || a ? { q, a, sortOrder } : null;
          })
          .filter((item): item is { q: string; a: string; sortOrder: number } => item !== null)
          .sort((a, b) => a.sortOrder - b.sortOrder)
      : [];

    const defaultItems: FaqItem[] = Array.from({ length: 6 }).map((_, index) => ({
      q: t(`landingFaq.defaultFaq.${index + 1}.question` as Parameters<typeof t>[0]),
      a: t(`landingFaq.defaultFaq.${index + 1}.answer` as Parameters<typeof t>[0]),
      sortOrder: (index + 1) * 10,
    }));

    return items.length > 0 ? items : defaultItems;
  }, [bootstrapMeta, t]);
  const dynamicTexts = useMemo(() => ({
    badgeText: typeof pageSettings.badgeText === "string" && pageSettings.badgeText.trim() !== "" ? pageSettings.badgeText : t("landingFaq.badge"),
    pageTitle: typeof pageSettings.pageTitle === "string" && pageSettings.pageTitle.trim() !== "" ? pageSettings.pageTitle : t("landingFaq.title"),
    introLines: Array.isArray(pageSettings.introLines)
      ? pageSettings.introLines.filter((item): item is string => typeof item === "string" && item.trim() !== "").slice(0, 3)
      : [
          t("landingFaq.intro.1"),
          t("landingFaq.intro.2"),
          t("landingFaq.intro.3"),
        ],
    sectionTitle: typeof pageSettings.sectionTitle === "string" && pageSettings.sectionTitle.trim() !== "" ? pageSettings.sectionTitle : t("landingFaq.sectionTitle"),
    sectionDescription: typeof pageSettings.sectionDescription === "string" && pageSettings.sectionDescription.trim() !== "" ? pageSettings.sectionDescription : t("landingFaq.sectionDescription"),
    phoneModalTitle: typeof pageSettings.phoneModalTitle === "string" && pageSettings.phoneModalTitle.trim() !== "" ? pageSettings.phoneModalTitle : t("landingFaq.phoneModalTitle"),
    phoneModalDescription: typeof pageSettings.phoneModalDescription === "string" && pageSettings.phoneModalDescription.trim() !== "" ? pageSettings.phoneModalDescription : t("landingFaq.phoneModalDescription"),
    footerText: typeof pageSettings.footerText === "string" && pageSettings.footerText.trim() !== "" ? pageSettings.footerText : t("landingFaq.footer"),
  }), [pageSettings, t]);

  const iconMap = { home: House, about: Info, features: LayoutGrid, plans: ListChecks, faq: CircleHelp, contact: PhoneCall, orders: ReceiptText } as const;
  const headerMenuItems = getLandingHeaderMenuItems().map((item) => ({ ...item, icon: iconMap[item.key] ?? House }));
  const phoneNumbers = landingSiteSettings.contactPhones;

  useEffect(() => {
    document.title = t("landingFaq.documentTitle", { siteTitle: landingSiteSettings.siteTitle });

    let descriptionTag = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (!descriptionTag) {
      descriptionTag = document.createElement("meta");
      descriptionTag.setAttribute("name", "description");
      document.head.appendChild(descriptionTag);
    }
    descriptionTag.setAttribute("content", t("landingFaq.metaDescription"));
  }, [landingSiteSettings.siteTitle, t]);

  if (bootstrapMeta?.isLandingDomain === true) {
    return <div dir="rtl" className="flex min-h-screen flex-col bg-[#0e0d0b] text-[#f4f2ee] [font-family:Vazirmatn,system-ui,sans-serif]">
      <header className="border-b border-white/10 bg-[#0e0d0b]/90 backdrop-blur-xl"><div className="mx-auto flex max-w-[1200px] items-center justify-between px-5 py-4 sm:px-8"><PellehBrandLogo imageClassName="h-14 w-auto max-w-[230px] object-contain sm:h-16 sm:max-w-[280px]" /><a href="/plans" className="rounded-full border border-[#c9a24a] px-4 py-2 text-xs font-bold text-[#e0c06e] sm:px-5 sm:text-sm">مشاهده پلن‌ها</a></div></header>
      <main className="mx-auto w-full max-w-[900px] flex-1 px-4 pb-16 pt-10 sm:px-8 sm:pt-14">
        <div className="mb-8 text-center sm:mb-10"><span className="text-[11px] font-bold tracking-[1.5px] text-[#e0c06e]">راهنما</span><h1 className="mt-3 text-[clamp(22px,4vw,28px)] font-black">سوالات متداول</h1><p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-[#9c988d]">پاسخ پرسش‌های رایج درباره پلن‌ها، ثبت سفارش و راه‌اندازی سیستم.</p></div>
        <section className="overflow-hidden rounded-[22px] border border-white/10 bg-[#171512]">
          {faqList.map((item, index) => { const open = openFaqId === index; return <article key={item.q} className={index ? "border-t border-white/10" : ""}>
            <button type="button" onClick={() => setOpenFaqId(open ? -1 : index)} aria-expanded={open} className="flex w-full items-center justify-between gap-5 px-[clamp(18px,4vw,28px)] py-5 text-start"><span className="text-sm font-bold leading-7 text-[#f4f2ee]">{item.q}</span><span className={`flex size-7 shrink-0 items-center justify-center rounded-full border border-white/10 text-lg font-light leading-none text-[#e0c06e] transition-transform ${open ? "rotate-45" : ""}`}>+</span></button>
            <div className={`grid transition-[grid-template-rows,opacity] duration-300 ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}><div className="overflow-hidden"><p className="px-[clamp(18px,4vw,28px)] pb-6 text-[13px] leading-8 text-[#9c988d]">{item.a}</p></div></div>
          </article>; })}
        </section>
      </main>
      <footer className="border-t border-white/10 px-5 py-8 text-center text-xs text-[#817d74]">© استپ — تمامی حقوق محفوظ است.</footer>
    </div>;
  }

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
        <section className={`rounded-3xl border border-primary/20 ${isRtl ? "bg-gradient-to-br" : "bg-gradient-to-bl"} from-[#0f1b38] via-[#0d1a35] to-[#12224a] p-6 sm:p-8`}>
          <Badge className="rounded-full bg-primary/90 px-4 py-1 text-sm text-primary-foreground">{dynamicTexts.badgeText}</Badge>
          <h1 className="mt-4 text-3xl font-black leading-tight sm:text-4xl">{dynamicTexts.pageTitle}</h1>
          <div className="mt-4 space-y-1 text-sm leading-8 text-slate-300 sm:text-base">
            {dynamicTexts.introLines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </section>

        <Card className="border-border/70 bg-card/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <HelpCircle className="h-5 w-5 text-primary" />
              {dynamicTexts.sectionTitle}
            </CardTitle>
            <CardDescription>{dynamicTexts.sectionDescription}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-start" dir={dir}>
            {faqList.map((item, index) => (
              <button
                key={item.q}
                type="button"
                onClick={() => setOpenFaqId((current) => (current === index ? -1 : index))}
                className="w-full rounded-2xl border border-border/70 bg-background/35 p-4 text-start"
              >
                <div className="flex items-center gap-2">
                  <span className="flex-1 text-start font-semibold">{item.q}</span>
                  <ChevronDown className={`h-4 w-4 shrink-0 text-primary transition ${openFaqId === index ? "rotate-180" : ""}`} />
                </div>
                {openFaqId === index ? (
                  <p className="mt-2 text-sm leading-8 text-muted-foreground">{item.a}</p>
                ) : null}
              </button>
            ))}
          </CardContent>
        </Card>
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
