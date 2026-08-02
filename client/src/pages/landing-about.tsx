import { useEffect, useMemo } from "react";
import {
  BadgeCheck,
  BriefcaseBusiness,
  CheckCircle2,
  Gem,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { getInitialTenantMeta } from "@/lib/bootstrap";
import { getLandingSiteSettings } from "@/lib/landing-site";
import { PellehLandingHeader } from "@/components/pelleh-landing-header";
import { useT } from "@/i18n/locale";
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
  const bootstrapMeta = getInitialTenantMeta();
  const landingSiteSettings = getLandingSiteSettings();
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
    footerText: typeof pageSettings.footerText === "string" && pageSettings.footerText.trim() !== "" ? pageSettings.footerText : t("landingAbout.footer"),
  }), [pageSettings, t]);

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
    <div className="flex min-h-screen flex-col bg-[#0e0d0b] text-[#f4f2ee] [font-family:Vazirmatn,system-ui,sans-serif]" dir="rtl">
      <PellehLandingHeader />

      <main className="mx-auto w-full max-w-[1200px] flex-1 px-[clamp(20px,4vw,32px)] py-[clamp(30px,6vw,72px)]">
        <section className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-stretch">
          <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[#171512] p-[clamp(28px,5vw,54px)] shadow-[0_30px_100px_-70px_rgba(0,0,0,.9)]">
            <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[#e0c06e]/70 to-transparent" />
            <span className="text-[11px] font-bold tracking-[1.5px] text-[#e0c06e]">{dynamicTexts.badgeText}</span>
            <h1 className="mt-4 max-w-[760px] text-[clamp(30px,5.5vw,58px)] font-black leading-[1.22]">{dynamicTexts.pageTitle}</h1>
            <div className="mt-7 max-w-[780px] space-y-3 text-[15px] leading-9 text-[#aaa59b] sm:text-base">
              {dynamicTexts.introLines.map((line) => <p key={line}>{line}</p>)}
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="/plans" className="inline-flex items-center justify-center gap-2 rounded-full bg-[#c9a24a] px-6 py-3 text-sm font-black text-[#0e0d0b] transition hover:bg-[#e0c06e]"><BadgeCheck className="size-4" />{dynamicTexts.ctaPrimaryText}</a>
              <a href="/" className="inline-flex items-center justify-center rounded-full border border-white/15 px-6 py-3 text-sm font-bold text-[#f4f2ee] transition hover:border-[#c9a24a]/60 hover:text-[#e0c06e]">{dynamicTexts.ctaSecondaryText}</a>
            </div>
          </div>

          <div className="grid gap-4">
            {dynamicTexts.capabilities.slice(0, 4).map((item, index) => {
              const Icon = item.icon;
              return <div key={item.title} className="group rounded-[24px] border border-white/10 bg-[#15130f] p-5 transition hover:border-[#c9a24a]/45 hover:bg-[#19160f]">
                <div className="flex items-start gap-4">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-[#c9a24a]/25 bg-[#c9a24a]/10 text-[#e0c06e]"><Icon className="size-5" /></span>
                  <div>
                    <div className="mb-1 flex items-center gap-2"><span className="text-xs font-black text-[#e0c06e]">{new Intl.NumberFormat("fa-IR", { minimumIntegerDigits: 2, useGrouping: false }).format(index + 1)}</span><Gem className="size-3.5 text-[#6f6a5d]" /></div>
                    <h2 className="text-base font-black">{item.title}</h2>
                    <p className="mt-2 text-sm leading-7 text-[#9c988d]">{item.description}</p>
                  </div>
                </div>
              </div>;
            })}
          </div>
        </section>

        <section className="mt-[clamp(28px,5vw,52px)] grid gap-6 lg:grid-cols-[0.82fr_1.18fr]">
          <div className="rounded-[28px] border border-white/10 bg-[#15130f] p-6">
            <div className="flex items-center gap-3"><span className="flex size-11 items-center justify-center rounded-2xl bg-[#c9a24a]/10 text-[#e0c06e]"><Users className="size-5" /></span><h2 className="text-xl font-black">{dynamicTexts.ctaTitle}</h2></div>
            <p className="mt-4 text-sm leading-8 text-[#aaa59b]">{dynamicTexts.ctaDescription}</p>
            <a href="/contact" className="mt-6 inline-flex rounded-full border border-[#c9a24a]/40 px-5 py-3 text-sm font-bold text-[#e0c06e] transition hover:bg-[#c9a24a] hover:text-[#0e0d0b]">تماس و مشاوره</a>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-[#171512] p-6">
            <h2 className="text-xl font-black">{dynamicTexts.valuesTitle}</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {dynamicTexts.values.map((value) => <div key={value} className="flex items-start gap-3 rounded-2xl border border-white/8 bg-white/[0.025] p-4">
                <CheckCircle2 className="mt-1 size-4 shrink-0 text-[#e0c06e]" />
                <p className="text-sm leading-7 text-[#aaa59b]">{value}</p>
              </div>)}
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-[#0e0d0b] text-center">
        <p className="mx-auto max-w-[1200px] border-t border-white/10 px-[clamp(20px,4vw,32px)] py-8 text-[13px] text-[#9c988d]">{dynamicTexts.footerText}</p>
      </footer>

    </div>
  );
}
