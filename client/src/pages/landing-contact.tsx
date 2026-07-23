import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  CircleHelp,
  Headset,
  House,
  Info,
  LayoutGrid,
  ListChecks,
  Mail,
  MapPin,
  Menu,
  Phone,
  PhoneCall,
  ReceiptText,
  Send,
  SmilePlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { getInitialTenantMeta } from "@/lib/bootstrap";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { getLandingHeaderMenuItems, getLandingSiteSettings } from "@/lib/landing-site";
import { LandingAuthDialog } from "@/components/landing-auth-dialog";
import { LandingAuthButton } from "@/components/landing-auth-button";
import { CodeText, PhoneText } from "@/i18n/ltr-text";
import { useLocale, useT } from "@/i18n/locale";

type ContactFormState = {
  fullName: string;
  mobile: string;
  email: string;
  message: string;
};

const defaultFormState: ContactFormState = {
  fullName: "",
  mobile: "",
  email: "",
  message: "",
};

export default function LandingContactPage() {
  const t = useT();
  const { dir, isRtl } = useLocale();
  const bootstrapMeta = getInitialTenantMeta();
  const landingSiteSettings = getLandingSiteSettings();
  const { toast } = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [phoneModalOpen, setPhoneModalOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [form, setForm] = useState<ContactFormState>(defaultFormState);
  const pageSettings = (bootstrapMeta?.landingPages?.contact?.settings ?? {}) as Record<string, unknown>;

  const dynamicTexts = useMemo(() => {
    const introLines = Array.isArray(pageSettings.introLines)
      ? pageSettings.introLines.filter((item): item is string => typeof item === "string" && item.trim() !== "").slice(0, 3)
      : [
          t("landingContact.defaultIntro.1"),
          t("landingContact.defaultIntro.2"),
        ];

    const phones = Array.isArray(pageSettings.phones)
      ? pageSettings.phones.filter((item): item is string => typeof item === "string" && item.trim() !== "").slice(0, 3)
      : [t("landingContact.defaultPhone.1"), t("landingContact.defaultPhone.2"), t("landingContact.defaultPhone.3")];

    return {
      badgeText: typeof pageSettings.badgeText === "string" && pageSettings.badgeText.trim() !== "" ? pageSettings.badgeText : t("landingContact.badge"),
      pageTitle:
        typeof pageSettings.pageTitle === "string" && pageSettings.pageTitle.trim() !== ""
          ? pageSettings.pageTitle
          : t("landingContact.title"),
      introLines,
      contactCardTitle:
        typeof pageSettings.contactCardTitle === "string" && pageSettings.contactCardTitle.trim() !== ""
          ? pageSettings.contactCardTitle
          : t("landingContact.contactCard.title"),
      contactCardDescription:
        typeof pageSettings.contactCardDescription === "string" && pageSettings.contactCardDescription.trim() !== ""
          ? pageSettings.contactCardDescription
          : t("landingContact.contactCard.description"),
      phones,
      email: typeof pageSettings.email === "string" ? pageSettings.email.trim() : t("landingContact.defaultEmail"),
      provinceName: typeof pageSettings.provinceName === "string" ? pageSettings.provinceName.trim() : t("landingContact.defaultProvince"),
      cityName: typeof pageSettings.cityName === "string" ? pageSettings.cityName.trim() : t("landingContact.defaultCity"),
      addressLine:
        typeof pageSettings.addressLine === "string" && pageSettings.addressLine.trim() !== ""
          ? pageSettings.addressLine
          : t("landingContact.defaultAddress"),
      formTitle: typeof pageSettings.formTitle === "string" && pageSettings.formTitle.trim() !== "" ? pageSettings.formTitle : t("landingContact.form.title"),
      formDescription:
        typeof pageSettings.formDescription === "string" && pageSettings.formDescription.trim() !== ""
          ? pageSettings.formDescription
          : t("landingContact.form.description"),
      nameLabel: typeof pageSettings.nameLabel === "string" && pageSettings.nameLabel.trim() !== "" ? pageSettings.nameLabel : t("landingContact.form.nameLabel"),
      namePlaceholder:
        typeof pageSettings.namePlaceholder === "string" && pageSettings.namePlaceholder.trim() !== ""
          ? pageSettings.namePlaceholder
          : t("landingContact.form.namePlaceholder"),
      mobileLabel: typeof pageSettings.mobileLabel === "string" && pageSettings.mobileLabel.trim() !== "" ? pageSettings.mobileLabel : t("landingContact.form.mobileLabel"),
      mobilePlaceholder:
        typeof pageSettings.mobilePlaceholder === "string" && pageSettings.mobilePlaceholder.trim() !== ""
          ? pageSettings.mobilePlaceholder
          : t("landingContact.form.mobilePlaceholder"),
      emailLabel: typeof pageSettings.emailLabel === "string" && pageSettings.emailLabel.trim() !== "" ? pageSettings.emailLabel : t("landingContact.form.emailLabel"),
      emailPlaceholder:
        typeof pageSettings.emailPlaceholder === "string" && pageSettings.emailPlaceholder.trim() !== ""
          ? pageSettings.emailPlaceholder
          : t("landingContact.form.emailPlaceholder"),
      messageLabel: typeof pageSettings.messageLabel === "string" && pageSettings.messageLabel.trim() !== "" ? pageSettings.messageLabel : t("landingContact.form.messageLabel"),
      messagePlaceholder:
        typeof pageSettings.messagePlaceholder === "string" && pageSettings.messagePlaceholder.trim() !== ""
          ? pageSettings.messagePlaceholder
          : t("landingContact.form.messagePlaceholder"),
      submitText: typeof pageSettings.submitText === "string" && pageSettings.submitText.trim() !== "" ? pageSettings.submitText : t("landingContact.form.submit"),
      helperText:
        typeof pageSettings.helperText === "string" && pageSettings.helperText.trim() !== ""
          ? pageSettings.helperText
          : t("landingContact.form.helper"),
      successText:
        typeof pageSettings.successText === "string" && pageSettings.successText.trim() !== ""
          ? pageSettings.successText
          : t("landingContact.form.success"),
      phoneModalTitle:
        typeof pageSettings.phoneModalTitle === "string" && pageSettings.phoneModalTitle.trim() !== ""
          ? pageSettings.phoneModalTitle
          : t("landingContact.phoneModal.title"),
      phoneModalDescription:
        typeof pageSettings.phoneModalDescription === "string" && pageSettings.phoneModalDescription.trim() !== ""
          ? pageSettings.phoneModalDescription
          : t("landingContact.phoneModal.description"),
      footerText:
        typeof pageSettings.footerText === "string" && pageSettings.footerText.trim() !== ""
          ? pageSettings.footerText
          : t("landingContact.footer"),
    };
  }, [pageSettings, t]);

  const iconMap = { home: House, about: Info, features: LayoutGrid, plans: ListChecks, faq: CircleHelp, contact: PhoneCall, orders: ReceiptText } as const;
  const headerMenuItems = getLandingHeaderMenuItems().map((item) => ({ ...item, icon: iconMap[item.key] ?? House }));

  useEffect(() => {
    document.title = t("landingContact.documentTitle", { siteTitle: landingSiteSettings.siteTitle });

    let descriptionTag = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (!descriptionTag) {
      descriptionTag = document.createElement("meta");
      descriptionTag.setAttribute("name", "description");
      document.head.appendChild(descriptionTag);
    }
    descriptionTag.setAttribute("content", dynamicTexts.introLines.join(" "));
  }, [dynamicTexts.introLines, dynamicTexts.pageTitle, landingSiteSettings.siteTitle, t]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    const res = await api.landingContact.submit({
      fullName: form.fullName,
      mobile: form.mobile,
      email: form.email,
      message: form.message,
    });

    setIsSubmitting(false);

    if (!res.success) {
      toast({
        variant: "destructive",
        title: t("landingContact.toast.failedTitle"),
        description: res.message || t("landingContact.toast.failedDescription"),
      });
      return;
    }

    setForm(defaultFormState);
    setIsSubmitted(true);
    toast({
      title: t("landingContact.toast.successTitle"),
      description: res.message || dynamicTexts.successText,
    });
  };

  const locationParts = [dynamicTexts.provinceName, dynamicTexts.cityName].filter(Boolean).join(t("landingContact.locationSeparator"));

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground" dir={dir}>
      <header className="sticky top-0 z-20 border-b border-border/70 bg-card/70 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <img src={landingSiteSettings.logoUrl} alt={landingSiteSettings.siteTitle} className="h-10 w-10 rounded-xl border border-border/70 object-cover" />
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
                        className="block w-full rounded-xl border border-border/70 bg-background/35 px-4 py-4 text-sm font-semibold text-foreground transition hover:border-primary/30"
                      >
                        <span className="flex items-center justify-between">
                          <span>{item.label}</span>
                          <item.icon className="h-4 w-4 text-primary" />
                        </span>
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

        <section className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
          <Card className="border-border/70 bg-card/60">
            <CardHeader>
              <CardTitle className="text-lg">{dynamicTexts.contactCardTitle}</CardTitle>
              <CardDescription>{dynamicTexts.contactCardDescription}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {dynamicTexts.phones.map((phone) => (
                <a
                  key={`contact-page-${phone}`}
                  href={`tel:${phone.replace(/[^\d+]/g, "")}`}
                  className="flex items-center justify-between rounded-xl border border-border/70 bg-background/35 px-4 py-3 transition hover:border-primary/30"
                >
                  <PhoneText className="font-semibold">{phone}</PhoneText>
                  <Phone className="h-4 w-4 text-primary" />
                </a>
              ))}
              {dynamicTexts.email ? (
                <a
                  href={`mailto:${dynamicTexts.email}`}
                  className="flex items-center justify-between rounded-xl border border-border/70 bg-background/35 px-4 py-3 transition hover:border-primary/30"
                >
                  <CodeText className="font-semibold">{dynamicTexts.email}</CodeText>
                  <Mail className="h-4 w-4 text-primary" />
                </a>
              ) : null}
              {(locationParts || dynamicTexts.addressLine) ? (
                <div className="flex items-start justify-between rounded-xl border border-border/70 bg-background/35 px-4 py-3">
                  <div className="space-y-1 text-start">
                    {locationParts ? <div className="text-sm font-semibold">{locationParts}</div> : null}
                    {dynamicTexts.addressLine ? (
                      <div className="text-sm leading-7 text-muted-foreground">{dynamicTexts.addressLine}</div>
                    ) : null}
                  </div>
                  <MapPin className="mt-1 h-4 w-4 text-primary" />
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/60">
            <CardHeader>
              <CardTitle className="text-lg">{dynamicTexts.formTitle}</CardTitle>
              <CardDescription>{dynamicTexts.formDescription}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="contact-name">{dynamicTexts.nameLabel}</Label>
                  <Input
                    id="contact-name"
                    placeholder={dynamicTexts.namePlaceholder}
                    value={form.fullName}
                    onChange={(event) => setForm((prev) => ({ ...prev, fullName: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-mobile">{dynamicTexts.mobileLabel}</Label>
                  <Input
                    id="contact-mobile"
                    placeholder={dynamicTexts.mobilePlaceholder}
                    value={form.mobile}
                    onChange={(event) => setForm((prev) => ({ ...prev, mobile: event.target.value }))}
                    dir="ltr"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-email">{dynamicTexts.emailLabel}</Label>
                  <Input
                    id="contact-email"
                    placeholder={dynamicTexts.emailPlaceholder}
                    value={form.email}
                    onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                    dir="ltr"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-message">{dynamicTexts.messageLabel}</Label>
                  <Textarea
                    id="contact-message"
                    rows={5}
                    placeholder={dynamicTexts.messagePlaceholder}
                    value={form.message}
                    onChange={(event) => setForm((prev) => ({ ...prev, message: event.target.value }))}
                  />
                </div>
                {isSubmitted ? (
                  <div className="rounded-xl border border-primary/25 bg-primary/10 px-4 py-3 text-sm text-primary">
                    {dynamicTexts.successText}
                  </div>
                ) : null}
                <Button className="w-full rounded-2xl" disabled={isSubmitting}>
                  <Send className="me-2 h-4 w-4" />
                  {isSubmitting ? t("landingContact.form.submitting") : dynamicTexts.submitText}
                </Button>
              </form>
              <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-background/35 px-3 py-2 text-xs text-muted-foreground">
                <Headset className="h-4 w-4 text-primary" />
                {dynamicTexts.helperText}
              </div>
            </CardContent>
          </Card>
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
            {dynamicTexts.phones.map((phone) => (
              <a
                key={phone}
                href={`tel:${phone.replace(/[^\d+]/g, "")}`}
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
