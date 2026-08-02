import { useEffect, useMemo, useState } from "react";
import { getInitialTenantMeta } from "@/lib/bootstrap";
import { useLandingAuth } from "@/lib/landing-auth";
import { ExternalLink, Scissors, Sparkles, X } from "lucide-react";
import { api } from "@/lib/api";
import { PellehLandingHeader } from "@/components/pelleh-landing-header";
import type { LandingOrderSummary } from "@/lib/types";

const defaultHeroImage = "http://127.0.0.1:8000/booking-app/assets/hero-photo-Nr4dc0GO.webp";
const defaultVideoCover = "http://127.0.0.1:8000/booking-app/assets/video-poster-DEWPFhsm.webp";

const DEFAULT_ITEMS = [
  "حتی نصف شب هم، بدون یک تماس، نوبت بگیرن؟",
  "محصولاتتو همون‌جا، کنار نوبت‌دهی، بفروشی؟",
  "دیگه دنبال یادآوری نوبت مشتری‌ها نباشی؟",
  "یه تجربه‌ی متفاوت برای مشتریت بسازی؟",
  "حساب‌وکتاب مالی سالنتو یه‌جا ببینی؟",
  "یه درگاه پرداخت مختص خودت داشته باشی؟",
  "با اسم خودت، تو گوگل پیدات کنن؟",
];

function text(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function list(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  const items = value.filter((item): item is string => typeof item === "string" && item.trim() !== "");
  return items.length ? items : fallback;
}

type FeatureItem = { title: string; short: string; url: string; isPrimary: boolean };
type PlanFeature = { title: string; url: string; enabled: boolean };
type PlanCard = { packageId: string; title: string; description: string; badgeText: string; buttonText: string; featured: boolean; showOnHome: boolean; features: PlanFeature[] };
type FaqItem = { question: string; answer: string };
type DemoLink = { title: string; description: string; url: string; icon: string };

function featureList(value: unknown): FeatureItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const title = text(record.title, "");
    if (!title) return [];
    return [{
      title,
      short: text(record.short, text(record.detail, "")),
      url: text(record.url, "/features"),
      isPrimary: record.isPrimary === true,
    }];
  });
}

function planCards(value: unknown): PlanCard[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const packageId = text(record.packageId, "");
    if (!packageId || record.showOnHome === false) return [];
    const features = Array.isArray(record.features) ? record.features.flatMap((feature): PlanFeature[] => {
      if (typeof feature === "string" && feature.trim()) return [{ title: feature, url: "", enabled: true }];
      if (!feature || typeof feature !== "object") return [];
      const featureRecord = feature as Record<string, unknown>;
      const title = text(featureRecord.title, "");
      if (!title) return [];
      return [{ title, url: text(featureRecord.url, ""), enabled: featureRecord.enabled !== false }];
    }) : [];
    return [{ packageId, title: text(record.title, ""), description: text(record.description, ""), badgeText: text(record.badgeText, ""), buttonText: text(record.buttonText, "ثبت سفارش"), featured: record.featured === true, showOnHome: true, features }];
  });
}

function PlanFeatureLink({ feature }: { feature: PlanFeature }) {
  const title = <span className="whitespace-pre-line">{feature.title}</span>;

  if (!feature.url) return title;

  return <span className="inline-flex w-full items-start justify-between gap-2">
    <a href={feature.url} className={`whitespace-pre-line underline-offset-4 ${feature.enabled ? "hover:text-[#e0c06e] hover:underline" : "text-[#817d74]"}`}>{feature.title}</a>
    <a href={feature.url} aria-label={`اطلاعات بیشتر درباره ${feature.title.replace(/\s+/g, " ")}`} className="mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full border border-[#e0c06e]/45 text-[10px] font-black leading-none text-[#e0c06e]/90 transition hover:border-[#e0c06e] hover:bg-[#e0c06e] hover:text-[#0e0d0b]">i</a>
  </span>;
}

function faqItems(value: unknown): FaqItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const question = text(record.question, "");
    const answer = text(record.answer, "");
    if (!question || !answer || record.showOnHome === false) return [];
    return [{ question, answer }];
  });
}

