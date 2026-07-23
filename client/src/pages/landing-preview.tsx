import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BellRing,
  CalendarClock,
  CheckCircle2,
  CircleHelp,
  Eye,
  Frown,
  House,
  Info,
  LayoutGrid,
  ListChecks,
  Menu,
  MessageSquareText,
  Phone,
  PhoneCall,
  Pin,
  ReceiptText,
  Rocket,
  ShoppingBag,
  Smile,
  SmilePlus,
  Sparkles,
  Store,
  TrendingUp,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { api } from "@/lib/api";
import { getInitialTenantMeta } from "@/lib/bootstrap";
import type { SupportRenewalPackage } from "@/lib/types";
import { getLandingHeaderMenuItems, getLandingPath, getLandingSiteSettings } from "@/lib/landing-site";
import { useLandingAuth } from "@/lib/landing-auth";
import { LandingAuthDialog } from "@/components/landing-auth-dialog";
import { LandingAuthButton } from "@/components/landing-auth-button";
import { CodeText, PhoneText } from "@/i18n/ltr-text";
import { useFormat, useLocale, useT } from "@/i18n/locale";
import type { MessageKey } from "@/i18n/messages";

type FeatureItem = {
  id: string;
  title: string;
  short: string;
  detail: string;
  imageUrls: string[];
  icon: typeof Sparkles;
};

type LandingPlanCard = {
  id: string;
  packageId?: string | null;
  title: string;
  description: string;
  priceLabel: string;
  features: string[];
  userLimit: number | null;
  featured?: boolean;
  badgeText?: string;
  buttonText?: string;
  buttonVariant?: "default" | "outline";
};

type StaticPlanCard = {
  id: string;
  packageId?: string | null;
  titleKey: MessageKey;
  descriptionKey: MessageKey;
  priceLabelKey: MessageKey;
  featureKeys: MessageKey[];
  userLimit: number | null;
  featured?: boolean;
  badgeTextKey?: MessageKey;
  buttonTextKey?: MessageKey;
  buttonVariant?: "default" | "outline";
};

type StaticFeatureItem = {
  id: string;
  titleKey: MessageKey;
  shortKey: MessageKey;
  detailKey: MessageKey;
  imageUrls: string[];
  icon: typeof Sparkles;
};

const planCards: StaticPlanCard[] = [
  {
    id: "starter",
    packageId: null,
    titleKey: "landingPreview.plan.starter.title",
    descriptionKey: "landingPreview.plan.starter.description",
    priceLabelKey: "landingPreview.plan.starter.price",
    featureKeys: ["landingPreview.plan.starter.feature.1", "landingPreview.plan.starter.feature.2", "landingPreview.plan.starter.feature.3"],
    userLimit: 1,
    buttonTextKey: "landingPreview.plan.order",
  },
  {
    id: "pro",
    packageId: null,
    titleKey: "landingPreview.plan.pro.title",
    descriptionKey: "landingPreview.plan.pro.description",
    priceLabelKey: "landingPreview.plan.pro.price",
    featureKeys: ["landingPreview.plan.pro.feature.1", "landingPreview.plan.pro.feature.2", "landingPreview.plan.pro.feature.3"],
    userLimit: 3,
    featured: true,
    badgeTextKey: "landingPreview.plan.pro.badge",
    buttonTextKey: "landingPreview.plan.order",
  },
  {
    id: "brand",
    packageId: null,
    titleKey: "landingPreview.plan.brand.title",
    descriptionKey: "landingPreview.plan.brand.description",
    priceLabelKey: "landingPreview.plan.brand.price",
    featureKeys: ["landingPreview.plan.brand.feature.1", "landingPreview.plan.brand.feature.2", "landingPreview.plan.brand.feature.3"],
    userLimit: null,
    buttonVariant: "outline",
    buttonTextKey: "landingPreview.plan.order",
  },
];

const userLimitKey = (value?: number | null) => (value == null ? "unlimited" : String(value));

const featureItems: StaticFeatureItem[] = [
  {
    id: "booking",
    titleKey: "landingPreview.feature.booking.title",
    shortKey: "landingPreview.feature.booking.short",
    detailKey: "landingPreview.feature.booking.detail",
    imageUrls: ["/booking-app/opengraph.jpg", "/icon-512.png", "/apple-touch-icon.png"],
    icon: CalendarClock,
  },
  {
    id: "reminder",
    titleKey: "landingPreview.feature.reminder.title",
    shortKey: "landingPreview.feature.reminder.short",
    detailKey: "landingPreview.feature.reminder.detail",
    imageUrls: ["/booking-app/opengraph.jpg", "/icon-512.png", "/apple-touch-icon.png"],
    icon: BellRing,
  },
  {
    id: "campaign",
    titleKey: "landingPreview.feature.campaign.title",
    shortKey: "landingPreview.feature.campaign.short",
    detailKey: "landingPreview.feature.campaign.detail",
    imageUrls: ["/booking-app/opengraph.jpg", "/icon-512.png", "/apple-touch-icon.png"],
    icon: MessageSquareText,
  },
  {
    id: "store",
    titleKey: "landingPreview.feature.store.title",
    shortKey: "landingPreview.feature.store.short",
    detailKey: "landingPreview.feature.store.detail",
    imageUrls: ["/booking-app/opengraph.jpg", "/icon-512.png", "/apple-touch-icon.png"],
    icon: ShoppingBag,
  },
  {
    id: "brand",
    titleKey: "landingPreview.feature.brand.title",
    shortKey: "landingPreview.feature.brand.short",
    detailKey: "landingPreview.feature.brand.detail",
    imageUrls: ["/booking-app/opengraph.jpg", "/icon-512.png", "/apple-touch-icon.png"],
    icon: Store,
  },
  {
    id: "team",
    titleKey: "landingPreview.feature.team.title",
    shortKey: "landingPreview.feature.team.short",
    detailKey: "landingPreview.feature.team.detail",
    imageUrls: ["/booking-app/opengraph.jpg", "/icon-512.png", "/apple-touch-icon.png"],
    icon: Users,
  },
  {
    id: "checkout",
    titleKey: "landingPreview.feature.checkout.title",
    shortKey: "landingPreview.feature.checkout.short",
    detailKey: "landingPreview.feature.checkout.detail",
    imageUrls: ["/booking-app/opengraph.jpg", "/icon-512.png", "/apple-touch-icon.png"],
    icon: Wallet,
  },
  {
    id: "automation",
    titleKey: "landingPreview.feature.automation.title",
    shortKey: "landingPreview.feature.automation.short",
    detailKey: "landingPreview.feature.automation.detail",
    imageUrls: ["/booking-app/opengraph.jpg", "/icon-512.png", "/apple-touch-icon.png"],
    icon: Wrench,
  },
];

