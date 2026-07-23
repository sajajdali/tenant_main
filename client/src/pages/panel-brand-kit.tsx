import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { Link } from "wouter";
import { toPng } from "html-to-image";
import QRCode from "react-qr-code";
import { ArrowRight, Download, FileImage, ImageIcon, ImagePlus, IdCard, Loader2, QrCode, ScanLine, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { getAudienceLabels } from "@/lib/audience";
import { getInitialTenantMeta } from "@/lib/bootstrap";
import { SupportExpiredLock } from "@/components/support-expired-lock";
import { useLocale, useT } from "@/i18n/locale";
import type { MessageKey } from "@/i18n/messages";

type PosterSize = "a5" | "a4" | "a3";
type BusinessCardTemplate =
  | "royal-night"
  | "golden-frame"
  | "minimal-ivory"
  | "linen-gray"
  | "spotlight-neon"
  | "midnight-slice"
  | "executive-ink"
  | "teal-wave"
  | "ruby-signature";
type RubySignatureTone = "ruby" | "rose-gold" | "plum" | "navy" | "sapphire" | "cobalt" | "emerald" | "jade" | "forest";
type PosterTemplate =
  | "lux-promo"
  | "studio-pop"
  | "clean-invite"
  | "night-glow"
  | "golden-qr"
  | "soft-canvas"
  | "skyline-ad"
  | "emerald-poster"
  | "mono-impact";
type PosterFamily = "hero" | "clean" | "impact";

type BusinessCardState = {
  businessName: string;
  ownerName: string;
  subtitle: string;
  phone: string;
  secondaryPhone: string;
  address: string;
  website: string;
  accentColor: string;
  note: string;
  template: BusinessCardTemplate;
  rubyTone: RubySignatureTone;
};

type PosterState = {
  businessName: string;
  title: string;
  description: string;
  website: string;
  accentColor: string;
  size: PosterSize;
  footer: string;
  template: PosterTemplate;
};

const BUSINESS_CARD_TEMPLATES: Array<{ value: BusinessCardTemplate; labelKey: MessageKey }> = [
  { value: "royal-night", labelKey: "panelBrandKit.card.template.royalNight" },
  { value: "golden-frame", labelKey: "panelBrandKit.card.template.goldenFrame" },
  { value: "minimal-ivory", labelKey: "panelBrandKit.card.template.minimalIvory" },
  { value: "linen-gray", labelKey: "panelBrandKit.card.template.linenGray" },
  { value: "spotlight-neon", labelKey: "panelBrandKit.card.template.spotlightNeon" },
  { value: "midnight-slice", labelKey: "panelBrandKit.card.template.midnightSlice" },
  { value: "executive-ink", labelKey: "panelBrandKit.card.template.executiveInk" },
  { value: "teal-wave", labelKey: "panelBrandKit.card.template.tealWave" },
  { value: "ruby-signature", labelKey: "panelBrandKit.card.template.rubySignature" },
];

type CardColorPreset = {
  labelKey: MessageKey;
  swatch: string;
  accentColor: string;
};

const RUBY_SIGNATURE_TONES: Array<{ value: RubySignatureTone; labelKey: MessageKey; swatch: string }> = [
  { value: "ruby", labelKey: "panelBrandKit.color.ruby", swatch: "#be123c" },
  { value: "rose-gold", labelKey: "panelBrandKit.color.roseGold", swatch: "#f59e8b" },
  { value: "plum", labelKey: "panelBrandKit.color.plum", swatch: "#7c3aed" },
  { value: "navy", labelKey: "panelBrandKit.color.navy", swatch: "#1d4ed8" },
  { value: "sapphire", labelKey: "panelBrandKit.color.sapphire", swatch: "#2563eb" },
  { value: "cobalt", labelKey: "panelBrandKit.color.cobalt", swatch: "#0f766e" },
  { value: "emerald", labelKey: "panelBrandKit.color.emerald", swatch: "#059669" },
  { value: "jade", labelKey: "panelBrandKit.color.jade", swatch: "#14b8a6" },
  { value: "forest", labelKey: "panelBrandKit.color.forest", swatch: "#166534" },
];

const BUSINESS_CARD_COLOR_PRESETS: Record<BusinessCardTemplate, CardColorPreset[]> = {
  "royal-night": [
    { labelKey: "panelBrandKit.color.gold", swatch: "#f59e0b", accentColor: "#f59e0b" },
    { labelKey: "panelBrandKit.color.royalBlue", swatch: "#3b82f6", accentColor: "#3b82f6" },
    { labelKey: "panelBrandKit.color.turquoise", swatch: "#14b8a6", accentColor: "#14b8a6" },
  ],
  "golden-frame": [
    { labelKey: "panelBrandKit.color.classicGold", swatch: "#f59e0b", accentColor: "#f59e0b" },
    { labelKey: "panelBrandKit.color.roseGold", swatch: "#fb7185", accentColor: "#fb7185" },
    { labelKey: "panelBrandKit.color.platinum", swatch: "#cbd5e1", accentColor: "#cbd5e1" },
  ],
  "minimal-ivory": [
    { labelKey: "panelBrandKit.color.caramel", swatch: "#d97706", accentColor: "#d97706" },
    { labelKey: "panelBrandKit.color.navy", swatch: "#1d4ed8", accentColor: "#1d4ed8" },
    { labelKey: "panelBrandKit.color.jade", swatch: "#0f766e", accentColor: "#0f766e" },
  ],
  "linen-gray": [
    { labelKey: "panelBrandKit.color.warmGray", swatch: "#78716c", accentColor: "#78716c" },
    { labelKey: "panelBrandKit.color.mocha", swatch: "#92400e", accentColor: "#92400e" },
    { labelKey: "panelBrandKit.color.olive", swatch: "#4d7c0f", accentColor: "#4d7c0f" },
  ],
  "spotlight-neon": [
    { labelKey: "panelBrandKit.color.neonOrange", swatch: "#f97316", accentColor: "#f97316" },
    { labelKey: "panelBrandKit.color.lime", swatch: "#a3e635", accentColor: "#a3e635" },
    { labelKey: "panelBrandKit.color.neonPink", swatch: "#ec4899", accentColor: "#ec4899" },
  ],
  "midnight-slice": [
    { labelKey: "panelBrandKit.color.amber", swatch: "#f59e0b", accentColor: "#f59e0b" },
    { labelKey: "panelBrandKit.color.azure", swatch: "#2563eb", accentColor: "#2563eb" },
    { labelKey: "panelBrandKit.color.brightGreen", swatch: "#10b981", accentColor: "#10b981" },
  ],
  "executive-ink": [
    { labelKey: "panelBrandKit.color.officeGold", swatch: "#d97706", accentColor: "#d97706" },
    { labelKey: "panelBrandKit.color.managementBlue", swatch: "#2563eb", accentColor: "#2563eb" },
    { labelKey: "panelBrandKit.color.charcoal", swatch: "#475569", accentColor: "#475569" },
  ],
  "teal-wave": [
    { labelKey: "panelBrandKit.color.turquoise", swatch: "#14b8a6", accentColor: "#14b8a6" },
    { labelKey: "panelBrandKit.color.seaBlue", swatch: "#0ea5e9", accentColor: "#0ea5e9" },
    { labelKey: "panelBrandKit.color.seaGreen", swatch: "#10b981", accentColor: "#10b981" },
  ],
  "ruby-signature": [
    { labelKey: "panelBrandKit.color.ruby", swatch: "#be123c", accentColor: "#be123c" },
    { labelKey: "panelBrandKit.color.roseGold", swatch: "#f59e8b", accentColor: "#f59e8b" },
    { labelKey: "panelBrandKit.color.plum", swatch: "#7c3aed", accentColor: "#7c3aed" },
    { labelKey: "panelBrandKit.color.navy", swatch: "#1d4ed8", accentColor: "#1d4ed8" },
    { labelKey: "panelBrandKit.color.sapphire", swatch: "#2563eb", accentColor: "#2563eb" },
    { labelKey: "panelBrandKit.color.cobalt", swatch: "#0f766e", accentColor: "#0f766e" },
    { labelKey: "panelBrandKit.color.emerald", swatch: "#059669", accentColor: "#059669" },
    { labelKey: "panelBrandKit.color.jade", swatch: "#14b8a6", accentColor: "#14b8a6" },
    { labelKey: "panelBrandKit.color.forest", swatch: "#166534", accentColor: "#166534" },
  ],
};

const POSTER_TEMPLATES: Array<{ value: PosterTemplate; labelKey: MessageKey; family: PosterFamily }> = [
  { value: "lux-promo", labelKey: "panelBrandKit.poster.template.luxPromo", family: "hero" },
  { value: "studio-pop", labelKey: "panelBrandKit.poster.template.studioPop", family: "hero" },
  { value: "clean-invite", labelKey: "panelBrandKit.poster.template.cleanInvite", family: "clean" },
  { value: "night-glow", labelKey: "panelBrandKit.poster.template.nightGlow", family: "impact" },
  { value: "golden-qr", labelKey: "panelBrandKit.poster.template.goldenQr", family: "impact" },
  { value: "soft-canvas", labelKey: "panelBrandKit.poster.template.softCanvas", family: "clean" },
  { value: "skyline-ad", labelKey: "panelBrandKit.poster.template.skylineAd", family: "hero" },
  { value: "emerald-poster", labelKey: "panelBrandKit.poster.template.emeraldPoster", family: "clean" },
  { value: "mono-impact", labelKey: "panelBrandKit.poster.template.monoImpact", family: "impact" },
];

const POSTER_DIMENSIONS: Record<PosterSize, { width: number; height: number; label: string }> = {
  a5: { width: 559, height: 794, label: "A5" },
  a4: { width: 794, height: 1123, label: "A4" },
  a3: { width: 1123, height: 1587, label: "A3" },
};

const BUSINESS_CARD_DIMENSIONS = { width: 1050, height: 600 };

function getRubySignaturePalette(tone: RubySignatureTone) {
  switch (tone) {
    case "rose-gold":
      return {
        background: "linear-gradient(135deg, #7c2d12 0%, #f59e8b 100%)",
        line: "bg-white/18",
        textSoft: "text-white/80",
        badge: "text-orange-100/80",
        logoAccent: "#f59e8b",
      };
    case "plum":
      return {
        background: "linear-gradient(135deg, #3b0764 0%, #7c3aed 100%)",
        line: "bg-white/18",
        textSoft: "text-white/80",
        badge: "text-fuchsia-100/80",
        logoAccent: "#8b5cf6",
      };
    case "navy":
      return {
        background: "linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%)",
        line: "bg-white/18",
        textSoft: "text-white/78",
        badge: "text-blue-100/80",
        logoAccent: "#3b82f6",
      };
    case "sapphire":
      return {
        background: "linear-gradient(135deg, #172554 0%, #2563eb 100%)",
        line: "bg-white/18",
        textSoft: "text-white/78",
        badge: "text-sky-100/80",
        logoAccent: "#60a5fa",
      };
    case "cobalt":
      return {
        background: "linear-gradient(135deg, #082f49 0%, #0f766e 100%)",
        line: "bg-white/18",
        textSoft: "text-white/80",
        badge: "text-cyan-100/80",
        logoAccent: "#14b8a6",
      };
    case "emerald":
      return {
        background: "linear-gradient(135deg, #052e2b 0%, #059669 100%)",
        line: "bg-white/18",
        textSoft: "text-white/80",
        badge: "text-emerald-100/80",
        logoAccent: "#10b981",
      };
    case "jade":
      return {
        background: "linear-gradient(135deg, #134e4a 0%, #14b8a6 100%)",
        line: "bg-white/18",
        textSoft: "text-white/80",
        badge: "text-teal-100/80",
        logoAccent: "#2dd4bf",
      };
    case "forest":
      return {
        background: "linear-gradient(135deg, #14532d 0%, #166534 100%)",
        line: "bg-white/18",
        textSoft: "text-white/80",
        badge: "text-green-100/80",
        logoAccent: "#22c55e",
      };
    default:
      return {
        background: "linear-gradient(135deg, #3f0d1f 0%, #7f1d1d 100%)",
        line: "bg-white/20",
        textSoft: "text-white/78",
        badge: "text-white/65",
        logoAccent: "#be123c",
      };
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getPosterMetrics(size: PosterSize, dimensions: { width: number; height: number }) {
  const scale = dimensions.width / POSTER_DIMENSIONS.a4.width;

  return {
    padding: Math.round(clamp(48 * scale, 28, 68)),
    logo: Math.round(clamp(120 * scale, 78, 148)),
    businessName: clamp(36 * scale, 22, 44),
    supportText: clamp(18 * scale, 13, 22),
    title: clamp((size === "a3" ? 80 : size === "a5" ? 52 : 64) * scale, 30, 88),
    description: clamp((size === "a3" ? 28 : size === "a5" ? 18 : 22) * scale, 14, 30),
    footer: clamp((size === "a3" ? 24 : size === "a5" ? 16 : 20) * scale, 13, 26),
    website: clamp((size === "a3" ? 34 : size === "a5" ? 22 : 28) * scale, 16, 36),
    qr: Math.round(clamp((size === "a3" ? 360 : size === "a5" ? 220 : 260) * scale, 160, 420)),
    gap: Math.round(clamp(32 * scale, 18, 40)),
    radius: Math.round(clamp(52 * scale, 28, 56)),
  };
}

function ScaledPreview({
  designWidth,
  designHeight,
  targetRef,
  viewportHeightRatio = 0.72,
  children,
}: {
  designWidth: number;
  designHeight: number;
  targetRef: RefObject<HTMLDivElement | null>;
  viewportHeightRatio?: number;
  children: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const updateScale = () => {
      const availableWidth = Math.max(node.clientWidth - 16, 220);
      const availableHeight = typeof window !== "undefined" ? Math.max(window.innerHeight * viewportHeightRatio, 220) : Number.POSITIVE_INFINITY;
      setScale(Math.min(1, availableWidth / designWidth, availableHeight / designHeight));
    };

    updateScale();

    const observer = new ResizeObserver(updateScale);
    observer.observe(node);
    window.addEventListener("resize", updateScale);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateScale);
    };
  }, [designHeight, designWidth, viewportHeightRatio]);

  return (
    <div ref={containerRef} className="mx-auto w-full max-w-full overflow-hidden rounded-[28px] border border-border/70 bg-background/35 p-3 sm:p-4">
      <div className="flex justify-center" style={{ height: designHeight * scale }}>
        <div
          style={{
            width: designWidth,
            height: designHeight,
            transform: `scale(${scale})`,
            transformOrigin: "top center",
          }}
        >
          <div ref={targetRef}>{children}</div>
        </div>
      </div>
    </div>
  );
}

