import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Headset,
  Mail,
  MapPin,
  Phone,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getInitialTenantMeta } from "@/lib/bootstrap";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { getLandingSiteSettings } from "@/lib/landing-site";
import { PellehLandingHeader } from "@/components/pelleh-landing-header";
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
  const { dir } = useLocale();
  const bootstrapMeta = getInitialTenantMeta();
  const landingSiteSettings = getLandingSiteSettings();
  const { toast } = useToast();
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
    <div className="flex min-h-screen flex-col bg-[#0e0d0b] text-[#f4f2ee] [font-family:Vazirmatn,system-ui,sans-serif]" dir={dir}>
      <PellehLandingHeader />

      <main className="mx-auto w-full max-w-[1200px] flex-1 px-[clamp(20px,4vw,32px)] py-[clamp(28px,5vw,56px)]">
        <section className="grid items-start gap-7 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="space-y-5">
            <div className="rounded-[26px] border border-white/10 bg-[#15130f] p-6 sm:p-8">
              <span className="text-xs font-bold tracking-[1px] text-[#e0c06e]">{dynamicTexts.badgeText}</span>
              <h1 className="mt-4 text-[clamp(26px,4.5vw,40px)] font-black leading-[1.35]">{dynamicTexts.pageTitle}</h1>
              <div className="mt-5 space-y-2 text-sm leading-8 text-[#aaa59b] sm:text-base">
                {dynamicTexts.introLines.map((line) => <p key={line}>{line}</p>)}
              </div>
            </div>

            <div className="rounded-[26px] border border-white/10 bg-[#15130f] p-5 sm:p-6">
              <h2 className="text-lg font-black">{dynamicTexts.contactCardTitle}</h2>
              <p className="mt-2 text-sm leading-7 text-[#9c988d]">{dynamicTexts.contactCardDescription}</p>
              <div className="mt-5 space-y-3">
                {dynamicTexts.phones.map((phone) => (
                  <a key={`contact-page-${phone}`} href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[.035] px-4 py-3 transition hover:border-[#c9a24a]/45">
                    <PhoneText className="font-semibold text-white">{phone}</PhoneText>
                    <Phone className="h-4 w-4 text-[#e0c06e]" />
                  </a>
                ))}
                {dynamicTexts.email ? <a href={`mailto:${dynamicTexts.email}`} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[.035] px-4 py-3 transition hover:border-[#c9a24a]/45"><CodeText className="font-semibold text-white">{dynamicTexts.email}</CodeText><Mail className="h-4 w-4 text-[#e0c06e]" /></a> : null}
                {(locationParts || dynamicTexts.addressLine) ? <div className="flex items-start justify-between gap-4 rounded-2xl border border-white/10 bg-white/[.035] px-4 py-3"><div className="space-y-1 text-start">{locationParts ? <div className="text-sm font-semibold text-white">{locationParts}</div> : null}{dynamicTexts.addressLine ? <div className="text-sm leading-7 text-[#9c988d]">{dynamicTexts.addressLine}</div> : null}</div><MapPin className="mt-1 h-4 w-4 shrink-0 text-[#e0c06e]" /></div> : null}
              </div>
            </div>
          </div>

          <section className="rounded-[26px] border border-[#c9a24a]/25 bg-[linear-gradient(145deg,rgba(201,162,74,.11),rgba(255,255,255,.035))] p-5 shadow-[0_28px_80px_-55px_rgba(0,0,0,.9)] sm:p-7">
            <h2 className="text-xl font-black">{dynamicTexts.formTitle}</h2>
            <p className="mt-2 text-sm leading-7 text-[#9c988d]">{dynamicTexts.formDescription}</p>
            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2"><Label htmlFor="contact-name" className="text-[#d7d2c8]">{dynamicTexts.nameLabel}</Label><Input id="contact-name" placeholder={dynamicTexts.namePlaceholder} value={form.fullName} onChange={(event) => setForm((prev) => ({ ...prev, fullName: event.target.value }))} className="h-12 rounded-2xl border-white/10 bg-[#0e0d0b]/55 text-white placeholder:text-[#817d74] focus-visible:ring-[#c9a24a]" /></div>
              <div className="space-y-2"><Label htmlFor="contact-mobile" className="text-[#d7d2c8]">{dynamicTexts.mobileLabel}</Label><Input id="contact-mobile" placeholder={dynamicTexts.mobilePlaceholder} value={form.mobile} onChange={(event) => setForm((prev) => ({ ...prev, mobile: event.target.value }))} dir="ltr" className="h-12 rounded-2xl border-white/10 bg-[#0e0d0b]/55 text-white placeholder:text-[#817d74] focus-visible:ring-[#c9a24a]" /></div>
              <div className="space-y-2"><Label htmlFor="contact-email" className="text-[#d7d2c8]">{dynamicTexts.emailLabel}</Label><Input id="contact-email" placeholder={dynamicTexts.emailPlaceholder} value={form.email} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} dir="ltr" className="h-12 rounded-2xl border-white/10 bg-[#0e0d0b]/55 text-white placeholder:text-[#817d74] focus-visible:ring-[#c9a24a]" /></div>
              <div className="space-y-2"><Label htmlFor="contact-message" className="text-[#d7d2c8]">{dynamicTexts.messageLabel}</Label><Textarea id="contact-message" rows={5} placeholder={dynamicTexts.messagePlaceholder} value={form.message} onChange={(event) => setForm((prev) => ({ ...prev, message: event.target.value }))} className="rounded-2xl border-white/10 bg-[#0e0d0b]/55 text-white placeholder:text-[#817d74] focus-visible:ring-[#c9a24a]" /></div>
              {isSubmitted ? <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300">{dynamicTexts.successText}</div> : null}
              <Button className="h-12 w-full rounded-2xl bg-[#c9a24a] font-black text-[#0e0d0b] hover:bg-[#e0c06e]" disabled={isSubmitting}><Send className="me-2 h-4 w-4" />{isSubmitting ? t("landingContact.form.submitting") : dynamicTexts.submitText}</Button>
            </form>
            <div className="mt-4 flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-xs leading-6 text-[#9c988d]"><Headset className="h-4 w-4 shrink-0 text-[#e0c06e]" />{dynamicTexts.helperText}</div>
          </section>
        </section>
      </main>

      <footer className="border-t border-white/10 px-5 py-8 text-center text-xs text-[#817d74]">© استپ — تمامی حقوق محفوظ است.</footer>
    </div>
  );
}