const featureIcons = [
  CalendarClock,
  BellRing,
  MessageSquareText,
  ShoppingBag,
  Store,
  Users,
  Wallet,
  Wrench,
];

const faqItems = [
  {
    qKey: "landingPreview.faq.1.question",
    aKey: "landingPreview.faq.1.answer",
  },
  {
    qKey: "landingPreview.faq.2.question",
    aKey: "landingPreview.faq.2.answer",
  },
  {
    qKey: "landingPreview.faq.3.question",
    aKey: "landingPreview.faq.3.answer",
  },
  {
    qKey: "landingPreview.faq.4.question",
    aKey: "landingPreview.faq.4.answer",
  },
  {
    qKey: "landingPreview.faq.5.question",
    aKey: "landingPreview.faq.5.answer",
  },
  {
    qKey: "landingPreview.faq.6.question",
    aKey: "landingPreview.faq.6.answer",
  },
] satisfies Array<{ qKey: MessageKey; aKey: MessageKey }>;

const painPoints = [
  "landingPreview.pain.1",
  "landingPreview.pain.2",
  "landingPreview.pain.3",
  "landingPreview.pain.4",
  "landingPreview.pain.5",
  "landingPreview.pain.6",
] satisfies MessageKey[];

const processSteps = [
  {
    titleKey: "landingPreview.process.1.title",
    descriptionKey: "landingPreview.process.1.description",
  },
  {
    titleKey: "landingPreview.process.2.title",
    descriptionKey: "landingPreview.process.2.description",
  },
  {
    titleKey: "landingPreview.process.3.title",
    descriptionKey: "landingPreview.process.3.description",
  },
] satisfies Array<{ titleKey: MessageKey; descriptionKey: MessageKey }>;