function getPosterFamily(template: PosterTemplate): PosterFamily {
  return POSTER_TEMPLATES.find((item) => item.value === template)?.family ?? "hero";
}

function fallbackMonogram(name: string) {
  return (name.trim()[0] || "B").toUpperCase();
}

function safeFileName(value: string) {
  return value.trim().replace(/\s+/g, "-").replace(/[^\w\u0600-\u06FF-]/g, "") || "design";
}

type BrandKitPreviewCopy = {
  businessName: string;
  ownerName: string;
  address: string;
  secondaryPhone: string;
  contactLabel: string;
  phoneLabel: string;
  addressLabel: string;
  quickEntry: string;
  businessSite: string;
  bookingManagement: string;
  alwaysOnline: string;
  brandSignature: string;
  brandIdentity: string;
  brandLogo: string;
  ownerLabel: string;
  contactWays: string;
  luxuryIdentity: string;
  simpleIntro: string;
  modernPresentation: string;
  executiveIdentity: string;
  scanAndConnect: string;
  tealWave: string;
  signatureCard: string;
  signatureAccess: string;
  spotlightBrand: string;
  spotlightIntro: string;
  brightLuxuryIntro: string;
  subtitleSite: string;
  subtitleLuxury: string;
  subtitleSimple: string;
  subtitleModern: string;
  subtitleOfficial: string;
  noteOfficial: string;
  subtitleTeal: string;
  subtitleSignature: string;
  subtitleFastAccess: string;
  subtitleSpotlight: string;
  subtitleBright: string;
  scanPrompt: string;
  scanVisit: string;
  websiteLabel: string;
  backNoteQr: string;
  backNoteDirect: string;
  backNoteFastAccess: string;
  backNoteSimpleScan: string;
  backNoteInfoAccess: string;
  posterSupportClean: string;
  posterSupportImpact: string;
  posterSupportHero: string;
  posterTitleClean: string;
  posterTitleImpact: string;
  posterTitleHero: string;
  posterDescriptionClean: string;
  posterDescriptionImpact: string;
  posterDescriptionHero: string;
  posterFooterClean: string;
  posterFooterImpact: string;
  posterFooterHero: string;
};

function useBrandKitPreviewCopy(audienceBusinessLabel: string): BrandKitPreviewCopy {
  const t = useT();

  return {
    businessName: t("panelBrandKit.preview.businessName", { business: audienceBusinessLabel }),
    ownerName: t("panelBrandKit.preview.ownerName", { business: audienceBusinessLabel }),
    address: t("panelBrandKit.preview.address", { business: audienceBusinessLabel }),
    secondaryPhone: t("panelBrandKit.preview.secondaryPhone"),
    contactLabel: t("panelBrandKit.preview.contact"),
    phoneLabel: t("panelBrandKit.preview.phone"),
    addressLabel: t("panelBrandKit.preview.addressLabel"),
    quickEntry: t("panelBrandKit.preview.quickEntry"),
    businessSite: t("panelBrandKit.preview.businessSite"),
    bookingManagement: t("panelBrandKit.preview.bookingManagement"),
    alwaysOnline: t("panelBrandKit.preview.alwaysOnline"),
    brandSignature: t("panelBrandKit.preview.brandSignature"),
    brandIdentity: t("panelBrandKit.preview.brandIdentity"),
    brandLogo: t("panelBrandKit.preview.brandLogo"),
    ownerLabel: t("panelBrandKit.preview.ownerLabel"),
    contactWays: t("panelBrandKit.preview.contactWays"),
    luxuryIdentity: t("panelBrandKit.preview.luxuryIdentity", { business: audienceBusinessLabel }),
    simpleIntro: t("panelBrandKit.preview.simpleIntro"),
    modernPresentation: t("panelBrandKit.preview.modernPresentation", { business: audienceBusinessLabel }),
    executiveIdentity: t("panelBrandKit.preview.executiveIdentity"),
    scanAndConnect: t("panelBrandKit.preview.scanAndConnect"),
    tealWave: t("panelBrandKit.preview.tealWave"),
    signatureCard: t("panelBrandKit.preview.signatureCard"),
    signatureAccess: t("panelBrandKit.preview.signatureAccess"),
    spotlightBrand: t("panelBrandKit.preview.spotlightBrand", { business: audienceBusinessLabel }),
    spotlightIntro: t("panelBrandKit.preview.spotlightIntro", { business: audienceBusinessLabel }),
    brightLuxuryIntro: t("panelBrandKit.preview.brightLuxuryIntro"),
    subtitleSite: t("panelBrandKit.preview.subtitleSite", { business: audienceBusinessLabel }),
    subtitleLuxury: t("panelBrandKit.preview.subtitleLuxury", { business: audienceBusinessLabel }),
    subtitleSimple: t("panelBrandKit.preview.subtitleSimple", { business: audienceBusinessLabel }),
    subtitleModern: t("panelBrandKit.preview.subtitleModern", { business: audienceBusinessLabel }),
    subtitleOfficial: t("panelBrandKit.preview.subtitleOfficial", { business: audienceBusinessLabel }),
    noteOfficial: t("panelBrandKit.preview.noteOfficial", { business: audienceBusinessLabel }),
    subtitleTeal: t("panelBrandKit.preview.subtitleTeal", { business: audienceBusinessLabel }),
    subtitleSignature: t("panelBrandKit.preview.subtitleSignature", { business: audienceBusinessLabel }),
    subtitleFastAccess: t("panelBrandKit.preview.subtitleFastAccess", { business: audienceBusinessLabel }),
    subtitleSpotlight: t("panelBrandKit.preview.subtitleSpotlight", { business: audienceBusinessLabel }),
    subtitleBright: t("panelBrandKit.preview.subtitleBright", { business: audienceBusinessLabel }),
    scanPrompt: t("panelBrandKit.preview.scanPrompt"),
    scanVisit: t("panelBrandKit.preview.scanVisit"),
    websiteLabel: t("panelBrandKit.preview.websiteLabel"),
    backNoteQr: t("panelBrandKit.preview.backNoteQr", { business: audienceBusinessLabel }),
    backNoteDirect: t("panelBrandKit.preview.backNoteDirect", { business: audienceBusinessLabel }),
    backNoteFastAccess: t("panelBrandKit.preview.backNoteFastAccess", { business: audienceBusinessLabel }),
    backNoteSimpleScan: t("panelBrandKit.preview.backNoteSimpleScan", { business: audienceBusinessLabel }),
    backNoteInfoAccess: t("panelBrandKit.preview.backNoteInfoAccess", { business: audienceBusinessLabel }),
    posterSupportClean: t("panelBrandKit.preview.posterSupportClean", { business: audienceBusinessLabel }),
    posterSupportImpact: t("panelBrandKit.preview.posterSupportImpact"),
    posterSupportHero: t("panelBrandKit.preview.posterSupportHero", { business: audienceBusinessLabel }),
    posterTitleClean: t("panelBrandKit.preview.posterTitleClean", { business: audienceBusinessLabel }),
    posterTitleImpact: t("panelBrandKit.preview.posterTitleImpact"),
    posterTitleHero: t("panelBrandKit.preview.posterTitleHero", { business: audienceBusinessLabel }),
    posterDescriptionClean: t("panelBrandKit.preview.posterDescriptionClean", { business: audienceBusinessLabel }),
    posterDescriptionImpact: t("panelBrandKit.preview.posterDescriptionImpact", { business: audienceBusinessLabel }),
    posterDescriptionHero: t("panelBrandKit.preview.posterDescriptionHero", { business: audienceBusinessLabel }),
    posterFooterClean: t("panelBrandKit.preview.posterFooterClean"),
    posterFooterImpact: t("panelBrandKit.preview.posterFooterImpact"),
    posterFooterHero: t("panelBrandKit.preview.posterFooterHero"),
  };
}