function demoLinks(value: unknown, legacyMenUrl: string, legacyWomenUrl: string): DemoLink[] {
  const items = Array.isArray(value) ? value.flatMap((item): DemoLink[] => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const title = text(record.title, "");
    const url = text(record.url, "");
    if (!title || !url) return [];
    return [{
      title,
      description: text(record.description, ""),
      url,
      icon: text(record.icon, "external"),
    }];
  }) : [];

  if (items.length) return items;

  return [
    { title: "دموی نسخه سالن مردانه", description: "نمونه تجربه رزرو و سایت مخصوص آرایشگاه مردانه.", url: legacyMenUrl, icon: "scissors" },
    { title: "دموی نسخه سالن زنانه", description: "نمونه تجربه رزرو و سایت مخصوص سالن زیبایی زنانه.", url: legacyWomenUrl, icon: "sparkles" },
  ].filter((item) => item.url);
}

function DemoIcon({ icon }: { icon: string }) {
  if (icon === "scissors") return <Scissors className="size-6" />;
  if (icon === "sparkles") return <Sparkles className="size-6" />;
  return <ExternalLink className="size-6" />;
}

function TypingSlogan({ prefix, items, finalText }: { prefix: string; items: string[]; finalText: string }) {
  const sequence = useMemo(() => [...items, finalText], [items, finalText]);
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const current = sequence[index] ?? finalText;
    const complete = visible === current;
    const empty = visible.length === 0;
    const delay = complete ? (index === sequence.length - 1 ? 2200 : 1500) : deleting ? 22 : 42;
    const timer = window.setTimeout(() => {
      if (complete && !deleting) return setDeleting(true);
      if (deleting && empty) {
        setDeleting(false);
        setIndex((value) => (value + 1) % sequence.length);
        return;
      }
      setVisible(current.slice(0, visible.length + (deleting ? -1 : 1)));
    }, delay);
    return () => window.clearTimeout(timer);
  }, [deleting, finalText, index, sequence, visible]);

  return (
    <p className="mb-[30px] min-h-[1.6em] overflow-hidden whitespace-nowrap text-[clamp(13px,2.2vw,17px)] leading-[1.6] text-[#f4f2ee]">
      <strong className="font-extrabold text-[#e0c06e]">{prefix} </strong>
      <span className={index === sequence.length - 1 ? "font-extrabold text-[#e0c06e]" : "font-medium"}>{visible}</span>
      <span className="me-1 inline-block h-[.9em] w-0.5 animate-pulse bg-[#e0c06e] align-[-2px]" />
    </p>
  );
}