export default function LandingPreviewPage() {
  const t = useT();
  const format = useFormat();
  const { dir, isRtl } = useLocale();
  const bootstrapMeta = getInitialTenantMeta();
  const landingSiteSettings = getLandingSiteSettings();
  useLandingAuth();
  const [selectedFeatureId, setSelectedFeatureId] = useState<string>(featureItems[0].id);
  const [openFaqId, setOpenFaqId] = useState<number>(0);
  const [videoOpen, setVideoOpen] = useState(false);
  const [phoneModalOpen, setPhoneModalOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [planDurationModalOpen, setPlanDurationModalOpen] = useState(false);
  const [featureModalOpen, setFeatureModalOpen] = useState(false);
  const [featureSlideIndex, setFeatureSlideIndex] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeProcessStep, setActiveProcessStep] = useState(0);
  const [activePainPointIndex, setActivePainPointIndex] = useState(0);
  const [painPointProgress, setPainPointProgress] = useState(0);
  const [planPackages, setPlanPackages] = useState<SupportRenewalPackage[]>([]);
  const [selectedPlanCard, setSelectedPlanCard] = useState<LandingPlanCard | null>(null);

  const iconMap = { home: House, about: Info, features: LayoutGrid, plans: ListChecks, faq: CircleHelp, contact: PhoneCall, orders: ReceiptText } as const;
  const headerMenuItems = getLandingHeaderMenuItems().map((item) => ({ ...item, icon: iconMap[item.key] ?? House }));
  const phoneNumbers = landingSiteSettings.contactPhones;
  const landingSections = bootstrapMeta?.landingSections ?? {};
  const landingPackages = bootstrapMeta?.landingPackages ?? [];
  const formatPlanDurationLabel = (durationDays: number) => {
    if (durationDays % 30 === 0) {
      return t("landingPreview.durationMonths", { count: format.number(durationDays / 30) });
    }

    return t("landingPreview.durationDays", { count: format.number(durationDays) });
  };
  const formatPriceLabel = (amount: number) => format.currency(amount);
  const defaultFeatureItems = useMemo<FeatureItem[]>(
    () => featureItems.map((item) => ({
      id: item.id,
      title: t(item.titleKey),
      short: t(item.shortKey),
      detail: t(item.detailKey),
      imageUrls: item.imageUrls,
      icon: item.icon,
    })),
    [t],
  );
  const defaultPlanCards = useMemo<LandingPlanCard[]>(
    () => planCards.map((item) => ({
      id: item.id,
      packageId: item.packageId,
      title: t(item.titleKey),
      description: t(item.descriptionKey),
      priceLabel: t(item.priceLabelKey),
      features: item.featureKeys.map((key) => t(key)),
      userLimit: item.userLimit,
      featured: item.featured,
      badgeText: item.badgeTextKey ? t(item.badgeTextKey) : undefined,
      buttonText: item.buttonTextKey ? t(item.buttonTextKey) : undefined,
      buttonVariant: item.buttonVariant,
    })),
    [t],
  );
  const defaultFaqItems = useMemo(
    () => faqItems.map((item, index) => ({ q: t(item.qKey), a: t(item.aKey), sortOrder: (index + 1) * 10, showOnHome: index < 2 })),
    [t],
  );
  const defaultPainPoints = useMemo(() => painPoints.map((key) => t(key)), [t]);
  const defaultProcessSteps = useMemo(
    () => processSteps.map((item) => ({ title: t(item.titleKey), description: t(item.descriptionKey) })),
    [t],
  );
  const dynamicPainPoints = useMemo(() => {
    const content = (landingSections.pain_points?.content ?? {}) as Record<string, unknown>;
    const items = Array.isArray(content.items)
      ? content.items.filter((item): item is string => typeof item === "string" && item.trim() !== "").slice(0, 8)
      : [];

    return items.length > 0 ? items : defaultPainPoints;
  }, [defaultPainPoints, landingSections]);
  const videoIntroContent = useMemo(() => {
    const content = (landingSections.video_intro?.content ?? {}) as Record<string, unknown>;

    return {
      title: typeof content.title === "string" && content.title.trim() !== "" ? content.title : t("landingPreview.video.title"),
      description: typeof content.description === "string" && content.description.trim() !== "" ? content.description : t("landingPreview.video.description"),
      buttonLabel: typeof content.buttonLabel === "string" && content.buttonLabel.trim() !== "" ? content.buttonLabel : t("landingPreview.video.button"),
      modalTitle: typeof content.modalTitle === "string" && content.modalTitle.trim() !== "" ? content.modalTitle : t("landingPreview.video.modalTitle"),
      modalDescription: typeof content.modalDescription === "string" && content.modalDescription.trim() !== "" ? content.modalDescription : t("landingPreview.video.modalDescription"),
      videoUrl: typeof content.videoUrl === "string" && content.videoUrl.trim() !== "" ? content.videoUrl : "",
    };
  }, [landingSections, t]);
  const beforeAfterContent = useMemo(() => {
    const content = (landingSections.before_after?.content ?? {}) as Record<string, unknown>;
    const items = Array.isArray(content.items)
      ? content.items
          .map((item) => {
            if (!item || typeof item !== "object") return null;
            const record = item as Record<string, unknown>;
            const title = typeof record.title === "string" ? record.title.trim() : "";
            const description =
              typeof record.description === "string"
                ? record.description.trim()
                : typeof record.detail === "string"
                  ? record.detail.trim()
                  : "";
            return title || description ? { title, description } : null;
          })
          .filter((item): item is { title: string; description: string } => item !== null)
      : [];

    return {
      sectionTitle: typeof content.sectionTitle === "string" && content.sectionTitle.trim() !== "" ? content.sectionTitle : t("landingPreview.beforeAfter.title"),
      items:
        items.length > 0
          ? items
          : [
              { title: t("landingPreview.beforeAfter.before.title"), description: t("landingPreview.beforeAfter.before.description") },
              { title: t("landingPreview.beforeAfter.after.title"), description: t("landingPreview.beforeAfter.after.description") },
              { title: t("landingPreview.beforeAfter.result.title"), description: t("landingPreview.beforeAfter.result.description") },
            ],
    };
  }, [landingSections, t]);
  const galleryShowcaseContent = useMemo(() => {
    const content = (landingSections.gallery_showcase?.content ?? {}) as Record<string, unknown>;
    const stats = Array.isArray(content.stats)
      ? content.stats
          .map((item) => {
            if (!item || typeof item !== "object") return null;
            const record = item as Record<string, unknown>;
            const label = typeof record.label === "string" ? record.label.trim() : "";
            const value = typeof record.value === "string" ? record.value.trim() : "";
            return label || value ? { label, value } : null;
          })
          .filter((item): item is { label: string; value: string } => item !== null)
      : [];

    return {
      title: typeof content.title === "string" && content.title.trim() !== "" ? content.title : t("landingPreview.gallery.title"),
      description: typeof content.description === "string" && content.description.trim() !== "" ? content.description : t("landingPreview.gallery.description"),
      imageUrl: typeof content.imageUrl === "string" && content.imageUrl.trim() !== "" ? content.imageUrl : "/booking-app/opengraph.jpg",
      buttonLabel: typeof content.buttonLabel === "string" && content.buttonLabel.trim() !== "" ? content.buttonLabel : t("landingPreview.gallery.button"),
      buttonUrl: typeof content.buttonUrl === "string" && content.buttonUrl.trim() !== "" ? content.buttonUrl : "/booking",
      statsTitle: typeof content.statsTitle === "string" && content.statsTitle.trim() !== "" ? content.statsTitle : t("landingPreview.gallery.statsTitle"),
      statsDescription: typeof content.statsDescription === "string" && content.statsDescription.trim() !== "" ? content.statsDescription : t("landingPreview.gallery.statsDescription"),
      stats:
        stats.length > 0
          ? stats
          : [
              { label: t("landingPreview.gallery.stat.1"), value: "+28%" },
              { label: t("landingPreview.gallery.stat.2"), value: "-45%" },
              { label: t("landingPreview.gallery.stat.3"), value: "+19%" },
            ],
    };
  }, [landingSections, t]);
  const dynamicFeatureItems = useMemo(() => {
    const content = (landingSections.feature_grid?.content ?? {}) as Record<string, unknown>;
    const items = Array.isArray(content.items)
      ? content.items
          .map((item, index) => {
            if (!item || typeof item !== "object") return null;
            const record = item as Record<string, unknown>;
            const title = typeof record.title === "string" ? record.title.trim() : "";
            const short = typeof record.short === "string" ? record.short.trim() : "";
            const detail = typeof record.detail === "string" ? record.detail.trim() : "";
            const dynamicImageUrls = Array.isArray(record.imageUrls)
              ? record.imageUrls.filter((image): image is string => typeof image === "string" && image.trim() !== "").slice(0, 5)
              : [
                  typeof record.image_1 === "string" ? record.image_1.trim() : "",
                  typeof record.image_2 === "string" ? record.image_2.trim() : "",
                  typeof record.image_3 === "string" ? record.image_3.trim() : "",
                  typeof record.image_4 === "string" ? record.image_4.trim() : "",
                  typeof record.image_5 === "string" ? record.image_5.trim() : "",
                ].filter((image): image is string => image !== "");
            if (!title && !short && !detail) return null;

            return {
              id: `dynamic-feature-${index + 1}`,
              title: title || t("landingPreview.feature.fallbackTitle", { index: format.number(index + 1) }),
              short: short || title || t("landingPreview.feature.fallbackShort"),
              detail: detail || short || title || t("landingPreview.feature.fallbackDetail"),
              imageUrls: dynamicImageUrls.length > 0 ? dynamicImageUrls : ["/booking-app/opengraph.jpg", "/icon-512.png", "/apple-touch-icon.png"],
              icon: featureIcons[index % featureIcons.length] ?? Sparkles,
            } satisfies FeatureItem;
          })
          .filter((item): item is FeatureItem => item !== null)
      : [];

    return {
      title: typeof content.title === "string" && content.title.trim() !== "" ? content.title : t("landingPreview.featureGrid.title"),
      description: typeof content.description === "string" && content.description.trim() !== "" ? content.description : t("landingPreview.featureGrid.description"),
      viewAllLabel: typeof content.viewAllLabel === "string" && content.viewAllLabel.trim() !== "" ? content.viewAllLabel : t("landingPreview.featureGrid.viewAll"),
      items: items.length > 0 ? items : defaultFeatureItems,
    };
  }, [defaultFeatureItems, format, landingSections, t]);
  const dynamicProcessSteps = useMemo(() => {
    const content = (landingSections.process_steps?.content ?? {}) as Record<string, unknown>;
    const items = Array.isArray(content.items)
      ? content.items
          .map((item) => {
            if (!item || typeof item !== "object") return null;
            const record = item as Record<string, unknown>;
            const title = typeof record.title === "string" ? record.title.trim() : "";
            const description =
              typeof record.description === "string"
                ? record.description.trim()
                : typeof record.detail === "string"
                  ? record.detail.trim()
                  : "";

            return title || description ? { title, description } : null;
          })
          .filter((item): item is { title: string; description: string } => item !== null)
          .slice(0, 3)
      : [];

    return items.length === 3 ? items : defaultProcessSteps;
  }, [defaultProcessSteps, landingSections]);
  const availablePlanPackages = useMemo(
    () => (bootstrapMeta?.isLandingDomain ? landingPackages : planPackages),
    [bootstrapMeta?.isLandingDomain, landingPackages, planPackages],
  );
  const dynamicPlanSection = useMemo(() => {
    const content = (landingSections.plans?.content ?? {}) as Record<string, unknown>;
    const packageLookup = new Map(availablePlanPackages.map((item) => [item.id, item]));
    const fallbackPackages = availablePlanPackages.slice(0, 3);
    const cardsSource = Array.isArray(content.cards) ? content.cards.slice(0, 3) : [];

    const cards = (cardsSource.length > 0 ? cardsSource : planCards).map((card, index) => {
      const record = card as Record<string, unknown>;
      const selectedPackageId = typeof record.packageId === "string" && record.packageId.trim() !== "" ? record.packageId : null;
      const matchedPackage =
        (selectedPackageId ? packageLookup.get(selectedPackageId) : undefined) ??
        fallbackPackages[index] ??
        availablePlanPackages[index];

      const rawFeatures = Array.isArray(record.features)
        ? record.features.filter((item): item is string => typeof item === "string" && item.trim() !== "").slice(0, 3)
        : [];

      return {
        id: `landing-plan-${index + 1}`,
        packageId: matchedPackage?.id ?? selectedPackageId,
        title: typeof record.title === "string" && record.title.trim() !== "" ? record.title : matchedPackage?.name ?? defaultPlanCards[index]?.title ?? t("landingPreview.plan.fallbackTitle", { index: format.number(index + 1) }),
        description: typeof record.description === "string" && record.description.trim() !== "" ? record.description : defaultPlanCards[index]?.description ?? "",
        priceLabel: matchedPackage ? formatPriceLabel(matchedPackage.payableAmount) : defaultPlanCards[index]?.priceLabel ?? t("landingPreview.plan.priceInquiry"),
        features: rawFeatures.length > 0 ? rawFeatures : defaultPlanCards[index]?.features ?? [],
        userLimit: matchedPackage?.userLimit ?? defaultPlanCards[index]?.userLimit ?? null,
        featured: typeof record.featured === "boolean" ? record.featured : Boolean(defaultPlanCards[index]?.featured),
        buttonVariant:
          record.buttonVariant === "outline" || record.buttonVariant === "default"
            ? record.buttonVariant
            : defaultPlanCards[index]?.buttonVariant ?? "default",
        badgeText: typeof record.badgeText === "string" ? record.badgeText.trim() : defaultPlanCards[index]?.badgeText ?? "",
        buttonText: typeof record.buttonText === "string" && record.buttonText.trim() !== "" ? record.buttonText : t("landingPreview.plan.order"),
      };
    });

    return {
      title: typeof content.title === "string" && content.title.trim() !== "" ? content.title : t("landingPreview.plans.title"),
      description: typeof content.description === "string" && content.description.trim() !== "" ? content.description : t("landingPreview.plans.description"),
      fullPageButtonLabel:
        typeof content.fullPageButtonLabel === "string" && content.fullPageButtonLabel.trim() !== ""
          ? content.fullPageButtonLabel
          : t("landingPreview.plans.fullPage"),
      cards,
    };
  }, [availablePlanPackages, defaultPlanCards, format, landingSections, t]);
  const dynamicFaqItems = useMemo(() => {
    const content = (landingSections.faq?.content ?? {}) as Record<string, unknown>;
    const items = Array.isArray(content.items)
      ? content.items
          .map((item, index) => {
            if (!item || typeof item !== "object") return null;
            const record = item as Record<string, unknown>;
            const question = typeof record.question === "string" ? record.question.trim() : "";
            const answer = typeof record.answer === "string" ? record.answer.trim() : "";
            const sortOrder = typeof record.sortOrder === "number"
              ? record.sortOrder
              : typeof record.sort_order === "number"
                ? record.sort_order
                : index;
            const showOnHome = Boolean(record.showOnHome ?? record.show_on_home ?? false);

            return question || answer ? { q: question, a: answer, sortOrder, showOnHome } : null;
          })
          .filter((item): item is { q: string; a: string; sortOrder: number; showOnHome: boolean } => item !== null)
          .sort((a, b) => a.sortOrder - b.sortOrder)
      : [];

    return items.length > 0
      ? items
      : defaultFaqItems;
  }, [defaultFaqItems, landingSections]);
  const homeFaqItems = useMemo(
    () => dynamicFaqItems.filter((item) => item.showOnHome),
    [dynamicFaqItems],
  );
  const footerCtaContent = useMemo(() => {
    const content = (landingSections.footer_cta?.content ?? {}) as Record<string, unknown>;

    return {
      title:
        typeof content.title === "string" && content.title.trim() !== ""
          ? content.title
          : t("landingPreview.footer"),
    };
  }, [landingSections, t]);

  const sectionIsEnabled = (key: string) => (landingSections[key]?.status ?? "active") === "active";
  const sliderContent = useMemo(() => {
    const content = (landingSections.slider?.content ?? {}) as Record<string, unknown>;

    return {
      badgeText: typeof content.badgeText === "string" && content.badgeText.trim() !== "" ? content.badgeText : t("landingPreview.slider.badge"),
      titleLine1: typeof content.titleLine1 === "string" && content.titleLine1.trim() !== "" ? content.titleLine1 : t("landingPreview.slider.titleLine1"),
      titleHighlight: typeof content.titleHighlight === "string" && content.titleHighlight.trim() !== "" ? content.titleHighlight : t("landingPreview.slider.titleHighlight"),
      titleLine3: typeof content.titleLine3 === "string" && content.titleLine3.trim() !== "" ? content.titleLine3 : t("landingPreview.slider.titleLine3"),
      description: typeof content.description === "string" && content.description.trim() !== "" ? content.description : t("landingPreview.slider.description"),
      featureChips: Array.isArray(content.featureChips) ? content.featureChips.filter((item): item is string => typeof item === "string" && item.trim() !== "").slice(0, 3) : [t("landingPreview.slider.chip.1"), t("landingPreview.slider.chip.2"), t("landingPreview.slider.chip.3")],
      primaryCtaText: typeof content.primaryCtaText === "string" && content.primaryCtaText.trim() !== "" ? content.primaryCtaText : t("landingPreview.slider.primaryCta"),
      secondaryCtaText: typeof content.secondaryCtaText === "string" && content.secondaryCtaText.trim() !== "" ? content.secondaryCtaText : t("landingPreview.slider.secondaryCta"),
      sideTitle: typeof content.sideTitle === "string" && content.sideTitle.trim() !== "" ? content.sideTitle : t("landingPreview.slider.sideTitle"),
      sideDescription: typeof content.sideDescription === "string" && content.sideDescription.trim() !== "" ? content.sideDescription : t("landingPreview.slider.sideDescription"),
      sideBullets: Array.isArray(content.sideBullets) ? content.sideBullets.filter((item): item is string => typeof item === "string" && item.trim() !== "").slice(0, 7) : [t("landingPreview.slider.bullet.1"), t("landingPreview.slider.bullet.2"), t("landingPreview.slider.bullet.3")],
    };
  }, [landingSections, t]);
  const selectedFeature = useMemo(
    () => dynamicFeatureItems.items.find((item) => item.id === selectedFeatureId) ?? dynamicFeatureItems.items[0],
    [dynamicFeatureItems.items, selectedFeatureId],
  );
  const previewFeatures = dynamicFeatureItems.items.slice(0, 12);
  const demoImageUrl = galleryShowcaseContent.imageUrl;
  const demoVideoUrl = videoIntroContent.videoUrl;
  const isLocalVideoUrl = useMemo(() => {
    if (!demoVideoUrl) {
      return false;
    }

    const normalized = demoVideoUrl.trim().toLowerCase();

    if (normalized.startsWith("blob:") || normalized.startsWith("data:video/")) {
      return true;
    }

    return normalized.startsWith("/") && /\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/.test(normalized);
  }, [demoVideoUrl]);

  const durationOptionsForSelectedPlan = useMemo(() => {
    if (!selectedPlanCard) {
      return [];
    }

    return availablePlanPackages
      .filter((item) => userLimitKey(item.userLimit ?? null) === userLimitKey(selectedPlanCard.userLimit))
      .sort((a, b) => a.durationDays - b.durationDays);
  }, [availablePlanPackages, selectedPlanCard]);

  useEffect(() => {
    if (bootstrapMeta?.isLandingDomain) {
      setPlanPackages(landingPackages);
      return;
    }

    api.supportRenewal.publicPackages().then((res) => {
      if (res.success) {
        setPlanPackages(res.data.packages);
      }
    });
  }, [bootstrapMeta?.isLandingDomain, landingPackages]);

  useEffect(() => {
    if (!dynamicFeatureItems.items.some((item) => item.id === selectedFeatureId)) {
      setSelectedFeatureId(dynamicFeatureItems.items[0]?.id ?? "");
      setFeatureSlideIndex(0);
    }
  }, [dynamicFeatureItems.items, selectedFeatureId]);

  useEffect(() => {
    if (dynamicPainPoints.length === 0) {
      setActivePainPointIndex(0);
      setPainPointProgress(0);
      return;
    }

    setActivePainPointIndex((currentIndex) => (currentIndex >= dynamicPainPoints.length ? 0 : currentIndex));
  }, [dynamicPainPoints]);

  useEffect(() => {
    if (dynamicPainPoints.length === 0) {
      return;
    }

    if (dynamicPainPoints.length === 1) {
      setPainPointProgress(100);
      return;
    }

    setPainPointProgress(0);

    const duration = 4200;
    const intervalMs = 60;
    const increment = 100 / (duration / intervalMs);

    const progressTimer = window.setInterval(() => {
      setPainPointProgress((currentValue) => Math.min(currentValue + increment, 100));
    }, intervalMs);

    const slideTimer = window.setTimeout(() => {
      setActivePainPointIndex((currentIndex) => (currentIndex + 1) % dynamicPainPoints.length);
    }, duration);

    return () => {
      window.clearInterval(progressTimer);
      window.clearTimeout(slideTimer);
    };
  }, [activePainPointIndex, dynamicPainPoints]);

  const openPlanDurationModal = (plan: LandingPlanCard) => {
    setSelectedPlanCard(plan);
    setPlanDurationModalOpen(true);
  };

  const handlePlanDurationSelect = (pkg: SupportRenewalPackage) => {
    const params = new URLSearchParams({
      users: userLimitKey(pkg.userLimit ?? null),
      duration: String(pkg.durationDays),
    });

    window.location.href = `${getLandingPath("/plans")}?${params.toString()}`;
  };

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
              <SheetContent
                side={isRtl ? "right" : "left"}
                className="border-border bg-card/95 pt-12"
                closeClassName="end-4 start-auto"
                dir={dir}
              >
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

      <main className="container mx-auto max-w-6xl flex-1 space-y-8 px-4 py-8">
        {sectionIsEnabled("slider") ? (
        <section id="about" className="overflow-hidden rounded-[28px] border border-primary/20 bg-gradient-to-br from-[#0f1b38] via-[#0d1a35] to-[#12224a] p-6 sm:p-8 lg:p-10">
          <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-4">
              <Badge className="rounded-full bg-primary/90 px-4 py-1 text-sm text-primary-foreground">{sliderContent.badgeText}</Badge>
              <h1 className="text-3xl font-black leading-tight sm:text-4xl lg:text-5xl">
                {sliderContent.titleLine1}
                <span className="text-primary"> {sliderContent.titleHighlight}</span>
                {sliderContent.titleLine3 ? <span> {sliderContent.titleLine3}</span> : null}
              </h1>
              <p className="max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
                {sliderContent.description}
              </p>
              <div className="grid gap-2 text-sm text-slate-200 sm:grid-cols-3">
                {sliderContent.featureChips.map((chip, index) => {
                  const icons = [CalendarClock, MessageSquareText, Pin];
                  const Icon = icons[index] ?? CalendarClock;
                  return (
                    <div key={`${chip}-${index}`} className="flex items-center justify-start gap-2 rounded-xl bg-background/15 px-3 py-2.5">
                      <Icon className="h-4 w-4 shrink-0 text-primary" />
                      <span className="font-semibold">{chip}</span>
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-nowrap gap-2 sm:gap-3">
                <Button className="min-w-0 flex-1 rounded-2xl px-3 text-xs sm:flex-none sm:px-6 sm:text-sm">
                  <Rocket className="me-2 h-4 w-4" />
                  {sliderContent.primaryCtaText}
                </Button>
                <Button
                  variant="outline"
                  className="min-w-0 flex-1 rounded-2xl border-primary/40 bg-transparent px-3 text-xs text-primary hover:bg-primary/10 sm:flex-none sm:px-6 sm:text-sm"
                >
                  {sliderContent.secondaryCtaText}
                </Button>
              </div>
            </div>

            <Card className="border-primary/25 bg-background/35">
              <CardHeader>
                <CardTitle className="text-base">{sliderContent.sideTitle}</CardTitle>
                <CardDescription>{sliderContent.sideDescription}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {sliderContent.sideBullets.map((bullet, index) => (
                  <div key={`${bullet}-${index}`} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                    <span>{bullet}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </section>
        ) : null}

        {sectionIsEnabled("pain_points") ? <section className="space-y-3">
          <Card className="relative overflow-hidden border-border/70 bg-card/60">
            <CardContent className="p-6 sm:p-8">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black sm:text-xl">{t("landingPreview.pain.title")}</h3>
                  <p className="mt-1 text-sm leading-7 text-muted-foreground">
                    {t("landingPreview.pain.description")}
                  </p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-base font-black text-primary">
                    {format.number(Math.min(activePainPointIndex + 1, dynamicPainPoints.length))}
                  </span>
                  <div className="min-h-[88px] flex-1">
                    <p className="text-base font-bold leading-8 text-foreground sm:text-xl">
                      {dynamicPainPoints[activePainPointIndex] ?? dynamicPainPoints[0]}
                    </p>

                    <div className="mt-6 h-2 overflow-hidden rounded-full bg-primary/10">
                      <div
                        className="h-full rounded-full bg-primary transition-[width] duration-100 ease-linear"
                        style={{ width: `${painPointProgress}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section> : null}

        {sectionIsEnabled("video_intro") || sectionIsEnabled("before_after") ? <section className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
          {sectionIsEnabled("video_intro") ? (
          <Card className="border-border/70 bg-card/60">
            <CardHeader>
              <CardTitle className="text-lg">{videoIntroContent.title}</CardTitle>
              <CardDescription>{videoIntroContent.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <button
                type="button"
                onClick={() => setVideoOpen(true)}
                className="relative flex aspect-video w-full items-center justify-center rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/10 to-background transition hover:border-primary/45 hover:from-primary/15 focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <div className="flex h-18 w-18 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_24px_50px_-24px_rgba(245,158,11,0.9)] sm:h-20 sm:w-20">
                  <span
                    aria-hidden="true"
                    className="block h-0 w-0 translate-x-[2px] border-y-[12px] border-r-0 border-l-[18px] border-y-transparent border-l-current sm:border-y-[13px] sm:border-l-[20px]"
                  />
                </div>
                <div className="absolute bottom-3 end-3 rounded-full bg-background/70 px-3 py-1 text-xs text-muted-foreground">{videoIntroContent.buttonLabel}</div>
              </button>
            </CardContent>
          </Card>
          ) : null}
          {sectionIsEnabled("before_after") ? (
          <Card className="border-border/70 bg-card/60">
            <CardHeader>
              <CardTitle className="text-start text-lg">{beforeAfterContent.sectionTitle}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-start text-sm leading-7 text-muted-foreground" dir={dir}>
              {beforeAfterContent.items.map((item, index) => {
                const icons = [Frown, Smile, TrendingUp];
                const Icon = icons[index % icons.length] ?? Smile;

                return (
                  <div key={`${item.title}-${index}`} className="rounded-xl bg-background/30 p-3">
                    <p className="flex items-center justify-start gap-2 font-semibold text-foreground">
                      <Icon className="h-4 w-4 text-primary" />
                      <span>{item.title}</span>
                    </p>
                    <p>{item.description}</p>
                  </div>
                );
              })}
            </CardContent>
          </Card>
          ) : null}
        </section> : null}

        {sectionIsEnabled("gallery_showcase") ? <section id="gallery" className="grid gap-4 lg:grid-cols-3">
          <Card className="border-border/70 bg-card/60 lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">{galleryShowcaseContent.title}</CardTitle>
              <CardDescription>{galleryShowcaseContent.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="overflow-hidden rounded-2xl border border-border/70 bg-background/30">
                <img src={demoImageUrl} alt={t("landingPreview.gallery.imageAlt")} className="h-[280px] w-full object-cover object-top" loading="lazy" />
              </div>
              <a href={galleryShowcaseContent.buttonUrl} target={galleryShowcaseContent.buttonUrl.startsWith("http") ? "_blank" : undefined} rel={galleryShowcaseContent.buttonUrl.startsWith("http") ? "noopener noreferrer" : undefined}>
                <Button variant="outline" className="rounded-2xl border-primary/35 bg-transparent">{galleryShowcaseContent.buttonLabel}</Button>
              </a>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/60">
            <CardHeader>
              <CardTitle className="text-base">{galleryShowcaseContent.statsTitle}</CardTitle>
              <CardDescription>{galleryShowcaseContent.statsDescription}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {galleryShowcaseContent.stats.map((stat, index) => (
                <div key={`${stat.label}-${index}`} className="rounded-xl border border-border/70 bg-background/35 p-3">
                  <div className="text-xs text-muted-foreground">{stat.label}</div>
                  <div className="mt-1 text-lg font-black text-primary">{stat.value}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        </section> : null}

        {sectionIsEnabled("feature_grid") ? <section id="features" className="grid gap-4">
          <Card className="border-border/70 bg-card/60">
            <CardHeader>
              <CardTitle className="text-lg">{dynamicFeatureItems.title}</CardTitle>
              <CardDescription>{dynamicFeatureItems.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {previewFeatures.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setSelectedFeatureId(item.id);
                        setFeatureSlideIndex(0);
                        setFeatureModalOpen(true);
                      }}
                      className="rounded-2xl border border-border/70 bg-background/30 p-4 text-start transition hover:border-primary/25"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <Icon className="h-5 w-5 text-primary" />
                        <LayoutGrid className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="text-base font-bold">{item.title}</div>
                      <div className="mt-2 text-sm leading-7 text-muted-foreground">{item.short}</div>
                      <div className="mt-3 inline-flex items-center gap-1 text-xs text-primary">
                        <Eye className="h-3.5 w-3.5" />
                        {t("landingPreview.feature.viewDetails")}
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="flex justify-center">
                <Link href={getLandingPath("/features")}>
                  <Button variant="outline" className="rounded-2xl border-primary/35 bg-transparent">
                    {dynamicFeatureItems.viewAllLabel}
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </section> : null}

        {sectionIsEnabled("process_steps") ? <section className="space-y-3">
          <div className="lg:hidden">
            <Card className="border-border/70 bg-card/60">
              <CardHeader>
                <Badge className="w-fit rounded-full bg-primary/20 text-primary">
                  {t("landingPreview.process.step", { index: format.number(activeProcessStep + 1) })}
                </Badge>
                <CardTitle className="text-base">{dynamicProcessSteps[activeProcessStep].title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-7 text-muted-foreground">
                  {dynamicProcessSteps[activeProcessStep].description}
                </p>
              </CardContent>
            </Card>
            <div className="mt-3 flex items-center justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl border-border bg-background/40"
                onClick={() => setActiveProcessStep((current) => Math.max(current - 1, 0))}
                disabled={activeProcessStep === 0}
              >
                {isRtl ? <ArrowRight className="me-1 h-4 w-4" /> : <ArrowLeft className="me-1 h-4 w-4" />}
                {t("common.pagination.previous")}
              </Button>
              <div className="flex items-center gap-1.5">
                {dynamicProcessSteps.map((_, index) => (
                  <button
                    key={`process-dot-${index}`}
                    type="button"
                    onClick={() => setActiveProcessStep(index)}
                    className={`h-1.5 rounded-full transition-all ${index === activeProcessStep ? "w-5 bg-primary" : "w-2 bg-white/30"}`}
                    aria-label={t("landingPreview.process.step", { index: format.number(index + 1) })}
                  />
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl border-border bg-background/40"
                onClick={() =>
                  setActiveProcessStep((current) => Math.min(current + 1, dynamicProcessSteps.length - 1))
                }
                disabled={activeProcessStep === dynamicProcessSteps.length - 1}
              >
                {t("common.pagination.next")}
                {isRtl ? <ArrowLeft className="ms-1 h-4 w-4" /> : <ArrowRight className="ms-1 h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="hidden gap-4 lg:grid lg:grid-cols-3">
            {dynamicProcessSteps.map((step, index) => (
              <Card key={step.title} className="border-border/70 bg-card/60">
                <CardHeader>
                  <Badge className="w-fit rounded-full bg-primary/20 text-primary">{t("landingPreview.process.step", { index: format.number(index + 1) })}</Badge>
                  <CardTitle className="text-base">{step.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-7 text-muted-foreground">{step.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section> : null}

        {sectionIsEnabled("plans") ? <section id="plans" className="space-y-4">
          <div className="text-center">
            <h3 className="text-2xl font-black sm:text-3xl">{dynamicPlanSection.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{dynamicPlanSection.description}</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {dynamicPlanSection.cards.map((plan) => (
              <Card key={plan.id} className={plan.featured ? "border-primary/35 bg-primary/10 shadow-sm shadow-primary/10" : "border-border/70 bg-card/60"}>
                <CardHeader>
                  {plan.featured && plan.badgeText ? <Badge className="w-fit rounded-full">{plan.badgeText}</Badge> : null}
                  <CardTitle className="text-base">{plan.title}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-2xl font-black text-primary">{plan.priceLabel}</div>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    {plan.features.map((feature) => (
                      <div key={feature} className="flex items-center gap-2">
                        <BadgeCheck className="h-4 w-4 text-primary" />
                        {feature}
                      </div>
                    ))}
                  </div>
                  <Button
                    variant={plan.buttonVariant ?? "default"}
                    className={`w-full rounded-2xl ${plan.buttonVariant === "outline" ? "border-primary/35 bg-transparent" : ""}`}
                    onClick={() => openPlanDurationModal(plan)}
                  >
                    {plan.buttonText}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="flex justify-center pt-1">
            <Link href={getLandingPath("/plans")}>
              <Button variant="outline" className="rounded-2xl border-primary/35 bg-transparent">
                {dynamicPlanSection.fullPageButtonLabel}
              </Button>
            </Link>
          </div>
        </section> : null}

        {sectionIsEnabled("faq") ? <section id="faq" className="space-y-3">
          <h3 className="text-2xl font-black">{t("landingPreview.faq.title")}</h3>
          <div className="space-y-2">
            {homeFaqItems.map((item, index) => (
              <button
                key={item.q}
                type="button"
                onClick={() => setOpenFaqId((current) => (current === index ? -1 : index))}
                className="w-full rounded-2xl border border-border/70 bg-card/55 p-4 text-start"
              >
                <div className="font-semibold">{item.q}</div>
                {openFaqId === index ? <p className="mt-2 text-sm leading-7 text-muted-foreground">{item.a}</p> : null}
              </button>
            ))}
          </div>
        </section> : null}

      </main>

      {sectionIsEnabled("footer_cta") ? <footer className="border-t border-border/70 bg-card/70 backdrop-blur-md">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-center gap-2 text-sm sm:text-base">
            <SmilePlus className="h-4 w-4 text-primary" />
            <span className="font-semibold text-foreground">{footerCtaContent.title}</span>
          </div>
        </div>
      </footer> : null}

      <Dialog open={videoOpen} onOpenChange={setVideoOpen}>
        <DialogContent className="max-w-4xl border-border/70 bg-card/95 p-3 sm:p-4" dir={dir}>
          <DialogHeader>
            <DialogTitle>{videoIntroContent.modalTitle}</DialogTitle>
            <DialogDescription>{videoIntroContent.modalDescription}</DialogDescription>
          </DialogHeader>
          <div className="overflow-hidden rounded-2xl border border-border/70 bg-black">
            {isLocalVideoUrl ? (
              <video
                src={demoVideoUrl}
                controls
                autoPlay={videoOpen}
                playsInline
                className="max-h-[70vh] w-full object-contain"
              />
            ) : (
              <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 px-6 py-10 text-center">
                <Eye className="h-10 w-10 text-primary" />
                <div className="space-y-2">
                  <div className="text-lg font-bold text-white">{t("landingPreview.video.localOnlyTitle")}</div>
                  <p className="max-w-xl text-sm leading-7 text-slate-300">
                    {t("landingPreview.video.localOnlyPrefix")}
                    <CodeText className="mx-1 text-xs text-white">/videos/intro.mp4</CodeText>
                    {t("landingPreview.video.localOnlySuffix")}
                  </p>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={phoneModalOpen} onOpenChange={setPhoneModalOpen}>
        <DialogContent className="max-w-md border-border/70 bg-card/95" dir={dir}>
          <DialogHeader>
            <DialogTitle>{t("landingPreview.phoneModal.title")}</DialogTitle>
            <DialogDescription>{t("landingPreview.phoneModal.description")}</DialogDescription>
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

      <Dialog open={planDurationModalOpen} onOpenChange={setPlanDurationModalOpen}>
        <DialogContent className="max-h-[88vh] max-w-lg overflow-hidden border-border/70 bg-card/95 p-0" dir={dir}>
          <div className="flex max-h-[88vh] flex-col">
            <div className="border-b border-border/60 px-6 py-5">
          <DialogHeader>
            <DialogTitle>{t("landingPreview.planDuration.title")}</DialogTitle>
            <DialogDescription>
              {selectedPlanCard ? t("landingPreview.planDuration.descriptionWithPlan", { plan: selectedPlanCard.title }) : t("landingPreview.planDuration.description")}
            </DialogDescription>
          </DialogHeader>
            </div>
            <div className="pretty-scrollbar flex-1 overflow-y-auto px-6 py-5">
              <div className="grid gap-3 sm:grid-cols-2">
                {durationOptionsForSelectedPlan.map((pkg) => (
                  <button
                    key={pkg.id}
                    type="button"
                    onClick={() => handlePlanDurationSelect(pkg)}
                    className="rounded-2xl border border-border/70 bg-background/35 p-4 text-start transition hover:border-primary/40 hover:bg-primary/10"
                  >
                    <div className="font-bold text-foreground">{formatPlanDurationLabel(pkg.durationDays)}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{pkg.name}</div>
                    <div className="mt-4 text-lg font-black text-primary">
                      {format.currency(pkg.payableAmount)}
                    </div>
                  </button>
                ))}
                {selectedPlanCard && durationOptionsForSelectedPlan.length === 0 ? (
                  <div className="rounded-2xl border border-border/70 bg-background/35 p-4 text-sm leading-7 text-muted-foreground sm:col-span-2">
                    {t("landingPreview.planDuration.empty")}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="border-t border-border/60 px-6 py-4">
              <div className="flex justify-end">
                <Link href={getLandingPath("/plans")}>
                  <Button variant="outline" className="rounded-2xl border-primary/35 bg-transparent">
                    {t("landingPreview.plans.fullPage")}
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={featureModalOpen} onOpenChange={setFeatureModalOpen}>
        <DialogContent className="max-w-3xl border-border/70 bg-card/95 p-3 sm:p-4" dir={dir}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <selectedFeature.icon className="h-5 w-5 text-primary" />
              {selectedFeature.title}
            </DialogTitle>
            <DialogDescription>{t("landingPreview.feature.modalDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm leading-8 text-muted-foreground">{selectedFeature.detail}</p>
            <div className="overflow-hidden rounded-2xl border border-border/70 bg-background/30">
              <img
                src={selectedFeature.imageUrls[featureSlideIndex] ?? selectedFeature.imageUrls[0]}
                alt={selectedFeature.title}
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
                    aria-label={t("landingPreview.feature.slideAria", { index: format.number(index + 1) })}
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