function LogoBadge({ logoUrl, businessName, accentColor, size = 120 }: { logoUrl?: string | null; businessName: string; accentColor: string; size?: number }) {
  if (logoUrl) {
    return <img src={logoUrl} alt={businessName} style={{ width: size, height: size }} className="rounded-[28px] object-cover shadow-2xl" />;
  }

  return (
    <div
      style={{ width: size, height: size, background: `linear-gradient(135deg, ${accentColor}, #0f172a)` }}
      className="flex items-center justify-center rounded-[28px] text-4xl font-black text-white shadow-2xl"
    >
      {fallbackMonogram(businessName)}
    </div>
  );
}

function BusinessCardFront({
  state,
  logoUrl,
  audienceBusinessLabel,
}: {
  state: BusinessCardState;
  logoUrl?: string | null;
  audienceBusinessLabel: string;
}) {
  const { dir } = useLocale();
  const copy = useBrandKitPreviewCopy(audienceBusinessLabel);

  if (state.template === "royal-night") {
    return (
      <div
        dir={dir}
        style={{
          width: BUSINESS_CARD_DIMENSIONS.width,
          height: BUSINESS_CARD_DIMENSIONS.height,
          background: `radial-gradient(circle at top right, ${state.accentColor}55, transparent 34%), linear-gradient(135deg, #081120 0%, #12213b 48%, #1d3156 100%)`,
        }}
        className="relative overflow-hidden rounded-[42px] p-10 text-white"
      >
        <div className="absolute -left-16 bottom-0 h-64 w-64 rounded-full bg-white/6 blur-3xl" />
        <div className="absolute right-0 top-0 h-40 w-40 rounded-bl-[56px] bg-white/6" />
        <div className="relative flex h-full items-stretch justify-between gap-10">
          <div className="flex min-w-0 flex-1 flex-col justify-between text-start">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/8 px-4 py-2 text-sm font-bold text-white/80">
                <Sparkles className="h-4 w-4" />
                {state.subtitle || copy.subtitleFastAccess}
              </div>
              <div className="space-y-4">
                <div className="text-5xl font-black leading-tight">{state.businessName || copy.businessName}</div>
                <div className="max-w-[420px] text-2xl font-semibold text-white/80">{state.subtitle || copy.subtitleSite}</div>
                <div className="text-lg text-white/65">{state.ownerName || copy.ownerName}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-lg">
              <div className="rounded-[24px] border border-white/12 bg-white/8 p-5">
                <div className="mb-2 text-sm text-white/55">{copy.phoneLabel}</div>
                <div className="font-black">{state.phone || "۰۹۱۲..."}</div>
                <div className="mt-1 text-sm text-white/70">{state.secondaryPhone || copy.secondaryPhone}</div>
              </div>
              <div className="rounded-[24px] border border-white/12 bg-white/8 p-5">
                <div className="mb-2 text-sm text-white/55">{copy.addressLabel}</div>
                <div className="line-clamp-3 leading-8 text-white/82">{state.address || copy.address}</div>
              </div>
            </div>
          </div>

          <div className="flex w-[220px] flex-col items-center justify-between rounded-[34px] border border-white/12 bg-white/10 p-6">
            <LogoBadge logoUrl={logoUrl} businessName={state.businessName} accentColor={state.accentColor} size={132} />
            <div className="w-full rounded-[24px] bg-white/12 px-4 py-5 text-center">
              <div className="text-sm text-white/60">{copy.bookingManagement}</div>
              <div className="mt-2 text-2xl font-black">{copy.alwaysOnline}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (state.template === "golden-frame") {
    return (
      <div
        dir={dir}
        style={{
          width: BUSINESS_CARD_DIMENSIONS.width,
          height: BUSINESS_CARD_DIMENSIONS.height,
          background: "linear-gradient(135deg, #171717 0%, #31210c 100%)",
          border: `12px solid ${state.accentColor}`,
        }}
        className="relative overflow-hidden rounded-[42px] p-10 text-amber-50"
      >
        <div className="absolute inset-6 rounded-[26px] border border-white/10" />
        <div className="relative flex h-full items-center gap-8 text-start">
          <div className="flex min-w-0 flex-1 flex-col justify-between">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/8 px-4 py-2 text-sm font-bold text-amber-100">
                <Sparkles className="h-4 w-4" />
                {copy.luxuryIdentity}
              </div>
              <div className="text-5xl font-black">{state.businessName || copy.businessName}</div>
              <div className="max-w-[450px] text-2xl leading-10 text-amber-100/80">{state.subtitle || copy.subtitleLuxury}</div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-[24px] bg-white/6 p-5">
                <div className="mb-2 text-sm text-amber-100/60">{copy.phoneLabel}</div>
                <div className="text-2xl font-black">{state.phone || "۰۹۱۲..."}</div>
                <div className="mt-1 text-sm text-amber-100/70">{state.secondaryPhone || copy.secondaryPhone}</div>
              </div>
              <div className="rounded-[24px] bg-white/6 p-5">
                <div className="mb-2 text-sm text-amber-100/60">{copy.addressLabel}</div>
                <div className="line-clamp-3 leading-8 text-amber-50/85">{state.address || copy.address}</div>
              </div>
            </div>
          </div>
          <div className="flex w-[250px] flex-col items-center justify-center gap-6 rounded-[34px] bg-black/20 p-6">
            <LogoBadge logoUrl={logoUrl} businessName={state.businessName} accentColor={state.accentColor} size={150} />
            <div className="text-center">
              <div className="text-sm text-amber-100/65">{copy.brandSignature}</div>
              <div className="mt-2 text-2xl font-black">{state.ownerName || state.businessName || copy.businessName}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (state.template === "linen-gray") {
    return (
      <div
        dir={dir}
        style={{
          width: BUSINESS_CARD_DIMENSIONS.width,
          height: BUSINESS_CARD_DIMENSIONS.height,
          background: "linear-gradient(135deg, #f5f5f4 0%, #e7e5e4 100%)",
        }}
        className="relative overflow-hidden rounded-[42px] p-10 text-stone-900"
      >
        <div className="absolute left-0 top-0 h-full w-[32%] bg-stone-900" />
        <div className="relative flex h-full items-center gap-8 text-start">
          <div className="flex w-[250px] shrink-0 flex-col items-center justify-center gap-5 text-white">
            <LogoBadge logoUrl={logoUrl} businessName={state.businessName} accentColor={state.accentColor} size={130} />
            <div className="text-center">
              <div className="text-sm text-white/60">{copy.brandLogo}</div>
              <div className="mt-2 text-xl font-black">{state.ownerName || state.businessName || copy.businessName}</div>
            </div>
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-between">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold text-stone-600" style={{ backgroundColor: `${state.accentColor}22` }}>
                <Sparkles className="h-4 w-4" />
                {copy.simpleIntro}
              </div>
              <div className="text-5xl font-black">{state.businessName || copy.businessName}</div>
              <div className="max-w-[430px] text-2xl leading-10 text-stone-600">{state.subtitle || copy.subtitleSimple}</div>
            </div>
            <div className="flex flex-wrap gap-3 text-lg">
              <div className="rounded-full border border-stone-300 bg-white/80 px-5 py-3 font-bold">{state.phone || "۰۹۱۲..."}</div>
              <div className="rounded-full border border-stone-300 bg-white/80 px-5 py-3">{state.secondaryPhone || copy.secondaryPhone}</div>
              <div className="w-full rounded-[22px] border border-stone-300 bg-white/80 p-4 leading-8">{state.address || copy.address}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (state.template === "midnight-slice") {
    return (
      <div
        dir={dir}
        style={{
          width: BUSINESS_CARD_DIMENSIONS.width,
          height: BUSINESS_CARD_DIMENSIONS.height,
          background: "linear-gradient(135deg, #020617 0%, #0f172a 100%)",
        }}
        className="relative overflow-hidden rounded-[42px] p-10 text-white"
      >
        <div className="absolute -right-12 top-0 h-full w-[48%] -skew-x-12" style={{ backgroundColor: `${state.accentColor}cc` }} />
        <div className="relative flex h-full items-center justify-between gap-8 text-start">
          <div className="flex min-w-0 flex-1 flex-col justify-between">
            <div className="space-y-4">
              <div className="text-5xl font-black">{state.businessName || copy.businessName}</div>
              <div className="max-w-[410px] text-2xl leading-10 text-white/80">{state.subtitle || copy.subtitleModern}</div>
            </div>
            <div className="space-y-3">
              <div className="text-2xl font-black">{state.phone || "۰۹۱۲..."}</div>
              <div className="text-lg text-white/70">{state.secondaryPhone || copy.secondaryPhone}</div>
              <div className="max-w-[420px] leading-8 text-white/75">{state.address || copy.address}</div>
            </div>
          </div>
          <div className="flex w-[260px] shrink-0 flex-col items-center justify-center gap-5 text-slate-950">
            <LogoBadge logoUrl={logoUrl} businessName={state.businessName} accentColor={state.accentColor} size={136} />
            <div className="rounded-[24px] bg-white/80 px-5 py-4 text-center">
              <div className="text-sm text-slate-700">{copy.ownerLabel}</div>
              <div className="mt-2 text-2xl font-black">{state.ownerName || state.businessName || copy.businessName}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (state.template === "executive-ink") {
    return (
      <div
        dir={dir}
        style={{
          width: BUSINESS_CARD_DIMENSIONS.width,
          height: BUSINESS_CARD_DIMENSIONS.height,
          background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
        }}
        className="relative overflow-hidden rounded-[42px] p-10 text-slate-950"
      >
        <div className="absolute inset-x-0 top-0 h-36 bg-slate-950" />
        <div className="absolute left-10 top-10 h-16 w-40 rounded-full bg-white/8" />
        <div className="relative flex h-full flex-col justify-between text-start">
          <div className="grid grid-cols-[1fr_auto] items-start gap-8 rounded-[30px] bg-slate-950 px-8 py-7 text-white shadow-xl">
            <div className="space-y-3">
              <div className="text-sm font-bold text-white/70">{copy.executiveIdentity}</div>
              <div className="text-4xl font-black leading-tight">{state.businessName || copy.businessName}</div>
              <div className="max-w-[430px] text-lg leading-8 text-white/72">{state.subtitle || copy.subtitleOfficial}</div>
            </div>
            <LogoBadge logoUrl={logoUrl} businessName={state.businessName} accentColor={state.accentColor} size={110} />
          </div>
          <div className="grid grid-cols-[1.2fr_1fr] gap-8 pt-3">
            <div className="space-y-4 rounded-[28px] border border-slate-200 bg-white/80 p-6">
              <div className="text-sm font-bold text-slate-500">{copy.ownerLabel}</div>
              <div className="text-2xl font-black">{state.ownerName || copy.ownerName}</div>
              <div className="text-xl leading-10 text-slate-600">{state.note || copy.noteOfficial}</div>
            </div>
            <div className="space-y-3 rounded-[26px] border border-slate-200 bg-slate-50 p-5">
              <div className="text-sm font-bold text-slate-500">{copy.contactWays}</div>
              <div className="font-black">{state.phone || "۰۹۱۲..."}</div>
              <div className="text-slate-600">{state.secondaryPhone || copy.secondaryPhone}</div>
              <div className="leading-8 text-slate-600">{state.address || copy.address}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (state.template === "teal-wave") {
    return (
      <div
        dir={dir}
        style={{
          width: BUSINESS_CARD_DIMENSIONS.width,
          height: BUSINESS_CARD_DIMENSIONS.height,
          background: "linear-gradient(135deg, #082f49 0%, #0f766e 100%)",
        }}
        className="relative overflow-hidden rounded-[42px] p-10 text-white"
      >
        <div className="absolute -left-20 bottom-0 h-64 w-[420px] rounded-t-full bg-white/10" />
        <div className="absolute -right-10 top-0 h-56 w-[360px] rounded-b-full bg-white/10" />
        <div className="relative flex h-full items-stretch justify-between gap-8 text-start">
          <div className="flex min-w-0 flex-1 flex-col justify-between">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-bold text-white/85">
                <Sparkles className="h-4 w-4" />
                {copy.tealWave}
              </div>
              <div className="text-5xl font-black">{state.businessName || copy.businessName}</div>
              <div className="max-w-[430px] text-2xl leading-10 text-white/80">{state.subtitle || copy.subtitleTeal}</div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-[24px] bg-black/15 p-5">
                <div className="mb-2 text-sm text-white/55">{copy.contactLabel}</div>
                <div className="text-2xl font-black">{state.phone || "۰۹۱۲..."}</div>
                <div className="mt-1 text-sm text-white/70">{state.secondaryPhone || copy.secondaryPhone}</div>
              </div>
              <div className="rounded-[24px] bg-black/15 p-5">
                <div className="mb-2 text-sm text-white/55">{copy.addressLabel}</div>
                <div className="line-clamp-3 leading-8 text-white/82">{state.address || copy.address}</div>
              </div>
            </div>
          </div>
          <div className="flex w-[230px] flex-col items-center justify-center gap-5">
            <LogoBadge logoUrl={logoUrl} businessName={state.businessName} accentColor={state.accentColor} size={140} />
            <div className="text-center">
              <div className="text-sm text-white/60">{copy.brandIdentity}</div>
              <div className="mt-2 text-2xl font-black">{state.ownerName || state.businessName || copy.businessName}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (state.template === "ruby-signature") {
    const palette = getRubySignaturePalette(state.rubyTone);

    return (
      <div
        dir={dir}
        style={{
          width: BUSINESS_CARD_DIMENSIONS.width,
          height: BUSINESS_CARD_DIMENSIONS.height,
          background: palette.background,
        }}
        className="relative overflow-hidden rounded-[42px] p-10 text-white"
      >
        <div className={`absolute inset-x-10 top-10 h-[1px] ${palette.line}`} />
        <div className={`absolute inset-x-10 bottom-10 h-[1px] ${palette.line}`} />
        <div className="relative flex h-full items-center justify-between gap-8 text-start">
          <div className="flex min-w-0 flex-1 flex-col justify-between">
            <div className="space-y-5">
              <div className={`text-sm font-bold tracking-wide ${palette.badge}`}>{copy.signatureCard}</div>
              <div className="text-6xl font-black">{state.businessName || copy.businessName}</div>
              <div className={`max-w-[430px] text-2xl leading-10 ${palette.textSoft}`}>{state.subtitle || copy.subtitleSignature}</div>
            </div>
            <div className="space-y-2">
              <div className="text-2xl font-black">{state.ownerName || copy.ownerName}</div>
              <div className="text-lg text-white/70">{state.phone || "۰۹۱۲..."}{state.secondaryPhone ? ` • ${state.secondaryPhone}` : ""}</div>
              <div className={`max-w-[420px] leading-8 ${palette.textSoft}`}>{state.address || copy.address}</div>
            </div>
          </div>
          <div className="flex w-[210px] shrink-0 items-center justify-center">
            <LogoBadge logoUrl={logoUrl} businessName={state.businessName} accentColor={palette.logoAccent} size={150} />
          </div>
        </div>
      </div>
    );
  }

  if (state.template === "minimal-ivory") {
    return (
      <div
        dir={dir}
        style={{
          width: BUSINESS_CARD_DIMENSIONS.width,
          height: BUSINESS_CARD_DIMENSIONS.height,
          background: "linear-gradient(135deg, #ffffff 0%, #eef3ff 100%)",
        }}
        className="relative overflow-hidden rounded-[42px] border-[10px] p-10 text-slate-900"
      >
        <div className="absolute inset-y-0 right-0 w-4" style={{ backgroundColor: state.accentColor }} />
        <div className="relative flex h-full items-stretch justify-between gap-8 text-start">
          <div className="flex min-w-0 flex-1 flex-col justify-between">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-3 rounded-full bg-slate-900/5 px-4 py-2 text-sm font-bold text-slate-600">
                <Sparkles className="h-4 w-4" />
                {state.subtitle || copy.subtitleFastAccess}
              </div>
              <div className="space-y-3">
                <div className="text-5xl font-black leading-tight">{state.businessName || copy.businessName}</div>
                <div className="max-w-[420px] text-2xl font-semibold text-slate-600">{state.subtitle || copy.subtitleFastAccess}</div>
                <div className="text-lg text-slate-500">{state.ownerName || copy.ownerName}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-lg">
              <div className="rounded-[24px] border border-slate-200 bg-white/90 p-5">
                <div className="mb-2 text-sm text-slate-500">{copy.phoneLabel}</div>
                <div className="font-black">{state.phone || "۰۹۱۲..."}</div>
                <div className="mt-1 text-sm text-slate-500">{state.secondaryPhone || copy.secondaryPhone}</div>
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-white/90 p-5">
                <div className="mb-2 text-sm text-slate-500">{copy.addressLabel}</div>
                <div className="line-clamp-3 leading-8 text-slate-700">{state.address || copy.address}</div>
              </div>
            </div>
          </div>

          <div className="flex w-[220px] flex-col items-center justify-between rounded-[34px] border border-slate-200 bg-white p-6">
            <LogoBadge logoUrl={logoUrl} businessName={state.businessName} accentColor={state.accentColor} size={132} />
            <div className="w-full rounded-[24px] px-4 py-5 text-center text-white" style={{ backgroundColor: state.accentColor }}>
              <div className="text-sm text-white/75">{copy.quickEntry}</div>
              <div className="mt-2 text-2xl font-black">{copy.businessSite}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (state.template === "spotlight-neon") {
    return (
      <div
        dir={dir}
        style={{
          width: BUSINESS_CARD_DIMENSIONS.width,
          height: BUSINESS_CARD_DIMENSIONS.height,
          background: `radial-gradient(circle at center, ${state.accentColor}55, transparent 30%), linear-gradient(135deg, #111827 0%, #020617 100%)`,
        }}
        className="relative overflow-hidden rounded-[42px] p-10 text-white"
      >
        <div className="absolute inset-y-0 left-0 w-1/3 bg-white/5" />
        <div className="relative flex h-full items-center gap-10 text-start">
          <div className="flex w-[250px] shrink-0 flex-col items-center justify-center gap-6 rounded-[34px] border border-white/10 bg-white/10 p-8">
            <LogoBadge logoUrl={logoUrl} businessName={state.businessName} accentColor={state.accentColor} size={140} />
            <div className="text-center">
              <div className="text-sm text-white/60">{copy.spotlightBrand}</div>
              <div className="mt-2 text-2xl font-black">{state.ownerName || state.businessName || copy.businessName}</div>
            </div>
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-between">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-4 py-2 text-sm font-bold text-white/80">
                <Sparkles className="h-4 w-4" />
                {copy.spotlightIntro}
              </div>
              <div className="space-y-3">
                <div className="text-5xl font-black leading-tight">{state.businessName || copy.businessName}</div>
                <div className="max-w-[420px] text-2xl font-semibold leading-10 text-white/80">{state.subtitle || copy.subtitleSpotlight}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-[24px] border border-white/12 bg-white/8 p-5">
                <div className="mb-2 text-sm text-white/55">{copy.phoneLabel}</div>
                <div className="text-2xl font-black">{state.phone || "۰۹۱۲..."}</div>
                <div className="mt-1 text-sm text-white/70">{state.secondaryPhone || copy.secondaryPhone}</div>
              </div>
              <div className="rounded-[24px] border border-white/12 bg-white/8 p-5">
                <div className="mb-2 text-sm text-white/55">{copy.addressLabel}</div>
                <div className="line-clamp-3 leading-8 text-white/82">{state.address || copy.address}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      dir={dir}
      style={{
        width: BUSINESS_CARD_DIMENSIONS.width,
        height: BUSINESS_CARD_DIMENSIONS.height,
        background: "linear-gradient(135deg, #ffffff 0%, #f7f7f5 44%, #efeadd 100%)",
      }}
      className="relative overflow-hidden rounded-[42px] border border-[#e7dcc1] p-10 text-slate-900"
    >
      <div className="absolute inset-y-0 right-0 w-5" style={{ backgroundColor: state.accentColor }} />
      <div className="absolute left-14 top-14 h-24 w-24 rounded-full border border-[#d9ccb0] bg-white/70" />
      <div className="relative flex h-full items-stretch justify-between gap-10">
        <div className="flex min-w-0 flex-1 flex-col justify-between text-start">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-3 rounded-full border border-[#e5ddca] bg-white/85 px-4 py-2 text-sm font-bold text-amber-900/80">
              <Sparkles className="h-4 w-4" />
              {copy.brightLuxuryIntro}
            </div>
            <div className="space-y-4">
              <div className="text-5xl font-black leading-tight">{state.businessName || copy.businessName}</div>
              <div className="max-w-[420px] text-2xl font-semibold text-slate-600">{state.subtitle || copy.subtitleBright}</div>
              <div className="text-lg text-slate-500">{state.ownerName || copy.ownerName}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-lg">
            <div className="rounded-[24px] border border-[#e8e2d7] bg-white/85 p-5 shadow-sm">
              <div className="mb-2 text-sm text-slate-500">{copy.phoneLabel}</div>
              <div className="font-black">{state.phone || "۰۹۱۲..."}</div>
              <div className="mt-1 text-sm text-slate-500">{state.secondaryPhone || copy.secondaryPhone}</div>
            </div>
            <div className="rounded-[24px] border border-[#e8e2d7] bg-white/85 p-5 shadow-sm">
              <div className="mb-2 text-sm text-slate-500">{copy.addressLabel}</div>
              <div className="line-clamp-3 leading-8 text-slate-700">{state.address || copy.address}</div>
            </div>
          </div>
        </div>

        <div className="flex w-[220px] flex-col items-center justify-between rounded-[34px] border border-[#e8e2d7] bg-white/90 p-6 shadow-lg">
          <LogoBadge logoUrl={logoUrl} businessName={state.businessName} accentColor={state.accentColor} size={132} />
          <div className="w-full rounded-[24px] px-4 py-5 text-center text-white" style={{ backgroundColor: state.accentColor }}>
            <div className="text-sm text-white/75">{copy.quickEntry}</div>
            <div className="mt-2 text-2xl font-black">{copy.businessSite}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BusinessCardBack({
  state,
  logoUrl,
  audienceBusinessLabel,
}: {
  state: BusinessCardState;
  logoUrl?: string | null;
  audienceBusinessLabel: string;
}) {
  const { dir } = useLocale();
  const copy = useBrandKitPreviewCopy(audienceBusinessLabel);
  if (state.template === "royal-night") {
    return (
      <div
        dir={dir}
        style={{
          width: BUSINESS_CARD_DIMENSIONS.width,
          height: BUSINESS_CARD_DIMENSIONS.height,
          background: `linear-gradient(135deg, ${state.accentColor} 0%, #111827 42%, #020617 100%)`,
        }}
        className="relative overflow-hidden rounded-[42px] p-10 text-white"
      >
        <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-52 w-52 rounded-full bg-black/30 blur-3xl" />
        <div className="relative flex h-full items-center justify-between gap-10 text-start">
          <div className="flex min-w-0 flex-1 flex-col justify-between">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-bold text-white/85">
                <QrCode className="h-4 w-4" />
                {copy.scanPrompt}
              </div>
              <div className="text-5xl font-black leading-tight">{state.businessName || copy.businessName}</div>
              <div className="max-w-[430px] text-xl leading-9 text-white/78">
                {state.note || copy.backNoteQr}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <LogoBadge logoUrl={logoUrl} businessName={state.businessName} accentColor={state.accentColor} size={86} />
              <div className="min-w-0">
                <div className="text-sm text-white/60">{copy.websiteLabel}</div>
                <div className="truncate text-2xl font-black">{state.website || "https://example.com"}</div>
              </div>
            </div>
          </div>

          <div className="rounded-[34px] bg-white p-7 shadow-2xl">
            <QRCode value={state.website || "https://example.com"} size={230} />
          </div>
        </div>
      </div>
    );
  }

  if (state.template === "golden-frame") {
    return (
      <div
        dir={dir}
        style={{
          width: BUSINESS_CARD_DIMENSIONS.width,
          height: BUSINESS_CARD_DIMENSIONS.height,
          background: "linear-gradient(135deg, #171717 0%, #31210c 100%)",
          border: `12px solid ${state.accentColor}`,
        }}
        className="relative overflow-hidden rounded-[42px] p-10 text-amber-50"
      >
        <div className="absolute inset-6 rounded-[26px] border border-white/10" />
        <div className="relative flex h-full items-center justify-between gap-8 text-start">
          <div className="flex min-w-0 flex-1 flex-col justify-between">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/8 px-4 py-2 text-sm font-bold text-amber-100">
                <QrCode className="h-4 w-4" />
                {copy.scanPrompt}
              </div>
              <div className="text-5xl font-black">{state.businessName || copy.businessName}</div>
              <div className="max-w-[430px] text-xl leading-9 text-amber-100/80">{state.note || copy.backNoteDirect}</div>
            </div>
            <div className="rounded-[24px] bg-white/6 p-5">
              <div className="mb-2 text-sm text-amber-100/60">{copy.websiteLabel}</div>
              <div className="truncate text-2xl font-black">{state.website || "https://example.com"}</div>
            </div>
          </div>
          <div className="rounded-[34px] bg-white p-7 shadow-2xl">
            <QRCode value={state.website || "https://example.com"} size={230} />
          </div>
        </div>
      </div>
    );
  }

  if (state.template === "linen-gray") {
    return (
      <div
        dir={dir}
        style={{
          width: BUSINESS_CARD_DIMENSIONS.width,
          height: BUSINESS_CARD_DIMENSIONS.height,
          background: "linear-gradient(135deg, #f5f5f4 0%, #e7e5e4 100%)",
        }}
        className="relative overflow-hidden rounded-[42px] p-10 text-stone-900"
      >
        <div className="absolute left-0 top-0 h-full w-[30%] bg-stone-900" />
        <div className="relative flex h-full items-center justify-between gap-8 text-start">
          <div className="rounded-[34px] border border-stone-200 bg-white p-7 shadow-2xl">
            <QRCode value={state.website || "https://example.com"} size={230} />
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-between">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold text-stone-600" style={{ backgroundColor: `${state.accentColor}22` }}>
                <QrCode className="h-4 w-4" />
                {copy.scanPrompt}
              </div>
              <div className="text-5xl font-black">{state.businessName || copy.businessName}</div>
              <div className="max-w-[420px] text-xl leading-9 text-stone-600">{state.note || copy.backNoteDirect}</div>
            </div>
            <div className="rounded-[24px] border border-stone-300 bg-white/80 p-5">
              <div className="mb-2 text-sm text-stone-500">{copy.websiteLabel}</div>
              <div className="truncate text-2xl font-black">{state.website || "https://example.com"}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (state.template === "midnight-slice") {
    return (
      <div
        dir={dir}
        style={{
          width: BUSINESS_CARD_DIMENSIONS.width,
          height: BUSINESS_CARD_DIMENSIONS.height,
          background: "linear-gradient(135deg, #020617 0%, #0f172a 100%)",
        }}
        className="relative overflow-hidden rounded-[42px] p-10 text-white"
      >
        <div className="absolute -left-8 top-0 h-full w-[45%] skew-x-12" style={{ backgroundColor: `${state.accentColor}dd` }} />
        <div className="relative flex h-full items-center justify-between gap-8 text-start">
          <div className="rounded-[34px] bg-white p-7 shadow-2xl">
            <QRCode value={state.website || "https://example.com"} size={230} />
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-between">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/8 px-4 py-2 text-sm font-bold text-white/85">
                <QrCode className="h-4 w-4" />
                {copy.scanPrompt}
              </div>
              <div className="text-5xl font-black">{state.businessName || copy.businessName}</div>
              <div className="max-w-[430px] text-xl leading-9 text-white/80">{state.note || copy.backNoteDirect}</div>
            </div>
            <div className="rounded-[24px] bg-black/20 p-5">
              <div className="mb-2 text-sm text-white/55">{copy.websiteLabel}</div>
              <div className="truncate text-2xl font-black">{state.website || "https://example.com"}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (state.template === "executive-ink") {
    return (
      <div
        dir={dir}
        style={{
          width: BUSINESS_CARD_DIMENSIONS.width,
          height: BUSINESS_CARD_DIMENSIONS.height,
          background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
        }}
        className="relative overflow-hidden rounded-[42px] p-10 text-slate-950"
      >
        <div className="absolute inset-x-0 top-0 h-36 bg-slate-950" />
        <div className="absolute right-10 top-10 h-16 w-40 rounded-full bg-white/8" />
        <div className="relative flex h-full flex-col justify-between text-start">
          <div className="grid grid-cols-[1fr_auto] items-start gap-8 rounded-[30px] bg-slate-950 px-8 py-7 text-white shadow-xl">
            <div className="space-y-3">
              <div className="text-sm font-bold text-white/70">{copy.scanAndConnect}</div>
              <div className="text-4xl font-black leading-tight">{state.businessName || copy.businessName}</div>
              <div className="max-w-[430px] text-lg leading-8 text-white/72">
                {state.note || copy.backNoteDirect}
              </div>
            </div>
            <div className="rounded-[28px] bg-white p-5 shadow-2xl">
              <QRCode value={state.website || "https://example.com"} size={180} />
            </div>
          </div>
          <div className="grid grid-cols-[1.3fr_1fr] gap-8 pt-3">
            <div className="space-y-4 rounded-[28px] border border-slate-200 bg-white/85 p-6">
              <div className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold text-slate-600" style={{ backgroundColor: `${state.accentColor}22` }}>
                <QrCode className="h-4 w-4" />
                {copy.scanPrompt}
              </div>
              <div className="text-xl leading-9 text-slate-600">
                {state.note || copy.backNoteDirect}
              </div>
            </div>
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
              <div className="mb-2 text-sm font-bold text-slate-500">{copy.websiteLabel}</div>
              <div className="truncate text-2xl font-black">{state.website || "https://example.com"}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (state.template === "teal-wave") {
    return (
      <div
        dir={dir}
        style={{
          width: BUSINESS_CARD_DIMENSIONS.width,
          height: BUSINESS_CARD_DIMENSIONS.height,
          background: "linear-gradient(135deg, #082f49 0%, #0f766e 100%)",
        }}
        className="relative overflow-hidden rounded-[42px] p-10 text-white"
      >
        <div className="absolute -right-16 bottom-0 h-64 w-[420px] rounded-t-full bg-white/10" />
        <div className="absolute -left-10 top-0 h-56 w-[360px] rounded-b-full bg-white/10" />
        <div className="relative flex h-full items-center justify-between gap-8 text-start">
          <div className="flex min-w-0 flex-1 flex-col justify-between">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-bold text-white/85">
                <QrCode className="h-4 w-4" />
                {copy.scanPrompt}
              </div>
              <div className="text-5xl font-black">{state.businessName || copy.businessName}</div>
              <div className="max-w-[420px] text-xl leading-9 text-white/80">{state.note || copy.backNoteDirect}</div>
            </div>
            <div className="rounded-[24px] bg-black/15 p-5">
              <div className="mb-2 text-sm text-white/55">{copy.websiteLabel}</div>
              <div className="truncate text-2xl font-black">{state.website || "https://example.com"}</div>
            </div>
          </div>
          <div className="rounded-[34px] bg-white p-7 shadow-2xl">
            <QRCode value={state.website || "https://example.com"} size={230} />
          </div>
        </div>
      </div>
    );
  }

  if (state.template === "ruby-signature") {
    const palette = getRubySignaturePalette(state.rubyTone);

    return (
      <div
        dir={dir}
        style={{
          width: BUSINESS_CARD_DIMENSIONS.width,
          height: BUSINESS_CARD_DIMENSIONS.height,
          background: palette.background,
        }}
        className="relative overflow-hidden rounded-[42px] p-10 text-white"
      >
        <div className={`absolute inset-x-10 top-10 h-[1px] ${palette.line}`} />
        <div className={`absolute inset-x-10 bottom-10 h-[1px] ${palette.line}`} />
        <div className="relative flex h-full items-center justify-between gap-8 text-start">
          <div className="rounded-[34px] bg-white p-7 shadow-2xl">
            <QRCode value={state.website || "https://example.com"} size={230} />
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-between">
            <div className="space-y-5">
              <div className={`text-sm font-bold tracking-wide ${palette.badge}`}>{copy.signatureAccess}</div>
              <div className="text-5xl font-black">{state.businessName || copy.businessName}</div>
              <div className={`max-w-[430px] text-xl leading-9 ${palette.textSoft}`}>{state.note || copy.backNoteDirect}</div>
            </div>
            <div className="rounded-[24px] bg-white/8 p-5">
              <div className="mb-2 text-sm text-white/55">{copy.websiteLabel}</div>
              <div className="truncate text-2xl font-black">{state.website || "https://example.com"}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (state.template === "minimal-ivory") {
    return (
      <div
        dir={dir}
        style={{
          width: BUSINESS_CARD_DIMENSIONS.width,
          height: BUSINESS_CARD_DIMENSIONS.height,
          background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
        }}
        className="relative overflow-hidden rounded-[42px] border-[10px] p-10 text-slate-900"
      >
        <div className="absolute inset-y-0 left-0 w-5" style={{ backgroundColor: state.accentColor }} />
        <div className="relative flex h-full items-center justify-between gap-10 text-start">
          <div className="flex min-w-0 flex-1 flex-col justify-between">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-900/5 px-4 py-2 text-sm font-bold text-slate-600">
                <QrCode className="h-4 w-4" />
                {copy.scanPrompt}
              </div>
              <div className="text-5xl font-black leading-tight">{state.businessName || copy.businessName}</div>
              <div className="max-w-[430px] text-xl leading-9 text-slate-600">
                {state.note || copy.backNoteFastAccess}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <LogoBadge logoUrl={logoUrl} businessName={state.businessName} accentColor={state.accentColor} size={86} />
              <div className="min-w-0">
                <div className="text-sm text-slate-500">{copy.websiteLabel}</div>
                <div className="truncate text-2xl font-black">{state.website || "https://example.com"}</div>
              </div>
            </div>
          </div>
          <div className="rounded-[34px] border border-slate-200 bg-white p-7 shadow-2xl">
            <QRCode value={state.website || "https://example.com"} size={230} />
          </div>
        </div>
      </div>
    );
  }

  if (state.template === "spotlight-neon") {
    return (
      <div
        dir={dir}
        style={{
          width: BUSINESS_CARD_DIMENSIONS.width,
          height: BUSINESS_CARD_DIMENSIONS.height,
          background: `linear-gradient(135deg, #030712 0%, ${state.accentColor} 100%)`,
        }}
        className="relative overflow-hidden rounded-[42px] p-10 text-white"
      >
        <div className="absolute inset-y-0 right-0 w-[38%] bg-black/10" />
        <div className="relative flex h-full items-center justify-between gap-10 text-start">
          <div className="rounded-[34px] bg-white p-7 shadow-2xl">
            <QRCode value={state.website || "https://example.com"} size={230} />
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-between">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-bold text-white/85">
                <QrCode className="h-4 w-4" />
                {copy.scanVisit}
              </div>
              <div className="text-5xl font-black leading-tight">{state.businessName || copy.businessName}</div>
              <div className="max-w-[420px] text-xl leading-9 text-white/80">
                {state.note || copy.backNoteSimpleScan}
              </div>
            </div>
            <div className="rounded-[24px] border border-white/12 bg-white/8 p-5">
              <div className="mb-2 text-sm text-white/55">{copy.websiteLabel}</div>
              <div className="truncate text-2xl font-black">{state.website || "https://example.com"}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      dir={dir}
      style={{
        width: BUSINESS_CARD_DIMENSIONS.width,
        height: BUSINESS_CARD_DIMENSIONS.height,
        background: "linear-gradient(135deg, #ffffff 0%, #f7f7f5 44%, #efeadd 100%)",
      }}
      className="relative overflow-hidden rounded-[42px] border border-[#e7dcc1] p-10 text-slate-900"
    >
      <div className="absolute inset-y-0 left-0 w-5" style={{ backgroundColor: state.accentColor }} />
      <div className="absolute right-10 top-10 h-[1px] w-40 bg-[#d9ccb0]" />
      <div className="absolute left-10 bottom-10 h-[1px] w-40 bg-[#d9ccb0]" />
      <div className="relative flex h-full items-center justify-between gap-10 text-start">
        <div className="flex min-w-0 flex-1 flex-col justify-between">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#e5ddca] bg-white/85 px-4 py-2 text-sm font-bold text-amber-900/80">
              <QrCode className="h-4 w-4" />
              {copy.scanPrompt}
            </div>
            <div className="text-5xl font-black leading-tight">{state.businessName || copy.businessName}</div>
            <div className="max-w-[430px] text-xl leading-9 text-slate-600">
              {state.note || copy.backNoteDirect}
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-[24px] border border-[#e8e2d7] bg-white/85 p-5 shadow-sm">
            <LogoBadge logoUrl={logoUrl} businessName={state.businessName} accentColor={state.accentColor} size={86} />
            <div className="min-w-0 text-start">
              <div className="text-sm text-slate-500">{copy.websiteLabel}</div>
              <div className="truncate text-2xl font-black">{state.website || "https://example.com"}</div>
            </div>
          </div>
        </div>

        <div className="rounded-[34px] border border-[#e8e2d7] bg-white p-7 shadow-2xl">
          <QRCode value={state.website || "https://example.com"} size={230} />
        </div>
      </div>
    </div>
  );
}

function PosterCanvas({
  state,
  logoUrl,
  audienceBusinessLabel,
}: {
  state: PosterState;
  logoUrl?: string | null;
  audienceBusinessLabel: string;
}) {
  const { dir } = useLocale();
  const copy = useBrandKitPreviewCopy(audienceBusinessLabel);
  const dimensions = POSTER_DIMENSIONS[state.size];
  const family = getPosterFamily(state.template);
  const metrics = getPosterMetrics(state.size, dimensions);

  if (family === "clean") {
    return (
      <div
        dir={dir}
        style={{
          width: dimensions.width,
          height: dimensions.height,
          background: "linear-gradient(180deg, #ffffff 0%, #edf4ff 100%)",
          padding: metrics.padding,
          borderRadius: metrics.radius,
        }}
        className="relative overflow-hidden text-slate-900"
      >
        <div className="absolute inset-y-0 right-0 w-8" style={{ backgroundColor: state.accentColor }} />
        <div className="relative flex h-full flex-col justify-between">
          <div className="text-start" style={{ gap: metrics.gap, display: "grid" }}>
            <div className="flex items-center" style={{ gap: metrics.gap / 1.6 }}>
              <LogoBadge logoUrl={logoUrl} businessName={state.businessName} accentColor={state.accentColor} size={metrics.logo} />
              <div className="space-y-2">
                <div className="font-black" style={{ fontSize: metrics.businessName }}>{state.businessName || copy.businessName}</div>
                <div className="text-slate-600" style={{ fontSize: metrics.supportText }}>{copy.posterSupportClean}</div>
              </div>
            </div>
            <div className="space-y-5">
              <div className="max-w-[82%] font-black leading-[1.15]" style={{ fontSize: metrics.title }}>{state.title || copy.posterTitleClean}</div>
              <div className="max-w-[80%] text-slate-600" style={{ fontSize: metrics.description, lineHeight: 1.8 }}>
                {state.description || copy.posterDescriptionClean}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-[1fr_auto] items-end" style={{ gap: metrics.gap }}>
            <div className="space-y-5 text-start">
              <div className="inline-flex items-center rounded-full px-5 py-3 font-black text-white" style={{ backgroundColor: state.accentColor, gap: metrics.gap / 3, fontSize: metrics.footer }}>
                <ScanLine className="h-5 w-5" />
                {state.footer || copy.posterFooterClean}
              </div>
              <div className="font-black" style={{ fontSize: metrics.website }}>{state.website || "https://example.com"}</div>
            </div>
            <div className="border border-slate-200 bg-white shadow-2xl" style={{ borderRadius: metrics.radius - 10, padding: metrics.padding * 0.58 }}>
              <QRCode value={state.website || "https://example.com"} size={metrics.qr} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (family === "impact") {
    return (
      <div
        dir={dir}
        style={{
          width: dimensions.width,
          height: dimensions.height,
          background: `linear-gradient(135deg, #020617 0%, ${state.accentColor} 100%)`,
          padding: metrics.padding,
          borderRadius: metrics.radius,
        }}
        className="relative overflow-hidden text-white"
      >
        <div className="absolute inset-y-0 left-0 w-[38%] bg-black/20" />
        <div className="relative flex h-full flex-col justify-between">
          <div className="grid grid-cols-[1fr_auto] items-start" style={{ gap: metrics.gap }}>
            <div className="space-y-7 text-start">
              <div className="flex items-center" style={{ gap: metrics.gap / 1.6 }}>
                <LogoBadge logoUrl={logoUrl} businessName={state.businessName} accentColor={state.accentColor} size={Math.round(metrics.logo * 0.9)} />
                <div className="space-y-2">
                  <div className="font-black" style={{ fontSize: metrics.businessName }}>{state.businessName || copy.businessName}</div>
                  <div className="text-white/75" style={{ fontSize: metrics.supportText }}>{copy.posterSupportImpact}</div>
                </div>
              </div>
              <div className="max-w-[88%] font-black leading-[1.05]" style={{ fontSize: metrics.title }}>{state.title || copy.posterTitleImpact}</div>
              <div className="max-w-[75%] text-white/80" style={{ fontSize: metrics.description, lineHeight: 1.8 }}>
                {state.description || copy.posterDescriptionImpact}
              </div>
            </div>
            <div className="bg-white shadow-2xl" style={{ borderRadius: metrics.radius - 10, padding: metrics.padding * 0.58 }}>
              <QRCode value={state.website || "https://example.com"} size={metrics.qr} />
            </div>
          </div>
          <div className="space-y-5 text-start">
            <div className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-5 py-3 font-black" style={{ gap: metrics.gap / 3, fontSize: metrics.footer }}>
              <ScanLine className="h-5 w-5" />
              {state.footer || copy.posterFooterImpact}
            </div>
            <div className="font-black" style={{ fontSize: metrics.website }}>{state.website || "https://example.com"}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      dir={dir}
      style={{
        width: dimensions.width,
        height: dimensions.height,
        background: `radial-gradient(circle at top right, ${state.accentColor}60, transparent 28%), linear-gradient(180deg, #07101e 0%, #10243f 56%, #1d3b68 100%)`,
        padding: metrics.padding,
        borderRadius: metrics.radius,
      }}
      className="relative overflow-hidden text-white"
    >
      <div className="absolute right-0 top-0 h-72 w-72 rounded-bl-[88px] bg-white/5" />
      <div className="absolute bottom-0 left-0 h-80 w-80 rounded-tr-[120px] bg-black/20" />
      <div className="relative flex h-full flex-col justify-between">
        <div className="space-y-7">
          <div className="flex items-center" style={{ gap: metrics.gap / 1.6 }}>
            <LogoBadge logoUrl={logoUrl} businessName={state.businessName} accentColor={state.accentColor} size={metrics.logo} />
            <div className="space-y-2">
              <div className="font-black" style={{ fontSize: metrics.businessName }}>{state.businessName || copy.businessName}</div>
              <div className="text-white/75" style={{ fontSize: metrics.supportText }}>{copy.posterSupportHero}</div>
            </div>
          </div>

          <div className="space-y-5">
            <div className="max-w-[80%] font-black leading-[1.15]" style={{ fontSize: metrics.title }}>{state.title || copy.posterTitleHero}</div>
            <div className="max-w-[78%] text-white/78" style={{ fontSize: metrics.description, lineHeight: 1.8 }}>
              {state.description || copy.posterDescriptionHero}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-[1fr_auto] items-end" style={{ gap: metrics.gap }}>
          <div className="space-y-5">
            <div className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-5 py-3 font-black" style={{ gap: metrics.gap / 3, fontSize: metrics.footer }}>
              <ScanLine className="h-5 w-5" />
              {state.footer || copy.posterFooterHero}
            </div>
            <div className="font-black" style={{ fontSize: metrics.website }}>{state.website || "https://example.com"}</div>
          </div>

          <div className="bg-white p-8 shadow-2xl" style={{ borderRadius: metrics.radius - 10, padding: metrics.padding * 0.58 }}>
            <QRCode value={state.website || "https://example.com"} size={metrics.qr} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PanelBrandKitPage() {
  const { isAdmin, isPrimaryAdmin } = useAuth();
  const { toast } = useToast();
  const t = useT();
  const { dir, isRtl } = useLocale();
  const tenantMeta = getInitialTenantMeta();
  const labels = getAudienceLabels(tenantMeta);
  const supportExpired = tenantMeta?.supportExpired ?? false;
  const siteUrl = typeof window !== "undefined" ? `${window.location.origin}/` : "https://example.com/";
  const businessLabelText = labels.business || t("panelBrandKit.fallback.businessLabel");
  const [loading, setLoading] = useState(true);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [customLogoUrl, setCustomLogoUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"business-card" | "banner" | null>(null);
  const frontRef = useRef<HTMLDivElement | null>(null);
  const backRef = useRef<HTMLDivElement | null>(null);
  const bannerRef = useRef<HTMLDivElement | null>(null);

  const [businessCard, setBusinessCard] = useState<BusinessCardState>({
    businessName: "",
    ownerName: "",
    subtitle: t("panelBrandKit.defaults.cardSubtitle"),
    phone: "",
    secondaryPhone: "",
    address: "",
    website: siteUrl,
    accentColor: "#f59e0b",
    note: "",
    template: "royal-night",
    rubyTone: "ruby",
  });

  const [poster, setPoster] = useState<PosterState>({
    businessName: "",
    title: "",
    description: "",
    website: siteUrl,
    accentColor: "#0ea5e9",
    size: "a4",
    footer: "",
    template: "lux-promo",
  });

  useEffect(() => {
    Promise.all([api.appearance.get(), api.contact.get()]).then(([appearanceRes, contactRes]) => {
      const appearance = appearanceRes.success ? appearanceRes.data : null;
      const contact = contactRes.success ? contactRes.data : null;
      const phone = contact?.phones?.[0]?.number ?? "";
      const secondaryPhone = contact?.phones?.[1]?.number ?? "";
      const address = contact?.address ?? "";
      const businessName = appearance?.storeName?.trim() || tenantMeta?.name || t("panelBrandKit.defaults.businessName", { business: labels.business });
      const logo = appearance?.logoUrl || null;

      setLogoUrl(logo);
      setBusinessCard((current) => ({
        ...current,
        businessName,
        ownerName: businessName,
        subtitle: t("panelBrandKit.defaults.loadedCardSubtitle", { businessName }),
        phone,
        secondaryPhone,
        address,
        website: siteUrl,
        note: t("panelBrandKit.defaults.loadedCardNote", { businessName, business: businessLabelText }),
      }));
      setPoster((current) => ({
        ...current,
        businessName,
        website: siteUrl,
        title: t("panelBrandKit.defaults.posterTitle", { businessName }),
        description: t("panelBrandKit.defaults.posterDescription", { business: businessLabelText }),
        footer: t("panelBrandKit.defaults.posterFooter", { businessName }),
      }));
      setLoading(false);
    });
  }, [businessLabelText, labels.business, siteUrl, t, tenantMeta?.name]);

  const downloadAsPng = async (target: HTMLDivElement | null, fileName: string) => {
    if (!target) return;

    try {
      const dataUrl = await toPng(target, {
        cacheBust: true,
        pixelRatio: 2.5,
        backgroundColor: "#0b1220",
      });
      const link = document.createElement("a");
      link.download = `${fileName}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      toast({
        variant: "destructive",
        title: t("panelBrandKit.toast.exportFailed"),
        description: t("panelBrandKit.toast.exportFailedDescription"),
      });
    }
  };

  const businessCardFileBase = useMemo(() => safeFileName(businessCard.businessName || "business-card"), [businessCard.businessName]);
  const posterFileBase = useMemo(() => safeFileName(`${poster.businessName || "banner"}-${poster.size}`), [poster.businessName, poster.size]);
  const effectiveLogoUrl = customLogoUrl || logoUrl;
  const selectedCardColorPresets = BUSINESS_CARD_COLOR_PRESETS[businessCard.template];
  const handleCustomLogoChange = (file: File | null) => {
    setCustomLogoUrl(file ? URL.createObjectURL(file) : null);
  };

  if (!isPrimaryAdmin) {
    return (
      <div className="min-h-screen bg-background p-4 text-foreground" dir={dir}>
        <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center space-y-4 text-center">
          <ImageIcon className="h-12 w-12 text-destructive" />
          <h1 className="text-xl font-bold">{t("panelBrandKit.accessDenied.title")}</h1>
          <p className="leading-7 text-muted-foreground">{t("panelBrandKit.accessDenied.description")}</p>
          <Link href="/panel">
            <Button>{t("panelBrandKit.backToPanel")}</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (supportExpired) {
    return <SupportExpiredLock businessLabel={labels.business} isAdmin={isAdmin} />;
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-background pb-20 text-foreground" dir={dir}>
      <div className="absolute inset-x-0 top-0 -z-10 h-[360px] bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.18),_transparent_36%),radial-gradient(circle_at_top_left,_rgba(245,158,11,0.12),_transparent_30%),linear-gradient(180deg,rgba(24,35,61,0.96),rgba(15,23,42,0))]" />

      <header className="sticky top-0 z-10 border-b border-border/70 bg-card/80 backdrop-blur-md">
        <div className="container mx-auto flex max-w-7xl items-start justify-between gap-3 px-4 py-4 sm:items-center">
          <div className="min-w-0 space-y-1">
            <h1 className="text-2xl font-black">{t("panelBrandKit.title")}</h1>
          </div>
          <Link href="/panel">
            <Button variant="outline" size="icon" className="h-11 w-11 rounded-2xl border-border bg-background/40 hover:bg-background/70">
              <ArrowRight className={`h-5 w-5 ${isRtl ? "" : "rotate-180"}`} />
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-7xl space-y-6 px-4 py-6">
        {loading ? (
          <div className="flex h-56 items-center justify-center rounded-[30px] border border-border/70 bg-card/50 text-muted-foreground">
            <Loader2 className="me-2 h-5 w-5 animate-spin" />
            {t("panelBrandKit.loading")}
          </div>
        ) : activeTab === null ? (
            <div className="mx-auto grid max-w-5xl gap-4 md:grid-cols-2">
              <Card className="border-border/70 bg-card/70 transition hover:border-primary/30 hover:bg-card/90">
                <button type="button" onClick={() => setActiveTab("business-card")} className="block w-full text-start">
                  <CardContent className="space-y-4 p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-2">
                        <div className="text-sm text-muted-foreground">{t("panelBrandKit.selection.cardEyebrow")}</div>
                        <div className="text-2xl font-black">{t("panelBrandKit.selection.cardTitle")}</div>
                      </div>
                      <div className="flex h-14 w-14 items-center justify-center rounded-[22px] border border-primary/20 bg-primary/10 text-primary">
                        <IdCard className="h-7 w-7" />
                      </div>
                    </div>
                    <p className="text-sm leading-7 text-muted-foreground">{t("panelBrandKit.selection.cardDescription")}</p>
                  </CardContent>
                </button>
              </Card>

              <Card className="border-border/70 bg-card/70 transition hover:border-primary/30 hover:bg-card/90">
                <button type="button" onClick={() => setActiveTab("banner")} className="block w-full text-start">
                  <CardContent className="space-y-4 p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-2">
                        <div className="text-sm text-muted-foreground">{t("panelBrandKit.selection.posterEyebrow")}</div>
                        <div className="text-2xl font-black">{t("panelBrandKit.selection.posterTitle")}</div>
                      </div>
                      <div className="flex h-14 w-14 items-center justify-center rounded-[22px] border border-primary/20 bg-primary/10 text-primary">
                        <FileImage className="h-7 w-7" />
                      </div>
                    </div>
                    <p className="text-sm leading-7 text-muted-foreground">{t("panelBrandKit.selection.posterDescription")}</p>
                  </CardContent>
                </button>
              </Card>
            </div>
          ) : (
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "business-card" | "banner")} className="space-y-5">
            <div className="rounded-[30px] border border-border/70 bg-card/60 p-4">
              <TabsList className="grid h-auto w-full grid-cols-2 gap-2 rounded-[22px] bg-background/40 p-2">
                <TabsTrigger value="business-card" className="h-14 rounded-[18px] text-sm font-black">{t("panelBrandKit.tabs.card")}</TabsTrigger>
                <TabsTrigger value="banner" className="h-14 rounded-[18px] text-sm font-black">{t("panelBrandKit.tabs.poster")}</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="business-card" className="space-y-5">
              <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
                <Card className="min-w-0 border-border/70 bg-card/60">
                  <CardHeader>
                    <CardTitle>{t("panelBrandKit.card.formTitle")}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="bc-business-name" className="block text-start">{t("panelBrandKit.form.businessName")}</Label>
                      <Input id="bc-business-name" value={businessCard.businessName} onChange={(e) => setBusinessCard((c) => ({ ...c, businessName: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bc-owner-name" className="block text-start">{t("panelBrandKit.card.ownerName")}</Label>
                      <Input id="bc-owner-name" value={businessCard.ownerName} onChange={(e) => setBusinessCard((c) => ({ ...c, ownerName: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bc-subtitle" className="block text-start">{t("panelBrandKit.form.shortDescription")}</Label>
                      <Input id="bc-subtitle" value={businessCard.subtitle} onChange={(e) => setBusinessCard((c) => ({ ...c, subtitle: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="brand-kit-logo" className="block text-start">{t("panelBrandKit.card.customLogo")}</Label>
                      <div className="rounded-[20px] border border-border/70 bg-background/40 p-3">
                        <Input
                          id="brand-kit-logo"
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleCustomLogoChange(e.target.files?.[0] || null)}
                        />
                        <div className="mt-2 flex items-center gap-2 text-xs leading-6 text-muted-foreground">
                          <ImagePlus className="h-4 w-4" />
                          {t("panelBrandKit.card.customLogoHint")}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="block text-start">{t("panelBrandKit.card.templateLabel")}</Label>
                      <div className="grid gap-3 sm:grid-cols-3">
                        {BUSINESS_CARD_TEMPLATES.map((template) => (
                          <button
                            key={template.value}
                            type="button"
                            onClick={() =>
                              setBusinessCard((current) => ({
                                ...current,
                                template: template.value,
                                accentColor: BUSINESS_CARD_COLOR_PRESETS[template.value][0]?.accentColor ?? current.accentColor,
                                rubyTone: template.value === "ruby-signature" ? "ruby" : current.rubyTone,
                              }))
                            }
                            className={`rounded-[20px] border px-4 py-4 text-start transition ${businessCard.template === template.value ? "border-primary bg-primary/10 text-primary" : "border-border/70 bg-background/40 hover:border-primary/30"}`}
                          >
                            <div className="text-sm text-muted-foreground">{t("panelBrandKit.style")}</div>
                            <div className="mt-2 text-lg font-black">{t(template.labelKey)}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                    {businessCard.template === "ruby-signature" ? (
                      <div className="space-y-2">
                        <Label className="block text-start">{t("panelBrandKit.card.rubyTone")}</Label>
                        <div className="grid gap-3 sm:grid-cols-3">
                          {RUBY_SIGNATURE_TONES.map((tone) => (
                            <button
                              key={tone.value}
                              type="button"
                              onClick={() => setBusinessCard((current) => ({ ...current, rubyTone: tone.value, accentColor: BUSINESS_CARD_COLOR_PRESETS["ruby-signature"].find((item) => item.labelKey === tone.labelKey)?.accentColor ?? current.accentColor }))}
                              className={`rounded-[20px] border px-4 py-4 text-start transition ${businessCard.rubyTone === tone.value ? "border-primary bg-primary/10 text-primary" : "border-border/70 bg-background/40 hover:border-primary/30"}`}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="text-sm font-bold">{t(tone.labelKey)}</div>
                                <span className="h-5 w-5 rounded-full border border-white/20" style={{ backgroundColor: tone.swatch }} />
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label className="block text-start">{t("panelBrandKit.card.colorPreset")}</Label>
                        <div className="grid gap-3 sm:grid-cols-3">
                          {selectedCardColorPresets.map((preset) => (
                            <button
                              key={`${businessCard.template}-${preset.labelKey}`}
                              type="button"
                              onClick={() => setBusinessCard((current) => ({ ...current, accentColor: preset.accentColor }))}
                              className={`rounded-[20px] border px-4 py-4 text-start transition ${businessCard.accentColor === preset.accentColor ? "border-primary bg-primary/10 text-primary" : "border-border/70 bg-background/40 hover:border-primary/30"}`}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="text-sm font-bold">{t(preset.labelKey)}</div>
                                <span className="h-5 w-5 rounded-full border border-white/20" style={{ backgroundColor: preset.swatch }} />
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="bc-phone" className="block text-start">{t("panelBrandKit.form.primaryPhone")}</Label>
                        <Input id="bc-phone" value={businessCard.phone} onChange={(e) => setBusinessCard((c) => ({ ...c, phone: e.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="bc-phone-2" className="block text-start">{t("panelBrandKit.form.secondaryPhone")}</Label>
                        <Input id="bc-phone-2" value={businessCard.secondaryPhone} onChange={(e) => setBusinessCard((c) => ({ ...c, secondaryPhone: e.target.value }))} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bc-address" className="block text-start">{t("panelBrandKit.form.address")}</Label>
                      <Textarea id="bc-address" rows={3} value={businessCard.address} onChange={(e) => setBusinessCard((c) => ({ ...c, address: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bc-website" className="block text-start">{t("panelBrandKit.form.website")}</Label>
                      <Input id="bc-website" dir="ltr" className="text-start" value={businessCard.website} onChange={(e) => setBusinessCard((c) => ({ ...c, website: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bc-note" className="block text-start">{t("panelBrandKit.card.backText")}</Label>
                      <Textarea id="bc-note" rows={3} value={businessCard.note} onChange={(e) => setBusinessCard((c) => ({ ...c, note: e.target.value }))} />
                    </div>
                  </CardContent>
                </Card>

                <div className="min-w-0 space-y-5">
                  <Card className="min-w-0 border-border/70 bg-card/60">
                    <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <CardTitle>{t("panelBrandKit.card.previewTitle")}</CardTitle>
                        <CardDescription>{t("panelBrandKit.card.previewDescription")}</CardDescription>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" className="rounded-[18px]" onClick={() => void downloadAsPng(frontRef.current, `${businessCardFileBase}-front`)}>
                          <Download className="me-2 h-4 w-4" />
                          {t("panelBrandKit.card.downloadFront")}
                        </Button>
                        <Button className="rounded-[18px]" onClick={() => void downloadAsPng(backRef.current, `${businessCardFileBase}-back`)}>
                          <Download className="me-2 h-4 w-4" />
                          {t("panelBrandKit.card.downloadBack")}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      <ScaledPreview designWidth={BUSINESS_CARD_DIMENSIONS.width} designHeight={BUSINESS_CARD_DIMENSIONS.height} targetRef={frontRef} viewportHeightRatio={0.46}>
                        <BusinessCardFront state={businessCard} logoUrl={effectiveLogoUrl} audienceBusinessLabel={businessLabelText} />
                      </ScaledPreview>
                      <ScaledPreview designWidth={BUSINESS_CARD_DIMENSIONS.width} designHeight={BUSINESS_CARD_DIMENSIONS.height} targetRef={backRef} viewportHeightRatio={0.46}>
                        <BusinessCardBack state={businessCard} logoUrl={effectiveLogoUrl} audienceBusinessLabel={businessLabelText} />
                      </ScaledPreview>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="banner" className="space-y-5">
              <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
                <Card className="min-w-0 border-border/70 bg-card/60">
                  <CardHeader>
                    <CardTitle>{t("panelBrandKit.poster.formTitle")}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-3">
                      {(["a5", "a4", "a3"] as PosterSize[]).map((size) => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => setPoster((current) => ({ ...current, size }))}
                          className={`rounded-[20px] border px-4 py-4 text-center transition ${poster.size === size ? "border-primary bg-primary/10 text-primary" : "border-border/70 bg-background/40 hover:border-primary/30"}`}
                        >
                          <div className="text-sm text-muted-foreground">{t("panelBrandKit.poster.size")}</div>
                          <div className="mt-2 text-lg font-black">{POSTER_DIMENSIONS[size].label}</div>
                        </button>
                      ))}
                    </div>
                    <div className="space-y-2">
                      <Label className="block text-start">{t("panelBrandKit.poster.templateLabel")}</Label>
                      <div className="grid gap-3 sm:grid-cols-3">
                        {POSTER_TEMPLATES.map((template) => (
                          <button
                            key={template.value}
                            type="button"
                            onClick={() => setPoster((current) => ({ ...current, template: template.value }))}
                            className={`rounded-[20px] border px-4 py-4 text-start transition ${poster.template === template.value ? "border-primary bg-primary/10 text-primary" : "border-border/70 bg-background/40 hover:border-primary/30"}`}
                          >
                            <div className="text-sm text-muted-foreground">{t("panelBrandKit.style")}</div>
                            <div className="mt-2 text-lg font-black">{t(template.labelKey)}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="poster-business-name" className="block text-start">{t("panelBrandKit.form.businessName")}</Label>
                      <Input id="poster-business-name" value={poster.businessName} onChange={(e) => setPoster((c) => ({ ...c, businessName: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="poster-logo" className="block text-start">{t("panelBrandKit.poster.customLogo")}</Label>
                      <div className="rounded-[20px] border border-border/70 bg-background/40 p-3">
                        <Input
                          id="poster-logo"
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleCustomLogoChange(e.target.files?.[0] || null)}
                        />
                        <div className="mt-2 flex items-center gap-2 text-xs leading-6 text-muted-foreground">
                          <ImagePlus className="h-4 w-4" />
                          {t("panelBrandKit.poster.customLogoHint")}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="poster-title" className="block text-start">{t("panelBrandKit.poster.mainTitle")}</Label>
                      <Textarea id="poster-title" rows={3} value={poster.title} onChange={(e) => setPoster((c) => ({ ...c, title: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="poster-description" className="block text-start">{t("panelBrandKit.form.shortDescription")}</Label>
                      <Textarea id="poster-description" rows={4} value={poster.description} onChange={(e) => setPoster((c) => ({ ...c, description: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="poster-footer" className="block text-start">{t("panelBrandKit.poster.footerText")}</Label>
                      <Input id="poster-footer" value={poster.footer} onChange={(e) => setPoster((c) => ({ ...c, footer: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="poster-website" className="block text-start">{t("panelBrandKit.form.website")}</Label>
                      <Input id="poster-website" dir="ltr" className="text-start" value={poster.website} onChange={(e) => setPoster((c) => ({ ...c, website: e.target.value }))} />
                    </div>
                  </CardContent>
                </Card>

                <div className="min-w-0 space-y-5">
                  <Card className="min-w-0 border-border/70 bg-card/60">
                    <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <CardTitle>{t("panelBrandKit.poster.previewTitle")}</CardTitle>
                        <CardDescription>{t("panelBrandKit.poster.previewDescription")}</CardDescription>
                      </div>
                      <Button className="rounded-[18px]" onClick={() => void downloadAsPng(bannerRef.current, `${posterFileBase}-banner`)}>
                        <Download className="me-2 h-4 w-4" />
                        {t("panelBrandKit.poster.download")}
                      </Button>
                    </CardHeader>
                    <CardContent>
                      <ScaledPreview designWidth={POSTER_DIMENSIONS[poster.size].width} designHeight={POSTER_DIMENSIONS[poster.size].height} targetRef={bannerRef} viewportHeightRatio={0.72}>
                        <PosterCanvas state={poster} logoUrl={effectiveLogoUrl} audienceBusinessLabel={businessLabelText} />
                      </ScaledPreview>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}