export default function PellehStaticLandingPage() {
  const meta = getInitialTenantMeta();
  const { customer } = useLandingAuth();
  const hero = meta?.landingSections?.slider?.content ?? {};
  const video = meta?.landingSections?.video_intro?.content ?? {};
  const features = meta?.landingSections?.feature_grid?.content ?? {};
  const plans = meta?.landingSections?.plans?.content ?? {};
  const faq = meta?.landingSections?.faq?.content ?? {};
  const footer = meta?.landingSections?.footer_cta?.content ?? {};
  const [videoOpen, setVideoOpen] = useState(false);
  const [expandedPlanCards, setExpandedPlanCards] = useState<Record<string, boolean>>({});
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [incompleteOrder, setIncompleteOrder] = useState<LandingOrderSummary | null>(null);
  const menDemoUrl = text(video.menDemoUrl, text(hero.menDemoUrl, ""));
  const womenDemoUrl = text(video.womenDemoUrl, text(hero.womenDemoUrl, ""));
  const demoLinkItems = demoLinks(video.demoLinks, menDemoUrl, womenDemoUrl);
  const allFeatures = meta?.landingFeatures?.length
    ? meta.landingFeatures.map((item) => ({ title: item.title, short: item.short || "", url: item.url, isPrimary: item.isPrimary }))
    : featureList(features.items);
  const selectedPrimary = allFeatures.filter((item) => item.isPrimary).slice(0, 3);
  const primaryFeatures = [...selectedPrimary, ...allFeatures.filter((item) => !selectedPrimary.includes(item))].slice(0, 3);
  const otherFeatures = allFeatures.filter((item) => !primaryFeatures.includes(item));
  const firstFeatureUrl = allFeatures[0]?.url || "/features";
  const faNumber = new Intl.NumberFormat("fa-IR", { minimumIntegerDigits: 2, useGrouping: false });
  const money = new Intl.NumberFormat("fa-IR");
  const singularProfessional = meta?.audience?.singularLabel?.trim() || "آرایشگر";
  const professionalLimitLabel = (limit?: number | null) => limit == null
    ? `نامحدود ${singularProfessional}`
    : `${money.format(limit)} ${singularProfessional}`;
  const configuredCards = planCards(plans.cards);
  const selectedPackages = [...(meta?.landingPackages ?? [])]
    .filter((pkg) => pkg.showOnLandingHome)
    .sort((a, b) => (a.landingSortOrder ?? 0) - (b.landingSortOrder ?? 0))
    .slice(0, 3);
  const visiblePlans = selectedPackages.map((pkg) => {
    const card = configuredCards.find((item) => item.packageId === pkg.id);
    return { packageId: pkg.id, title: card?.title || pkg.name, description: card?.description || "", badgeText: card?.badgeText || "پیشنهادی", buttonText: card?.buttonText || "ثبت سفارش", featured: pkg.isLandingRecommended === true, showOnHome: true, features: card?.features || [], pkg };
  });
  const recommendedIndex = visiblePlans.findIndex((card) => card.pkg.isLandingRecommended);
  const homeFaqItems = faqItems(faq.items);

  useEffect(() => {
    if (!customer) {
      setIncompleteOrder(null);
      return;
    }
    api.landingOrders.list({ page: 1, perPage: 10 }).then((res) => {
      if (!res.success) return;
      const pending = res.data.items.find((order) => !order.completionSubmittedAt && Boolean(order.paidAt || order.payment?.paidAt || ["paid", "active", "processing", "setup"].includes(order.status.toLowerCase())));
      setIncompleteOrder(pending ?? null);
    });
  }, [customer?.id]);

  return (
    <div dir="rtl" lang="fa" className="min-h-screen bg-[#0e0d0b] font-sans text-[#f4f2ee]">
      <PellehLandingHeader />

      <main>
        <section className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-[clamp(32px,6vw,64px)] p-[clamp(20px,4vw,32px)]">
          <div className="min-w-[280px] flex-1 basis-[320px]">
            <span className="text-xs tracking-wide text-[#e0c06e]">{text(hero.badgeText, "ویژه آرایشگران و سالن‌های زیبایی")}</span>
            <h1 className="my-4 text-[clamp(22px,4vw,27px)] font-extrabold leading-[1.3]">{text(hero.titleLine1, "یک استپ بالاتر باشید")}</h1>
            <TypingSlogan prefix={text(hero.typingPrefix, "شده بخوای")} items={list(hero.typingItems, DEFAULT_ITEMS)} finalText={text(hero.typingFinalText, "متفاوت باشی، اصلاً؟")} />
            <button type="button" onClick={() => setVideoOpen(true)} className="rounded-full bg-[#c9a24a] px-6 py-3.5 text-sm font-bold text-[#0e0d0b]">{text(hero.secondaryCtaText, "مشاهده دموی واقعی")}</button>
          </div>
          <div className="hidden w-px self-stretch bg-white/10 min-[860px]:block" />
          <div className="aspect-[4/3] min-w-[280px] flex-1 basis-[320px] overflow-hidden rounded-[18px] border border-white/10 bg-[#171512]">
            <img src={text(hero.heroImageUrl, defaultHeroImage)} alt="عکس سالن یا آرایشگر" className="h-full w-full object-cover" />
          </div>
        </section>

        <div className="mx-auto max-w-[1200px] px-[clamp(20px,4vw,32px)]"><div className="h-px bg-white/10" /></div>

        <section id="video" className="mx-auto max-w-[1200px] px-[clamp(20px,4vw,32px)] pb-16 pt-[clamp(24px,4vw,40px)] text-center">
          <h2 className="mb-3 text-[clamp(16px,2.2vw,18px)] font-bold">{text(video.title, "در ۶۰ ثانیه ببینید چطور کار می‌کند")}</h2>
          <p className="mx-auto mb-8 max-w-[460px] text-[13px] text-[#9c988d]">{text(video.description, "از ثبت نوبت تا یادآوری خودکار، همه چیز در یک ویدیوی کوتاه.")}</p>
          <button type="button" onClick={() => setVideoOpen(true)} className="group relative block aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-[#171512]">
            <img src={text(video.coverUrl, defaultVideoCover)} alt="کاور ویدئوی معرفی" className="h-full w-full object-cover" />
            <span className="absolute inset-0 bg-black/40" />
            <span className="absolute inset-0 flex items-center justify-center"><span className="flex size-20 items-center justify-center rounded-full bg-[#c9a24a] text-3xl text-[#0e0d0b] shadow-2xl transition group-hover:scale-105">▶</span></span>
          </button>
        </section>

        {meta?.landingSections?.feature_grid?.status !== "inactive" && allFeatures.length > 0 && (
          <>
            <section className="mx-auto mt-5 max-w-[1200px] rounded-3xl border border-white/10 bg-[#171512] px-[clamp(28px,5vw,48px)] py-[clamp(48px,7vw,80px)]">
              <div className="mb-[clamp(36px,6vw,56px)] text-center">
                <span className="text-[11px] uppercase tracking-[1.5px] text-[#e0c06e]">امکانات</span>
                <h2 className="mt-3.5 text-[clamp(17px,2.6vw,19px)] font-extrabold">{text(features.title, "بیش از ۵۰ ویژگی سیستم!")}</h2>
                {text(features.description, "") && <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-[#9c988d]">{text(features.description, "")}</p>}
              </div>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] gap-x-10 gap-y-8">
                {primaryFeatures.map((item, index) => (
                  <a key={`${item.title}-${index}`} href={item.url} className="group block text-[#f4f2ee]">
                    <div className="mb-4 h-0.5 w-7 bg-[#e0c06e]" />
                    <div className="mb-2 flex items-baseline gap-2.5">
                      <span className="text-xs font-bold tracking-wide text-[#e0c06e]">{faNumber.format(index + 1)}</span>
                      <h3 className="text-[14.5px] font-bold transition-colors group-hover:text-[#e0c06e]">{item.title}</h3>
                    </div>
                    <p className="text-[13px] leading-[1.9] text-[#9c988d]">{item.short}</p>
                  </a>
                ))}
              </div>
            </section>

            {otherFeatures.length > 0 && (
              <section className="mx-auto max-w-[1200px] border-b border-white/10 px-[clamp(20px,4vw,32px)] pb-[clamp(40px,7vw,70px)]">
                <div className="flex justify-center">
                  <a href={firstFeatureUrl} className="flex items-center gap-2 rounded-full border border-white/10 bg-transparent px-6 py-3 text-[13px] text-[#f4f2ee] transition hover:border-[#c9a24a]/50 hover:text-[#e0c06e]">
                    {text(features.viewAllLabel, "سایر امکانات سیستم")}
                    <span className="text-[#e0c06e]">←</span>
                  </a>
                </div>
              </section>
            )}
          </>
        )}

        {meta?.landingSections?.plans?.status !== "inactive" && visiblePlans.length > 0 && (
          <section id="pricing" className="mx-auto max-w-[1200px] px-[clamp(20px,4vw,32px)] py-[clamp(56px,8vw,90px)]">
            <div className="mb-[clamp(36px,6vw,52px)] text-center">
              <span className="text-[11px] uppercase tracking-[1.5px] text-[#e0c06e]">پلن‌ها</span>
              <h2 className="mt-3.5 text-[clamp(20px,3vw,25px)] font-extrabold">{text(plans.title, "پلن‌ها")}</h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-[#9c988d]">{text(plans.description, "متناسب با اندازه سالن، پلن مناسب خودتان را انتخاب کنید.")}</p>
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] items-stretch gap-5">
              {visiblePlans.map((card, index) => {
                const featured = index === recommendedIndex;
                const cardKey = `${card.packageId}-${index}`;
                const expanded = expandedPlanCards[cardKey] === true;
                const visibleFeatures = expanded ? card.features : card.features.slice(0, 9);
                return <article key={`${card.packageId}-${index}`} className={`relative flex flex-col rounded-[20px] border p-7 ${featured ? "border-[#c9a24a]/50 bg-gradient-to-br from-[#241f16] to-[#171512] shadow-[0_20px_50px_-20px_rgba(201,162,74,.25)]" : "border-white/10 bg-[#171512]"}`}>
                  {featured && <span className="absolute start-5 top-0 -translate-y-1/2 rounded-full bg-[#c9a24a] px-4 py-1 text-[11px] font-extrabold text-[#0e0d0b]">{card.badgeText || "پیشنهادی"}</span>}
                  <h3 className="text-lg font-extrabold">{card.title || card.pkg.name}</h3>
                  <p className="mt-2 min-h-12 text-[13px] leading-6 text-[#9c988d]">{card.description}</p>
                  <div className="my-6 border-y border-white/10 py-5 [font-family:Vazirmatn,system-ui,sans-serif]">
                    {card.pkg.discountAmount > 0 && card.pkg.priceAmount > card.pkg.payableAmount && (
                      <div className="mb-2.5 flex min-h-6 items-center gap-2 text-[#817d74]">
                        <span className="whitespace-nowrap text-[13px] font-medium leading-none line-through decoration-[#b96f62] decoration-[1.5px] [font-variant-numeric:tabular-nums]">{money.format(card.pkg.priceAmount)}</span>
                        <span className="text-[11px] leading-none">تومان</span>
                        <span className="rounded-full border border-[#c9a24a]/20 bg-[#c9a24a]/10 px-2 py-1 text-[9px] font-extrabold leading-none text-[#e0c06e]">تخفیف‌خورده</span>
                      </div>
                    )}
                    <div className="flex items-end gap-2 whitespace-nowrap">
                      <strong className="text-[clamp(25px,3vw,32px)] font-black leading-none tracking-[-0.03em] text-[#e0c06e] [font-variant-numeric:tabular-nums]">{money.format(card.pkg.payableAmount)}</strong>
                      <span className="pb-0.5 text-[12px] font-semibold leading-none text-[#c4bda9]">تومان</span>
                    </div>
                    <div className="mt-3 text-[11px] font-medium leading-none text-[#817d74]">{money.format(card.pkg.durationDays)} روزه <span className="mx-1 text-white/20">•</span> {professionalLimitLabel(card.pkg.userLimit)}</div>
                  </div>
                  <div className={`relative mb-7 flex-1 overflow-hidden transition-all duration-500 ${expanded ? "pb-2" : "pb-12"}`}>
                    <ul className="space-y-3 text-[13px]">{visibleFeatures.map((feature, featureIndex) => <li key={featureIndex} className={`flex items-start gap-2 ${feature.enabled ? "" : "text-[#817d74]"}`}><span className={feature.enabled ? "text-[#e0c06e]" : "text-[#817d74]"}>{feature.enabled ? "✓" : "—"}</span><PlanFeatureLink feature={feature} /></li>)}</ul>
                    {card.features.length > 9 && !expanded && (
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-24 items-end justify-center bg-gradient-to-t from-[#171512] via-[#171512]/95 to-transparent">
                        <button type="button" onClick={() => setExpandedPlanCards((current) => ({ ...current, [cardKey]: true }))} className="pointer-events-auto inline-flex items-center justify-center rounded-full border border-[#e0c06e]/30 bg-transparent px-3.5 py-1.5 text-[11px] font-extrabold text-[#e0c06e] transition hover:border-[#e0c06e]/70 hover:bg-[#e0c06e]/10">
                          ادامه امکانات
                        </button>
                      </div>
                    )}
                  </div>
                  <a href={`/plans/duration?users=${encodeURIComponent(card.pkg.userLimit == null ? "unlimited" : String(card.pkg.userLimit))}`} className={`block rounded-full px-5 py-3.5 text-center text-sm font-bold ${featured ? "bg-[#c9a24a] text-[#0e0d0b]" : "border border-white/15 text-[#f4f2ee]"}`}>{card.buttonText}</a>
                </article>;
              })}
            </div>
            <div className="mt-8 text-center"><a href="/plans" className="text-sm text-[#e0c06e]">{text(plans.fullPageButtonLabel, "مشاهده همه پلن‌ها")}</a></div>
          </section>
        )}

        {meta?.landingSections?.faq?.status !== "inactive" && homeFaqItems.length > 0 && (
          <section id="faq" className="mx-auto max-w-[900px] px-[clamp(20px,4vw,32px)] pb-[clamp(64px,9vw,100px)] pt-[clamp(24px,5vw,48px)]">
            <div className="mb-[clamp(30px,5vw,44px)] text-center">
              <span className="text-[11px] uppercase tracking-[1.5px] text-[#e0c06e]">راهنما</span>
              <h2 className="mt-3.5 text-[clamp(20px,3vw,25px)] font-extrabold">{text(faq.title, "سوالات متداول")}</h2>
              {text(faq.description, "") && <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-[#9c988d]">{text(faq.description, "")}</p>}
            </div>
            <div className="overflow-hidden rounded-[22px] border border-white/10 bg-[#171512]">
              {homeFaqItems.map((item, index) => {
                const isOpen = openFaq === index;
                return <article key={`${item.question}-${index}`} className={index ? "border-t border-white/10" : ""}>
                  <button type="button" onClick={() => setOpenFaq(isOpen ? null : index)} aria-expanded={isOpen} className="flex w-full items-center justify-between gap-5 px-[clamp(18px,4vw,28px)] py-5 text-start">
                    <span className="text-[14px] font-bold leading-7 text-[#f4f2ee]">{item.question}</span>
                    <span className={`flex size-7 shrink-0 items-center justify-center rounded-full border border-white/10 text-lg font-light leading-none text-[#e0c06e] transition-transform ${isOpen ? "rotate-45" : ""}`}>+</span>
                  </button>
                  <div className={`grid transition-[grid-template-rows,opacity] duration-300 ${isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                    <div className="overflow-hidden"><p className="px-[clamp(18px,4vw,28px)] pb-6 text-[13px] leading-8 text-[#9c988d]">{item.answer}</p></div>
                  </div>
                </article>;
              })}
            </div>
          </section>
        )}
      </main>

      {meta?.landingSections?.footer_cta?.status !== "inactive" && (
        <footer className="bg-[#0e0d0b] text-center">
          <div className="mx-auto max-w-[1200px] border-t border-white/10 px-[clamp(20px,4vw,32px)] py-[clamp(50px,8vw,90px)]">
            <h2 className="mb-5 text-[clamp(18px,3vw,21px)] font-extrabold text-[#f4f2ee]">{text(footer.title, "یک استپ بالاتر باشید")}</h2>
            <a href={text(footer.buttonUrl, "/plans")} className="inline-flex items-center justify-center whitespace-nowrap rounded-full bg-[#c9a24a] px-7 py-3.5 text-sm font-bold text-[#0e0d0b] transition hover:-translate-y-0.5 hover:bg-[#e0c06e]">
              {text(footer.buttonText, "شروع خرید پکیج")}
            </a>
          </div>
          <p className="mx-auto max-w-[1200px] px-[clamp(20px,4vw,32px)] pb-10 pt-6 text-[13px] text-[#9c988d]">{text(footer.copyrightText, "© استپ — تمامی حقوق محفوظ است.")}</p>
        </footer>
      )}

      {videoOpen && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 backdrop-blur-md sm:p-6" onClick={() => setVideoOpen(false)}>
          <div className="w-full max-w-2xl overflow-hidden rounded-[26px] border border-white/10 bg-[#171512] shadow-[0_30px_100px_-35px_rgba(0,0,0,.9)]" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-6">
              <div>
                <strong className="block text-base font-black sm:text-lg">{text(video.demoModalTitle, "انتخاب دموی واقعی")}</strong>
                <span className="mt-1 block text-xs leading-6 text-[#9c988d]">{text(video.demoModalDescription, "نسخه مناسب سالن خودتان را باز کنید و تجربه مشتری را ببینید.")}</span>
              </div>
              <button type="button" aria-label="بستن" className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/30 text-xl text-[#aaa59b] transition hover:text-white" onClick={() => setVideoOpen(false)}>×</button>
            </div>
            <div className={`grid gap-4 p-5 sm:p-6 ${demoLinkItems.length === 1 ? "" : "sm:grid-cols-2"}`}>
              {demoLinkItems.length ? demoLinkItems.map((item, index) => (
                <a key={`${item.url}-${index}`} href={item.url} target="_blank" rel="noreferrer" className="group relative overflow-hidden rounded-[22px] border border-[#c9a24a]/25 bg-[linear-gradient(145deg,rgba(201,162,74,.16),rgba(255,255,255,.035))] p-5 text-start transition hover:-translate-y-0.5 hover:border-[#e0c06e]/70 hover:bg-[#c9a24a]/10">
                  <span className="mb-5 flex size-12 items-center justify-center rounded-2xl border border-[#c9a24a]/25 bg-black/25 text-[#e0c06e]"><DemoIcon icon={item.icon} /></span>
                  <strong className="block text-lg font-black text-white">{item.title}</strong>
                  {item.description && <span className="mt-2 block text-sm leading-7 text-[#aaa59b]">{item.description}</span>}
                  <span className="mt-5 inline-flex items-center gap-2 text-xs font-bold text-[#e0c06e]">مشاهده دمو <ExternalLink className="size-3.5" /></span>
                </a>
              )) : (
                <div className="rounded-[22px] border border-dashed border-white/15 p-8 text-center text-sm leading-7 text-[#aaa59b]">هنوز لینک دمویی برای این لندینگ ثبت نشده است.</div>
              )}
            </div>
          </div>
        </div>
      )}
      {incompleteOrder && <div role="dialog" aria-modal="true" className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
        <div className="relative w-full max-w-md rounded-[24px] border border-amber-400/30 bg-[#171512] p-6 text-center shadow-2xl sm:p-8">
          <button type="button" onClick={() => setIncompleteOrder(null)} aria-label="بستن" className="absolute left-4 top-4 flex size-8 items-center justify-center rounded-full border border-white/10 text-[#9c988d] hover:text-white"><X className="size-4" /></button>
          <div className="mx-auto flex size-14 items-center justify-center rounded-full border border-amber-400/25 bg-amber-400/10 text-2xl text-[#e0c06e]">!</div>
          <h2 className="mt-5 text-xl font-black text-[#f4f2ee]">اطلاعات سفارش شما تکمیل نشده است</h2>
          <p className="mt-3 text-sm leading-7 text-[#aaa59b]">سفارش شما با موفقیت ثبت و پرداخت شده، اما برای شروع فرایند ایجاد سیستم باید اطلاعات دامنه و مشخصات راه‌اندازی را کامل کنید.</p>
          <div className="mt-4 rounded-xl bg-white/[.035] px-4 py-3 text-xs text-[#9c988d]">شماره سفارش: <b className="text-white" dir="ltr">{incompleteOrder.orderNumber}</b></div>
          <a href={`/orders?complete=1&oid=${encodeURIComponent(incompleteOrder.id)}`} className="mt-6 block w-full rounded-full bg-[#c9a24a] px-6 py-3.5 text-sm font-black text-[#0e0d0b] transition hover:bg-[#e0c06e]">تکمیل اطلاعات سفارش</a>
          <button type="button" onClick={() => setIncompleteOrder(null)} className="mt-3 text-xs text-[#817d74] hover:text-white">بعداً تکمیل می‌کنم</button>
        </div>
      </div>}
    </div>
  );
}
