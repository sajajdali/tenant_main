import { Link } from "wouter";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowRight, BookOpenText, Bot, BriefcaseBusiness, CalendarDays, CalendarX2, ChefHat, ClipboardList, ClipboardPlus, Coins, CreditCard, DatabaseBackup, Dumbbell, FileArchive, FileText, FolderOpen, Gem, Gift, Globe, HardDrive, Headset, HeartHandshake, IdCard, ImageIcon, Info, Link2, Lock, LockOpen, Megaphone, MessageCircleMore, MonitorSmartphone, Paintbrush, Percent, PhoneCall, Salad, Settings, Settings2, ShieldAlert, ShoppingBag, ShoppingCart, Sparkles, Star, Stethoscope, TicketPercent, Users, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";
import { subscribeOnlineChatAdminUpdates, subscribeSupportTicketUpdates } from "@/lib/realtime";
import { NutritionDietRequestAdminStats, NutritionTokenDashboardPayload, OnlineChatAdminDashboardPayload, OnlineChatConversationSummary, PaymentSettings, TenantMeta } from "@/lib/types";
import { getAudienceFeatureOrder, getAudienceFutureFeatureOrder, getAudienceLabels, getAudienceNutritionFeatureOrder, hasAudienceFeature, hasAudienceFutureFeature, hasAudienceNutritionFeature, isAppointmentBookingDisabled } from "@/lib/audience";
import { getInitialTenantMeta } from "@/lib/bootstrap";
import { useToast } from "@/hooks/use-toast";
import { SupportExpiredLock } from "@/components/support-expired-lock";
import { useFormat, useLocale, useT } from "@/i18n/locale";

type PanelCard = {
  title: string;
  description: string;
  href?: string;
  icon: typeof Users;
  badge?: string;
  disabled?: boolean;
  featureKey?: string;
};

export default function PanelPage() {
  const { isAdmin, isPrimaryAdmin, isBarber } = useAuth();
  const { barbers, sections } = useStore();
  const { toast } = useToast();
  const { dir, isRtl } = useLocale();
  const format = useFormat();
  const t = useT();
  const [tenantMeta, setTenantMeta] = useState<TenantMeta | null>(() => getInitialTenantMeta());
  const [generalSettings, setGeneralSettings] = useState<PaymentSettings | null>(null);
  const [supportUnreadCount, setSupportUnreadCount] = useState(0);
  const [onlineChatUnreadCount, setOnlineChatUnreadCount] = useState(0);
  const [latestUnreadConversation, setLatestUnreadConversation] = useState<OnlineChatConversationSummary | null>(null);
  const [nutritionTokenDashboard, setNutritionTokenDashboard] = useState<NutritionTokenDashboardPayload | null>(null);
  const [nutritionRequestStats, setNutritionRequestStats] = useState<NutritionDietRequestAdminStats | null>(null);
  const hasShownOnlineChatToastRef = useRef(false);
  const nutritionAudienceSlug = tenantMeta?.audience?.slug || getInitialTenantMeta()?.audience?.slug || "";
  const isNutritionExpertAudience = ["nutritionists", "nutrition-doctors"].includes(nutritionAudienceSlug);
  const appointmentBookingDisabled = isAppointmentBookingDisabled(tenantMeta);
  const onlineChatModuleActive = tenantMeta?.activeFeatureModules?.some((item) => item.slug === "online-chat") ?? false;
  const nutritionStatsActionClass = "w-full rounded-2xl border border-teal-400/20 bg-teal-400/10 text-teal-100 shadow-none hover:bg-teal-400/15 hover:text-teal-50";
  const formatStorageBytes = (bytes?: number | null) => {
    const safeBytes = Math.max(0, Number(bytes ?? 0));
    const gb = safeBytes / 1024 / 1024 / 1024;

    if (gb >= 1) {
      return t("panelFiles.storage.gigabytes", {
        value: format.number(gb, { maximumFractionDigits: gb >= 10 ? 0 : 1 }),
      });
    }

    const mb = safeBytes / 1024 / 1024;

    if (mb >= 1) {
      return t("panelFiles.storage.megabytes", {
        value: format.number(mb, { maximumFractionDigits: mb >= 10 ? 0 : 1 }),
      });
    }

    const kb = safeBytes / 1024;

    if (kb >= 1) {
      return t("panelFiles.storage.kilobytes", {
        value: format.number(kb, { maximumFractionDigits: kb >= 10 ? 0 : 1 }),
      });
    }

    return t("panelFiles.storage.bytes", { value: format.number(safeBytes) });
  };

  const syncOnlineChatDashboard = (data: OnlineChatAdminDashboardPayload) => {
    setOnlineChatUnreadCount(data.stats.unread);
    setLatestUnreadConversation(data.items.find((item) => item.adminUnreadCount > 0) ?? null);
  };

  useEffect(() => {
    api.meta.get().then((res) => {
      if (res.success) {
        setTenantMeta(res.data);
      }
    });

    api.payment.getSettings().then((res) => {
      if (res.success) {
        setGeneralSettings(res.data);
      }
    });

    if (isPrimaryAdmin) {
      api.supportTickets.list(1, 1).then((res) => {
        if (res.success) {
          setSupportUnreadCount(res.data.stats.unread);
        }
      });
    }
  }, [isPrimaryAdmin]);

  useEffect(() => {
    if (!isAdmin || !onlineChatModuleActive) {
      setOnlineChatUnreadCount(0);
      setLatestUnreadConversation(null);
      return;
    }

    api.onlineChat.adminList().then((res) => {
      if (res.success) {
        syncOnlineChatDashboard(res.data);
      }
    });
  }, [isAdmin, onlineChatModuleActive]);

  useEffect(() => {
    if (!isPrimaryAdmin || !isNutritionExpertAudience) {
      return;
    }

    api.nutritionTokens.dashboard().then((res) => {
      if (res.success) {
        setNutritionTokenDashboard(res.data);
      }
    });

    api.nutritionDietRequests.adminList("", 1, 1, "all").then((res) => {
      if (res.success) {
        setNutritionRequestStats(res.data.stats);
      }
    });
  }, [isPrimaryAdmin, isNutritionExpertAudience]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);

    if (params.get("supportRenewed") === "1") {
      toast({ title: t("panelDashboard.toast.supportRenewedTitle"), description: t("panelDashboard.toast.supportRenewedDescription") });
      window.history.replaceState({}, "", "/panel");
    }
  }, [t, toast]);

  useEffect(() => {
    if (!isPrimaryAdmin) {
      return;
    }

    return subscribeSupportTicketUpdates(() => {
      api.supportTickets.list(1, 1).then((res) => {
        if (res.success) {
          setSupportUnreadCount(res.data.stats.unread);
        }
      });
    });
  }, [isPrimaryAdmin]);

  useEffect(() => {
    if (!isAdmin || !onlineChatModuleActive) {
      return;
    }

    return subscribeOnlineChatAdminUpdates(() => {
      api.onlineChat.adminList().then((res) => {
        if (res.success) {
          syncOnlineChatDashboard(res.data);
        }
      });
    });
  }, [isAdmin, onlineChatModuleActive]);

  useEffect(() => {
    if (!isAdmin || !onlineChatModuleActive || onlineChatUnreadCount <= 0 || hasShownOnlineChatToastRef.current) {
      return;
    }

    const storageKey = `panel-online-chat-toast:${tenantMeta?.tenant_id ?? "tenant"}`;

    if (typeof window !== "undefined" && window.sessionStorage.getItem(storageKey) === "1") {
      hasShownOnlineChatToastRef.current = true;
      return;
    }

    toast({
      title: t("panelDashboard.onlineChat.toastTitle", { count: format.number(onlineChatUnreadCount) }),
      description: t("panelDashboard.onlineChat.toastDescription"),
    });

    hasShownOnlineChatToastRef.current = true;

    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(storageKey, "1");
    }
  }, [format, isAdmin, onlineChatModuleActive, onlineChatUnreadCount, tenantMeta?.tenant_id, t, toast]);

  if (!isAdmin && !isBarber) {
    return (
      <div className="min-h-screen bg-background text-foreground p-4 flex items-center justify-center" dir={dir}>
        <div className="max-w-md w-full text-center space-y-4">
          <ShieldAlert className="w-12 h-12 mx-auto text-destructive" />
          <h1 className="text-xl font-bold">{t("panelDashboard.accessDenied.title")}</h1>
          <p className="text-muted-foreground leading-7">
            {t("panelDashboard.accessDenied.description")}
          </p>
          <Link href="/">
            <Button>{t("panelDashboard.backHome")}</Button>
          </Link>
        </div>
      </div>
    );
  }

  const supportExpired = tenantMeta?.supportExpired ?? false;
  const panelAccessLocked = tenantMeta?.panelAccessLocked ?? false;
  const panelAccessMessage = tenantMeta?.panelAccessMessage?.trim() || t("panelDashboard.panelLocked.description");
  const irDomain = tenantMeta?.domainRenewal ?? tenantMeta?.irDomain;
  const irDomainLabel = irDomain?.tld
    ? t("domainRenewal.labelWithTld", { tld: irDomain.tld })
    : t("panelDashboard.domain.defaultLabel");
  const supportEndLabel = useMemo(() => {
    if (!tenantMeta?.supportEndsAt) return t("supportRenewal.notSet");
    return format.date(tenantMeta.supportEndsAt);
  }, [format, t, tenantMeta?.supportEndsAt]);
  const storageUsage = tenantMeta?.storage;
  const storageUsedBytes = storageUsage?.usedBytes ?? 0;
  const storageTotalBytes = storageUsage?.totalQuotaBytes ?? 0;
  const storagePercent = storageTotalBytes > 0 ? Math.min(100, Math.max(0, (storageUsedBytes / storageTotalBytes) * 100)) : 0;
  const storageFull = Boolean(storageUsage?.isFull || storagePercent >= 100);
  const storageWarningLevel = storageFull ? "full" : storagePercent >= 95 ? "critical" : storagePercent >= 80 ? "warning" : "ok";
  const storageRemainingBytes = storageUsage?.remainingBytes ?? Math.max(0, storageTotalBytes - storageUsedBytes);
  const storageRingRadius = 34;
  const storageRingCircumference = 2 * Math.PI * storageRingRadius;
  const storageRingOffset = storageRingCircumference - (storagePercent / 100) * storageRingCircumference;
  const storageRingColor = storageUsage?.isFull || storagePercent >= 95
    ? "stroke-destructive"
    : storagePercent >= 75
      ? "stroke-amber-400"
      : "stroke-primary";
  const labels = getAudienceLabels(tenantMeta);
  const isStorageAllowedHref = (href?: string) => href === "/panel/files";

  if (panelAccessLocked) {
    return (
      <div className="min-h-screen bg-background text-foreground p-4 flex items-center justify-center" dir={dir}>
        <div className="max-w-xl w-full">
          <Card className="border-destructive/30 bg-card/70 text-center shadow-sm">
            <CardHeader className="space-y-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-destructive/30 bg-destructive/10">
                <Lock className="h-8 w-8 text-destructive" />
              </div>
              <CardTitle className="text-2xl">{t("panelDashboard.panelLocked.title")}</CardTitle>
              <CardDescription className="text-base leading-8 text-muted-foreground">
                {panelAccessMessage}
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    );
  }

  const managementCards: PanelCard[] = [
    ...(isPrimaryAdmin
      ? [
          {
            title: t("panelDashboard.managementCards.finance.title"),
            description: t("panelDashboard.managementCards.finance.description", {
              business: labels.business,
              professional: labels.singular,
            }),
            href: "/panel/finance",
            icon: CreditCard,
            disabled: supportExpired,
          } satisfies PanelCard,
        ]
      : []),
    ...(isPrimaryAdmin
      ? [
          {
            title: t("panelDashboard.managementCards.commission.title", { professional: labels.singular }),
            description: t("panelDashboard.managementCards.commission.description"),
            href: "/panel/commission-report",
            icon: Percent,
            disabled: supportExpired,
          } satisfies PanelCard,
        ]
      : []),
    {
      title: t("panelDashboard.managementCards.dailyReport.title"),
      description: t("panelDashboard.managementCards.dailyReport.description"),
      href: "/panel/daily-report",
      icon: CalendarDays,
      disabled: supportExpired,
    },
    {
      title: t("panelDashboard.managementCards.latestBookings.title"),
      description: isAdmin
        ? t("panelDashboard.managementCards.latestBookings.adminDescription")
        : t("panelDashboard.managementCards.latestBookings.userDescription"),
      href: "/panel/latest-bookings",
      icon: ClipboardList,
      disabled: supportExpired,
    },
    {
      title: t("panelDashboard.managementCards.manualFinance.title"),
      description: t("panelDashboard.managementCards.manualFinance.description"),
      href: "/panel/manual-finance",
      icon: WalletCards,
      disabled: supportExpired,
    },
    {
      title: isAdmin
        ? t("panelDashboard.managementCards.professionals.adminTitle", { professionals: labels.plural })
        : t("panelDashboard.managementCards.professionals.userTitle"),
      description: isAdmin
        ? t("panelDashboard.managementCards.professionals.adminDescription", { professionals: labels.plural })
        : t("panelDashboard.managementCards.professionals.userDescription"),
      href: "/panel/professionals",
      icon: BriefcaseBusiness,
      disabled: supportExpired,
    },
    {
      title: t("panelDashboard.managementCards.bulkCancel.title"),
      description: t("panelDashboard.managementCards.bulkCancel.description"),
      href: "/panel/bulk",
      icon: CalendarDays,
      disabled: supportExpired,
    },
    ...(isPrimaryAdmin
      ? [
          {
            title: t("panelDashboard.managementCards.brandKit.title"),
            description: t("panelDashboard.managementCards.brandKit.description"),
            href: "/panel/brand-kit",
            icon: ImageIcon,
            disabled: supportExpired,
          } satisfies PanelCard,
          {
            title: t("panelDashboard.managementCards.businessResume.title"),
            description: t("panelDashboard.managementCards.businessResume.description"),
            href: "/panel/business-resume",
            icon: IdCard,
            badge: t("panelDashboard.managementCards.badge.new"),
            disabled: supportExpired,
          } satisfies PanelCard,
          {
            title: t("panelDashboard.managementCards.smsSettings.title"),
            description: t("panelDashboard.managementCards.smsSettings.description"),
            href: "/panel/sms-settings",
            icon: MessageCircleMore,
            disabled: supportExpired,
          } satisfies PanelCard,
          {
            title: t("panelDashboard.managementCards.smsCampaigns.title"),
            description: t("panelDashboard.managementCards.smsCampaigns.description"),
            href: "/panel/campaigns/sms",
            icon: Megaphone,
            disabled: supportExpired,
          } satisfies PanelCard,
          {
            title: t("panelDashboard.managementCards.notifications.title"),
            description: t("panelDashboard.managementCards.notifications.description"),
            href: "/panel/campaigns/notifications",
            icon: MonitorSmartphone,
            disabled: supportExpired,
          } satisfies PanelCard,
          {
            title: t("panelDashboard.managementCards.messagingBots.title"),
            description: t("panelDashboard.managementCards.messagingBots.description"),
            href: "/panel/messaging-bots",
            icon: Bot,
            badge: t("panelDashboard.managementCards.messagingBots.badge"),
            disabled: supportExpired,
          } satisfies PanelCard,
          {
            title: t("panelDashboard.managementCards.bookingClosure.title"),
            description: t("panelDashboard.managementCards.bookingClosure.description"),
            href: "/panel/booking-closure",
            icon: CalendarX2,
            disabled: supportExpired,
          } satisfies PanelCard,
          {
            title: t("panelDashboard.managementCards.general.title"),
            description: t("panelDashboard.managementCards.general.description"),
            href: "/panel/general",
            icon: Settings,
            disabled: supportExpired,
          } satisfies PanelCard,
          {
            title: t("panelDashboard.managementCards.support.title"),
            description: t("panelDashboard.managementCards.support.description"),
            href: "/panel/support",
            icon: Headset,
            badge: supportUnreadCount > 0 ? t("panelDashboard.support.newCount", { count: format.number(supportUnreadCount) }) : undefined,
            disabled: false,
          } satisfies PanelCard,
          {
            title: t("panelDashboard.managementCards.appearance.title"),
            description: t("panelDashboard.managementCards.appearance.description"),
            href: "/panel/appearance",
            icon: Paintbrush,
            disabled: supportExpired,
          } satisfies PanelCard,
          {
            title: t("panelDashboard.managementCards.files.title"),
            description: t("panelDashboard.managementCards.files.description"),
            href: "/panel/files",
            icon: FolderOpen,
            badge: t("panelDashboard.managementCards.badge.new"),
            disabled: supportExpired,
          } satisfies PanelCard,
          {
            title: t("panelDashboard.managementCards.gallery.title"),
            description: t("panelDashboard.managementCards.gallery.description"),
            href: "/panel/gallery",
            icon: ImageIcon,
            disabled: supportExpired,
          } satisfies PanelCard,
          {
            title: t("panelDashboard.managementCards.about.title"),
            description: t("panelDashboard.managementCards.about.description"),
            href: "/panel/about",
            icon: Info,
            disabled: supportExpired,
          } satisfies PanelCard,
          {
            title: t("panelDashboard.managementCards.contact.title"),
            description: t("panelDashboard.managementCards.contact.description"),
            href: "/panel/contact",
            icon: PhoneCall,
            disabled: supportExpired,
          } satisfies PanelCard,
          {
            title: t("panelDashboard.managementCards.articles.title"),
            description: t("panelDashboard.managementCards.articles.description"),
            href: "/panel/articles",
            icon: BookOpenText,
            disabled: supportExpired,
          } satisfies PanelCard,
          {
            title: t("panelDashboard.managementCards.referrals.title"),
            description: t("panelDashboard.managementCards.referrals.description"),
            href: "/panel/referrals",
            icon: Gift,
            disabled: false,
          } satisfies PanelCard,
        ]
      : []),
    {
      title: t("panelDashboard.managementCards.users.title"),
      description: t("panelDashboard.managementCards.users.description", { professional: labels.singular }),
      href: "/panel/users",
      icon: Users,
      disabled: supportExpired,
    },
    ...(isAdmin
      ? [{
          title: irDomainLabel,
          description: irDomain?.enabled
            ? t("panelDashboard.managementCards.domain.enabledDescription", { tld: irDomain?.tld || t("panelDashboard.domain.defaultLabel") })
            : irDomain?.selfManaged
              ? t("panelDashboard.managementCards.domain.selfManagedDescription")
              : t("panelDashboard.managementCards.domain.defaultDescription", { tld: irDomain?.tld || t("panelDashboard.domain.defaultLabel") }),
          href: "/panel/domain-renewal",
          icon: Globe,
          badge: irDomain?.enabled
            ? (irDomain.expired ? t("panelDashboard.support.expired") : irDomain.isDueSoon ? t("panelDashboard.domain.dueSoonBadge") : t("panelDashboard.support.active"))
            : (irDomain?.selfManaged ? t("panelDashboard.domain.selfManaged") : t("supportRenewal.notSet")),
          disabled: Boolean(irDomain?.selfManaged),
        } satisfies PanelCard]
      : []),
    {
      title: t("panelDashboard.managementCards.specializedCourses.title"),
      description: t("panelDashboard.managementCards.specializedCourses.description"),
      href: "/panel/specialized-courses",
      icon: BookOpenText,
      badge: t("panelDashboard.managementCards.badge.new"),
      disabled: false,
    },
  ];
  const filteredManagementCards = managementCards.filter((item) => {
    const bookingOnlyHrefs = new Set(["/panel/daily-report", "/panel/latest-bookings", "/panel/bulk"]);

    if (appointmentBookingDisabled && item.href && bookingOnlyHrefs.has(item.href)) {
      return false;
    }

    const featureByHref: Record<string, string> = {
      "/panel/support": "support_tickets",
      "/panel/referrals": "referrals",
      "/panel/gallery": "gallery",
      "/panel/about": "about_page",
      "/panel/contact": "contact_page",
      "/panel/users": "users",
      "/panel/daily-report": "daily_report",
      "/panel/latest-bookings": "daily_report",
      "/panel/professionals": "barbers",
      "/panel/finance": "finance_reports",
      "/panel/commission-report": "finance_reports",
      "/panel/campaigns/sms": "sms_campaigns",
      "/panel/sms-settings": "sms_settings",
      "/panel/campaigns/notifications": "notification_campaigns",
      "/panel/booking-closure": "general_settings",
      "/panel/general": "general_settings",
      "/panel/appearance": "appearance",
      "/panel/brand-kit": "brand_kit",
      "/panel/bulk": "bulk",
      "/panel/specialized-courses": "specialized_courses",
      "/panel/domain-renewal": "domain_renewal",
    };

    if (!item.href) {
      return true;
    }

    const featureKey = featureByHref[item.href];

    if (!featureKey) {
      return true;
    }

    return hasAudienceFeature(tenantMeta, featureKey);
  });
  const sortedManagementCardsBase = [...filteredManagementCards].sort((a, b) => {
    const featureByHref: Record<string, string> = {
      "/panel/support": "support_tickets",
      "/panel/referrals": "referrals",
      "/panel/gallery": "gallery",
      "/panel/about": "about_page",
      "/panel/contact": "contact_page",
      "/panel/users": "users",
      "/panel/daily-report": "daily_report",
      "/panel/latest-bookings": "daily_report",
      "/panel/professionals": "barbers",
      "/panel/finance": "finance_reports",
      "/panel/commission-report": "finance_reports",
      "/panel/campaigns/sms": "sms_campaigns",
      "/panel/sms-settings": "sms_settings",
      "/panel/campaigns/notifications": "notification_campaigns",
      "/panel/booking-closure": "general_settings",
      "/panel/general": "general_settings",
      "/panel/appearance": "appearance",
      "/panel/brand-kit": "brand_kit",
      "/panel/bulk": "bulk",
      "/panel/specialized-courses": "specialized_courses",
      "/panel/domain-renewal": "domain_renewal",
    };

    const aKey = a.href ? featureByHref[a.href] : undefined;
    const bKey = b.href ? featureByHref[b.href] : undefined;
    const aIndex = aKey ? getAudienceFeatureOrder(tenantMeta, aKey, 1000 + managementCards.indexOf(a)) : 1000 + managementCards.indexOf(a);
    const bIndex = bKey ? getAudienceFeatureOrder(tenantMeta, bKey, 1000 + managementCards.indexOf(b)) : 1000 + managementCards.indexOf(b);

    return aIndex - bIndex;
  });
  const sortedManagementCards = (() => {
    const cards = [...sortedManagementCardsBase];
    const manualFinanceIndex = cards.findIndex((item) => item.href === "/panel/manual-finance");
    const latestBookingsIndex = cards.findIndex((item) => item.href === "/panel/latest-bookings");

    if (manualFinanceIndex < 0 || latestBookingsIndex < 0 || manualFinanceIndex === latestBookingsIndex + 1) {
      return cards;
    }

    const [manualFinanceCard] = cards.splice(manualFinanceIndex, 1);
    const targetIndex = cards.findIndex((item) => item.href === "/panel/latest-bookings");
    cards.splice(targetIndex + 1, 0, manualFinanceCard);

    return cards;
  })();

  const nutritionCards: PanelCard[] = [
    {
      title: t("panelDashboard.nutritionCards.landing.title"),
      description: t("panelDashboard.nutritionCards.landing.description"),
      href: "/panel/nutrition/landing",
      icon: MonitorSmartphone,
      disabled: supportExpired,
    },
    {
      title: t("panelDashboard.nutritionCards.requests.title"),
      description: t("panelDashboard.nutritionCards.requests.description"),
      href: "/panel/nutrition/requests",
      icon: ClipboardPlus,
      disabled: supportExpired,
    },
    ...(isNutritionExpertAudience
      ? [
          {
            title: t("panelDashboard.nutritionCards.packageOrders.title"),
            description: t("panelDashboard.nutritionCards.packageOrders.description"),
            href: "/panel/nutrition/package-orders",
            icon: ShoppingBag,
            disabled: supportExpired,
          } satisfies PanelCard,
          {
            title: t("panelDashboard.nutritionCards.prescribe.title"),
            description: t("panelDashboard.nutritionCards.prescribe.description"),
            href: "/panel/nutrition/prescribe",
            icon: Stethoscope,
            disabled: supportExpired,
          } satisfies PanelCard,
          {
            title: t("panelDashboard.nutritionCards.tokens.title"),
            description: t("panelDashboard.nutritionCards.tokens.description"),
            href: "/panel/nutrition/tokens",
            icon: Coins,
            disabled: supportExpired,
          } satisfies PanelCard,
          {
            title: t("panelDashboard.nutritionCards.audioGuidance.title"),
            description: t("panelDashboard.nutritionCards.audioGuidance.description"),
            href: "/panel/nutrition/audio-guidance",
            icon: Headset,
            disabled: supportExpired,
          } satisfies PanelCard,
          {
            title: t("panelDashboard.nutritionCards.dietFiles.title"),
            description: t("panelDashboard.nutritionCards.dietFiles.description"),
            href: "/panel/nutrition/diet-files",
            icon: FileArchive,
            disabled: supportExpired,
          } satisfies PanelCard,
          {
            title: t("panelDashboard.nutritionCards.aiPrompts.title"),
            description: t("panelDashboard.nutritionCards.aiPrompts.description"),
            href: "/panel/nutrition/ai-prompt-presets",
            icon: Sparkles,
            disabled: supportExpired,
          } satisfies PanelCard,
          {
            title: t("panelDashboard.nutritionCards.settings.title"),
            description: t("panelDashboard.nutritionCards.settings.description"),
            href: "/panel/nutrition/settings",
            icon: Settings2,
            disabled: supportExpired,
          } satisfies PanelCard,
          {
            title: t("panelDashboard.nutritionCards.exercises.title"),
            description: t("panelDashboard.nutritionCards.exercises.description"),
            href: "/panel/nutrition/exercises",
            icon: Dumbbell,
            disabled: supportExpired,
          } satisfies PanelCard,
        ]
      : []),
    {
      title: t("panelDashboard.nutritionCards.packages.title"),
      description: t("panelDashboard.nutritionCards.packages.description"),
      href: "/panel/nutrition/packages",
      icon: Salad,
      disabled: supportExpired,
    },
    {
      title: t("panelDashboard.nutritionCards.discounts.title"),
      description: t("panelDashboard.nutritionCards.discounts.description"),
      href: "/panel/nutrition/discounts",
      icon: TicketPercent,
      disabled: supportExpired,
    },
    {
      title: t("panelDashboard.nutritionCards.templates.title"),
      description: t("panelDashboard.nutritionCards.templates.description"),
      href: "/panel/nutrition/templates",
      icon: FileText,
      disabled: supportExpired,
    },
  ];
  const filteredNutritionCards = nutritionCards.filter((item) => {
    const featureByHref: Record<string, string> = {
      "/panel/nutrition/landing": "nutrition_landing",
      "/panel/nutrition/requests": "nutrition_requests",
      "/panel/nutrition/tokens": "nutrition_tokens",
      "/panel/nutrition/settings": "nutrition_requests",
      "/panel/nutrition/exercises": "nutrition_templates",
      "/panel/nutrition/audio-guidance": "nutrition_templates",
      "/panel/nutrition/ai-prompt-presets": "nutrition_templates",
      "/panel/nutrition/diet-files": "nutrition_templates",
      "/panel/nutrition/package-orders": "nutrition_packages",
      "/panel/nutrition/packages": "nutrition_packages",
      "/panel/nutrition/discounts": "nutrition_discounts",
      "/panel/nutrition/templates": "nutrition_templates",
    };

    if (!item.href) {
      return true;
    }

    const featureKey = featureByHref[item.href];

    if (!featureKey) {
      return true;
    }

    if (item.href === "/panel/nutrition/tokens") {
      return isNutritionExpertAudience;
    }

    if (item.href === "/panel/nutrition/landing") {
      return isNutritionExpertAudience;
    }

    if (item.href === "/panel/nutrition/settings") {
      return isNutritionExpertAudience;
    }

    if (item.href === "/panel/nutrition/package-orders") {
      return isNutritionExpertAudience;
    }

    if (item.href === "/panel/nutrition/exercises") {
      return isNutritionExpertAudience;
    }

    return hasAudienceNutritionFeature(tenantMeta, featureKey);
  });
  const sortedNutritionCards = [...filteredNutritionCards].sort((a, b) => {
    const featureByHref: Record<string, string> = {
      "/panel/nutrition/landing": "nutrition_landing",
      "/panel/nutrition/requests": "nutrition_requests",
      "/panel/nutrition/tokens": "nutrition_tokens",
      "/panel/nutrition/settings": "nutrition_requests",
      "/panel/nutrition/exercises": "nutrition_templates",
      "/panel/nutrition/ai-prompt-presets": "nutrition_templates",
      "/panel/nutrition/diet-files": "nutrition_templates",
      "/panel/nutrition/package-orders": "nutrition_packages",
      "/panel/nutrition/packages": "nutrition_packages",
      "/panel/nutrition/discounts": "nutrition_discounts",
      "/panel/nutrition/templates": "nutrition_templates",
    };

    const aKey = a.href ? featureByHref[a.href] : undefined;
    const bKey = b.href ? featureByHref[b.href] : undefined;
    const aIndex = aKey ? getAudienceNutritionFeatureOrder(tenantMeta, aKey, 1000 + nutritionCards.indexOf(a)) : 1000 + nutritionCards.indexOf(a);
    const bIndex = bKey ? getAudienceNutritionFeatureOrder(tenantMeta, bKey, 1000 + nutritionCards.indexOf(b)) : 1000 + nutritionCards.indexOf(b);

    return aIndex - bIndex;
  });

  const storeModuleActive = tenantMeta?.activeFeatureModules?.some((item) => item.slug === "online-store") ?? false;
  const vipModuleActive = tenantMeta?.activeFeatureModules?.some((item) => item.slug === "vip-customers") ?? false;
  const customerClubModuleActive = tenantMeta?.activeFeatureModules?.some((item) => item.slug === "customer-club") ?? false;
  const customerFeedbackModuleActive = tenantMeta?.activeFeatureModules?.some((item) => item.slug === "customer-feedback") ?? false;
  const cookingRecipesModuleActive = tenantMeta?.activeFeatureModules?.some((item) => item.slug === "cooking-recipes") ?? false;
  const customLandingModuleActive = tenantMeta?.activeFeatureModules?.some((item) => item.slug === "custom-landing") ?? false;
  const specialCards: PanelCard[] = isPrimaryAdmin
    ? [
        {
          title: t("panelDashboard.specialCards.onlineStore.title"),
          description: storeModuleActive
            ? t("panelDashboard.specialCards.onlineStore.activeDescription")
            : t("panelDashboard.specialCards.onlineStore.inactiveDescription"),
          href: storeModuleActive ? "/panel/store-settings" : "/panel/special-features/online-store",
          icon: ShoppingCart,
          badge: storeModuleActive ? t("panelDashboard.module.purchased") : t("panelDashboard.module.needsPurchase"),
          disabled: supportExpired,
          featureKey: "online_store",
        },
        {
          title: t("panelDashboard.specialCards.vip.title"),
          description: vipModuleActive
            ? t("panelDashboard.specialCards.vip.activeDescription")
            : t("panelDashboard.specialCards.vip.inactiveDescription"),
          href: vipModuleActive ? "/panel/users" : "/panel/special-features/vip-customers",
          icon: Gem,
          badge: vipModuleActive ? t("panelDashboard.module.purchased") : t("panelDashboard.module.needsPurchase"),
          disabled: supportExpired,
          featureKey: "vip",
        },
        {
          title: t("panelDashboard.specialCards.customerClub.title"),
          description: customerClubModuleActive
            ? t("panelDashboard.specialCards.customerClub.activeDescription")
            : t("panelDashboard.specialCards.customerClub.inactiveDescription"),
          href: customerClubModuleActive ? "/panel/customer-club" : "/panel/special-features/customer-club",
          icon: Coins,
          badge: customerClubModuleActive ? t("panelDashboard.module.purchased") : t("panelDashboard.module.needsPurchase"),
          disabled: supportExpired,
          featureKey: "loyalty",
        },
        {
          title: t("panelDashboard.specialCards.customerFeedback.title"),
          description: customerFeedbackModuleActive
            ? t("panelDashboard.specialCards.customerFeedback.activeDescription")
            : t("panelDashboard.specialCards.customerFeedback.inactiveDescription"),
          href: customerFeedbackModuleActive ? "/panel/customer-feedback" : "/panel/special-features/customer-feedback",
          icon: HeartHandshake,
          badge: customerFeedbackModuleActive ? t("panelDashboard.module.purchased") : t("panelDashboard.module.needsPurchase"),
          disabled: supportExpired,
          featureKey: "feedback",
        },
        {
          title: t("panelDashboard.specialCards.onlineChat.title"),
          description: onlineChatModuleActive
            ? t("panelDashboard.specialCards.onlineChat.activeDescription")
            : t("panelDashboard.specialCards.onlineChat.inactiveDescription"),
          href: onlineChatModuleActive ? "/panel/online-chat" : "/panel/special-features/online-chat",
          icon: MessageCircleMore,
          badge: onlineChatModuleActive
            ? (onlineChatUnreadCount > 0 ? t("panelDashboard.onlineChat.newCount", { count: format.number(onlineChatUnreadCount) }) : t("panelDashboard.module.purchased"))
            : t("panelDashboard.module.needsPurchase"),
          disabled: supportExpired,
          featureKey: "online_chat",
        },
        ...(cookingRecipesModuleActive ? [{
          title: t("panelDashboard.specialCards.cookingRecipes.title"),
          description: t("panelDashboard.specialCards.cookingRecipes.description"),
          href: "/panel/cooking-recipes",
          icon: ChefHat,
          badge: t("panelDashboard.module.active"),
          disabled: supportExpired,
          featureKey: "cooking_recipes",
        }] : []),
        ...(customLandingModuleActive ? [{
          title: t("panelDashboard.specialCards.customLanding.title"),
          description: t("panelDashboard.specialCards.customLanding.description"),
          href: "/panel/custom-landing",
          icon: Link2,
          badge: t("panelDashboard.module.active"),
          disabled: supportExpired,
          featureKey: "custom_landing",
        }] : []),
      ]
    : [];

  const isSpecialModuleActive = (featureKey?: string) => {
    switch (featureKey) {
      case "online_store":
        return storeModuleActive;
      case "vip":
        return vipModuleActive;
      case "loyalty":
        return customerClubModuleActive;
      case "feedback":
        return customerFeedbackModuleActive;
      case "online_chat":
        return onlineChatModuleActive;
      case "cooking_recipes":
        return cookingRecipesModuleActive;
      case "custom_landing":
        return customLandingModuleActive;
      default:
        return false;
    }
  };

  const filteredSpecialCards = specialCards.filter((item) => {
    if (isSpecialModuleActive(item.featureKey)) {
      return true;
    }

    return hasAudienceFutureFeature(tenantMeta, item.featureKey || "");
  });
  const sortedSpecialCards = [...filteredSpecialCards].sort((a, b) => {
    return (
      getAudienceFutureFeatureOrder(tenantMeta, a.featureKey || "", 1000 + specialCards.indexOf(a)) -
      getAudienceFutureFeatureOrder(tenantMeta, b.featureKey || "", 1000 + specialCards.indexOf(b))
    );
  });

  const futureCards: PanelCard[] = [
    {
      title: t("panelDashboard.futureCards.waitingQueue.title"),
      description: t("panelDashboard.futureCards.waitingQueue.description"),
      icon: Users,
      badge: t("panelDashboard.module.comingSoon"),
      disabled: true,
      featureKey: "waiting_queue",
    },
    {
      title: t("panelDashboard.futureCards.patientIntake.title"),
      description: t("panelDashboard.futureCards.patientIntake.description"),
      icon: ClipboardPlus,
      badge: t("panelDashboard.module.comingSoon"),
      disabled: true,
      featureKey: "patient_intake",
    },
    {
      title: t("panelDashboard.futureCards.payroll.title"),
      description: t("panelDashboard.futureCards.payroll.description"),
      icon: WalletCards,
      badge: t("panelDashboard.module.comingSoon"),
      disabled: true,
      featureKey: "payroll",
    },
    {
      title: t("panelDashboard.futureCards.doctorCommission.title"),
      description: t("panelDashboard.futureCards.doctorCommission.description"),
      icon: Stethoscope,
      badge: t("panelDashboard.module.comingSoon"),
      disabled: true,
      featureKey: "doctor_commission",
    },
    {
      title: t("panelDashboard.futureCards.whatsapp.title"),
      description: t("panelDashboard.futureCards.whatsapp.description"),
      icon: MessageCircleMore,
      badge: t("panelDashboard.module.comingSoon"),
      disabled: true,
      featureKey: "whatsapp",
    },
    {
      title: t("panelDashboard.futureCards.phoneBooking.title"),
      description: t("panelDashboard.futureCards.phoneBooking.description"),
      icon: MonitorSmartphone,
      badge: t("panelDashboard.module.comingSoon"),
      disabled: true,
      featureKey: "phone_booking",
    },
    {
      title: t("panelDashboard.futureCards.backup.title"),
      description: t("panelDashboard.futureCards.backup.description"),
      icon: DatabaseBackup,
      badge: t("panelDashboard.module.comingSoon"),
      disabled: true,
      featureKey: "backup",
    },
    {
      title: t("panelDashboard.futureCards.partnerStore.title"),
      description: t("panelDashboard.futureCards.partnerStore.description"),
      icon: ShoppingBag,
      badge: t("panelDashboard.module.comingSoon"),
      disabled: true,
      featureKey: "partner_store",
    },
  ];
  const filteredFutureCards = futureCards.filter((item) => {
    return hasAudienceFutureFeature(tenantMeta, item.featureKey || "");
  });
  const sortedFutureCards = [...filteredFutureCards].sort((a, b) => {
    return (
      getAudienceFutureFeatureOrder(tenantMeta, a.featureKey || "", 1000 + futureCards.indexOf(a)) -
      getAudienceFutureFeatureOrder(tenantMeta, b.featureKey || "", 1000 + futureCards.indexOf(b))
    );
  });
  const nutritionTokenBalance = nutritionTokenDashboard?.stats.currentTokens ?? null;
  const nutritionTokenAlertLevel =
    isPrimaryAdmin && isNutritionExpertAudience && nutritionTokenBalance !== null && nutritionTokenBalance <= 500
      ? "critical"
      : isPrimaryAdmin && isNutritionExpertAudience && nutritionTokenBalance !== null && nutritionTokenBalance < 5000
        ? "warning"
        : null;

  if (supportExpired) {
    return <SupportExpiredLock businessLabel={labels.business} isAdmin={isAdmin} />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-20" dir={dir}>
      <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-foreground">{t("panelDashboard.title")}</h1>
            <p className="text-sm text-muted-foreground">
              {t("panelDashboard.description")}
            </p>
          </div>
          <Link href="/">
            <Button
              variant="outline"
              size="icon"
              title={t("common.back")}
              className="h-10 w-10 rounded-2xl border-border bg-background/40 hover:bg-background/70"
            >
              <ArrowRight className={`w-5 h-5 ${isRtl ? "rotate-180" : ""}`} />
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-5xl space-y-6 px-4 py-6">
        {isPrimaryAdmin && generalSettings !== null && (generalSettings.smsStats?.creditBalance ?? 0) <= 0 && (
          <Card className="border-destructive/30 bg-destructive/10">
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
                <div className="space-y-1">
                  <div className="text-base font-bold text-destructive">{t("panelDashboard.smsCredit.emptyTitle")}</div>
                  <p className="text-sm leading-7 text-foreground/80">
                    {t("panelDashboard.smsCredit.emptyDescription")}
                  </p>
                </div>
              </div>
              <Link href="/panel/sms-settings/top-up">
                <Button variant="destructive">{t("panelDashboard.smsCredit.topUp")}</Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {nutritionTokenAlertLevel && nutritionTokenBalance !== null ? (
          <Card className={nutritionTokenAlertLevel === "critical" ? "border-destructive/30 bg-destructive/10" : "border-amber-500/30 bg-amber-500/5"}>
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <AlertTriangle className={`mt-0.5 h-5 w-5 ${nutritionTokenAlertLevel === "critical" ? "text-destructive" : "text-amber-500"}`} />
                <div className="space-y-1">
                  <div className={`text-base font-bold ${nutritionTokenAlertLevel === "critical" ? "text-destructive" : "text-amber-500"}`}>
                    {nutritionTokenAlertLevel === "critical" ? t("panelDashboard.nutritionToken.criticalTitle") : t("panelDashboard.nutritionToken.warningTitle")}
                  </div>
                  <p className="text-sm leading-7 text-foreground/80">
                    {t(nutritionTokenAlertLevel === "critical" ? "panelDashboard.nutritionToken.criticalDescription" : "panelDashboard.nutritionToken.warningDescription", {
                      count: format.number(nutritionTokenBalance),
                    })}
                  </p>
                </div>
              </div>
              <Link href="/panel/nutrition/tokens/top-up">
                <Button variant={nutritionTokenAlertLevel === "critical" ? "destructive" : "outline"}>
                  {t("panelDashboard.nutritionToken.topUp")}
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : null}

        {isPrimaryAdmin && isNutritionExpertAudience && nutritionTokenDashboard ? (
          <Card className="border-border/70 bg-card/60">
            <CardHeader>
              <CardTitle>{t("panelDashboard.nutritionStats.title")}</CardTitle>
              <CardDescription>{t("panelDashboard.nutritionStats.description")}</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <div className="flex min-h-36 flex-col rounded-2xl border border-border/70 bg-background/40 p-4">
                <div className="text-sm text-muted-foreground">{t("panelDashboard.nutritionStats.newDiets")}</div>
                <div className="mt-2 text-center text-2xl font-black">{format.number(nutritionRequestStats?.notGeneratedAi ?? 0)}</div>
                <div className="mt-auto pt-4">
                  <Link href="/panel/nutrition/requests?quick_filter=not_generated">
                    <Button variant="outline" className={nutritionStatsActionClass}>{t("panelDashboard.nutritionStats.view")}</Button>
                  </Link>
                </div>
              </div>
              <div className="flex min-h-36 flex-col rounded-2xl border border-border/70 bg-background/40 p-4">
                <div className="text-sm text-muted-foreground">{t("panelDashboard.nutritionStats.pendingApproval")}</div>
                <div className="mt-2 text-center text-2xl font-black">{format.number(nutritionRequestStats?.pendingManualApprovals ?? 0)}</div>
                <div className="mt-auto pt-4">
                  <Link href="/panel/nutrition/requests?quick_filter=pending_approval">
                    <Button variant="outline" className={nutritionStatsActionClass}>{t("panelDashboard.nutritionStats.view")}</Button>
                  </Link>
                </div>
              </div>
              <div className="flex min-h-36 flex-col rounded-2xl border border-border/70 bg-background/40 p-4">
                <div className="text-sm text-muted-foreground">{t("panelDashboard.nutritionStats.offlineDiets")}</div>
                <div className="mt-2 text-center text-2xl font-black">{format.number(nutritionRequestStats?.expertManualDelivery ?? 0)}</div>
                <div className="mt-auto pt-4">
                  <Link href="/panel/nutrition/requests?quick_filter=expert_manual_delivery">
                    <Button variant="outline" className={nutritionStatsActionClass}>{t("panelDashboard.nutritionStats.view")}</Button>
                  </Link>
                </div>
              </div>
              <div className={`flex min-h-36 flex-col rounded-2xl border p-4 ${
                nutritionTokenAlertLevel === "critical"
                  ? "border-destructive/30 bg-destructive/10"
                  : nutritionTokenAlertLevel === "warning"
                    ? "border-amber-500/30 bg-amber-500/10"
                    : "border-teal-500/20 bg-teal-500/10"
              }`}>
                <div className="text-sm text-muted-foreground">{t("panelDashboard.nutritionStats.currentTokens")}</div>
                <div className={`mt-2 text-2xl font-black ${
                  nutritionTokenAlertLevel === "critical"
                    ? "text-destructive"
                    : nutritionTokenAlertLevel === "warning"
                      ? "text-amber-300"
                      : ""
                }`}>{t("panelDashboard.nutritionStats.tokenValue", { count: format.number(nutritionTokenDashboard.stats.currentTokens) })}</div>
                {nutritionTokenAlertLevel ? (
                  <div className="mt-2 text-xs leading-6 text-foreground/75">
                    {nutritionTokenAlertLevel === "critical" ? t("panelDashboard.nutritionToken.urgentCharge") : t("panelDashboard.nutritionToken.lowBalance")}
                  </div>
                ) : null}
                <div className="mt-auto pt-4">
                  <Link href="/panel/nutrition/tokens/top-up">
                    <Button className={`w-full rounded-2xl ${
                      nutritionTokenAlertLevel === "critical"
                        ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        : nutritionTokenAlertLevel === "warning"
                          ? "bg-amber-500 text-slate-950 hover:bg-amber-400"
                          : "bg-teal-600 hover:bg-teal-500"
                    }`}>{t("panelDashboard.nutritionToken.buy")}</Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {isAdmin && irDomain?.enabled && (irDomain.expired || irDomain.isDueSoon) && (
          <Card className={irDomain.expired ? "border-destructive/30 bg-destructive/10" : "border-amber-500/30 bg-amber-500/5"}>
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <AlertTriangle className={`mt-0.5 h-5 w-5 ${irDomain.expired ? "text-destructive" : "text-amber-500"}`} />
                <div className="space-y-1">
                  <div className={`text-base font-bold ${irDomain.expired ? "text-destructive" : "text-amber-500"}`}>
                    {t(irDomain.expired ? "panelDashboard.domain.expiredTitle" : "panelDashboard.domain.dueSoonTitle", {
                      label: irDomainLabel,
                    })}
                  </div>
                  <p className="text-sm leading-7 text-foreground/80">
                    {irDomain.expired
                      ? t("panelDashboard.domain.expiredDescription")
                      : t("panelDashboard.domain.dueSoonDescription", {
                        count: format.number(Number(irDomain.daysRemaining ?? 0)),
                        tld: irDomain.tld || t("panelDashboard.domain.defaultLabel"),
                      })}
                  </p>
                </div>
              </div>
              <Link href="/panel/domain-renewal">
                <Button variant={irDomain.expired ? "destructive" : "outline"}>{t("panelDashboard.domain.viewStatus")}</Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {isAdmin && onlineChatModuleActive && onlineChatUnreadCount > 0 && (
          <Card className="border-amber-500/30 bg-[linear-gradient(180deg,rgba(245,158,11,0.12),rgba(245,158,11,0.04))]">
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-300">
                  <MessageCircleMore className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-base font-bold text-amber-200">
                      {t("panelDashboard.onlineChat.title", { count: format.number(onlineChatUnreadCount) })}
                    </div>
                    <Badge className="border-amber-400/30 bg-amber-400/10 text-amber-100 hover:bg-amber-400/10">
                      {t("panelDashboard.onlineChat.badge")}
                    </Badge>
                  </div>
                  <p className="text-sm leading-7 text-foreground/80">
                    {latestUnreadConversation?.customer?.name
                      ? t("panelDashboard.onlineChat.latestDescription", { name: latestUnreadConversation.customer.name })
                      : t("panelDashboard.onlineChat.description")}
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Link href="/panel/online-chat">
                  <Button className="w-full bg-amber-500 text-slate-950 hover:bg-amber-400 sm:w-auto">
                    {t("panelDashboard.onlineChat.open")}
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {isAdmin && (
          <Card className={`border-border/70 ${supportExpired ? "border-destructive/40 bg-destructive/5" : "bg-card/50"}`}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle className="text-base">{t("panelDashboard.support.title")}</CardTitle>
                  <CardDescription className="leading-7">
                    {t("panelDashboard.support.description")}
                  </CardDescription>
                </div>
                <Badge variant={supportExpired ? "destructive" : "secondary"}>
                  {supportExpired ? t("panelDashboard.support.expired") : t("panelDashboard.support.active")}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <div className="rounded-2xl border border-border/70 bg-background/40 p-3 sm:p-4">
                  <div className="text-sm text-muted-foreground">{t("panelDashboard.support.title")}</div>
                  <div className="mt-3 space-y-3 sm:mt-4 sm:space-y-4">
                    <div>
                      <div className="text-xs text-muted-foreground">{t("panelDashboard.support.endsAt")}</div>
                      <div className="mt-1 text-center text-base font-black text-foreground sm:text-lg">{supportEndLabel}</div>
                    </div>
                    <div className="border-t border-border/60 pt-3 sm:pt-4">
                      <div className="text-xs text-muted-foreground">{t("panelDashboard.support.daysRemaining")}</div>
                      <div className={`mt-1 text-center text-base font-black sm:text-lg ${supportExpired ? "text-destructive" : "text-primary"}`}>
                        {t("panelDashboard.support.daysRemainingValue", { count: format.number(tenantMeta?.supportDaysRemaining ?? 0) })}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/40 p-3 sm:p-4">
                  <div className="flex h-full flex-col">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm text-muted-foreground">{t("panelDashboard.storage.title")}</div>
                      <HardDrive className="h-4 w-4 text-primary" />
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2 sm:mt-4 sm:gap-3">
                      <div className="space-y-1">
                        <div className="text-base font-black text-foreground sm:text-lg">{formatStorageBytes(storageUsedBytes)}</div>
                        <div className="text-xs text-muted-foreground">{t("panelFiles.storage.fromTotal", { total: formatStorageBytes(storageTotalBytes) })}</div>
                      </div>
                      <div className="relative h-16 w-16 shrink-0 sm:h-20 sm:w-20">
                        <svg className="h-16 w-16 -rotate-90 sm:h-20 sm:w-20" viewBox="0 0 88 88" aria-hidden="true">
                          <circle
                            cx="44"
                            cy="44"
                            r={storageRingRadius}
                            className="fill-none stroke-border/80"
                            strokeWidth="8"
                          />
                          <circle
                            cx="44"
                            cy="44"
                            r={storageRingRadius}
                            className={`fill-none transition-all duration-500 ${storageRingColor}`}
                            strokeWidth="8"
                            strokeLinecap="round"
                            strokeDasharray={storageRingCircumference}
                            strokeDashoffset={storageRingOffset}
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <div className="text-xs font-black text-foreground sm:text-sm">
                            {format.percent(storagePercent / 100)}
                          </div>
                          <div className="text-[9px] font-medium text-muted-foreground sm:text-[10px]">{t("panelFiles.storage.usedPercent")}</div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-auto pt-3 sm:pt-4">
                      <Link href="/panel/files/upgrade">
                        <Button size="sm" className={`h-9 w-full rounded-2xl text-xs sm:text-sm ${storageWarningLevel === "full" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : storageWarningLevel === "critical" ? "bg-amber-500 text-slate-950 hover:bg-amber-400" : "panel-support-action"}`}>
                          {t("panelDashboard.storage.upgrade")}
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
                <div className="flex rounded-2xl border border-border/70 bg-background/40 p-3 flex-col sm:p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm text-muted-foreground">{t("panelDashboard.smsCredit.title")}</div>
                    <Coins className="h-4 w-4 text-primary" />
                  </div>
                  {generalSettings === null ? (
                    <div className="mt-3 space-y-2">
                      <div className="h-6 w-28 animate-pulse rounded-lg bg-primary/15" />
                      <div className="text-xs text-muted-foreground">{t("panelDashboard.smsCredit.loading")}</div>
                    </div>
                  ) : (
                    <div className="mt-4 text-center text-base font-bold text-foreground sm:text-lg">
                      {format.currency(generalSettings.smsStats?.creditBalance ?? 0)}
                    </div>
                  )}
                  <div className="mt-auto pt-3 sm:pt-4">
                    {storageFull ? (
                      <Button className="w-full rounded-2xl text-xs sm:text-sm" disabled>
                        {t("panelDashboard.smsCredit.increase")}
                      </Button>
                    ) : (
                      <Link href="/panel/sms-settings/top-up">
                        <Button className="panel-support-action w-full rounded-2xl text-xs sm:text-sm">
                          {t("panelDashboard.smsCredit.increase")}
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
                <div className="flex rounded-2xl border border-border/70 bg-background/40 p-3 flex-col sm:p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm text-muted-foreground">{t("panelDashboard.smsToday.title")}</div>
                    <MessageCircleMore className="h-4 w-4 text-primary" />
                  </div>
                  {generalSettings === null ? (
                    <div className="mt-3 space-y-2">
                      <div className="h-6 w-16 animate-pulse rounded-lg bg-primary/15" />
                      <div className="text-xs text-muted-foreground">{t("panelDashboard.smsToday.loading")}</div>
                    </div>
                  ) : (
                    <div className="mt-4 text-center text-2xl font-black text-foreground">
                      {format.number(generalSettings.smsStats?.sentToday ?? 0)}
                    </div>
                  )}
                  <div className="mt-auto pt-3 sm:pt-4">
                    {storageFull ? (
                      <Button className="h-10 w-full rounded-2xl text-xs font-black sm:h-11 sm:text-sm" variant="outline" disabled>
                        {t("panelDashboard.smsToday.inbox")}
                      </Button>
                    ) : (
                      <Link href="/panel/sms-settings/outbounds">
                        <Button className="panel-support-action-outline h-10 w-full rounded-2xl border text-xs font-black sm:h-11 sm:text-sm" variant="outline">
                          {t("panelDashboard.smsToday.inbox")}
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              </div>
              {storageFull ? (
                <Button className="w-full sm:w-auto" disabled>
                  {t("panelDashboard.support.renew")}
                </Button>
              ) : (
                <Link href="/panel/support-renewal">
                  <Button className="panel-support-action w-full sm:w-auto">
                    {t("panelDashboard.support.renew")}
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        )}

        {isAdmin && storageWarningLevel !== "ok" ? (
          <Card className={storageWarningLevel === "warning" ? "border-amber-500/30 bg-amber-500/5" : "border-destructive/30 bg-destructive/10"}>
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <AlertTriangle className={`mt-0.5 h-5 w-5 ${storageWarningLevel === "warning" ? "text-amber-500" : "text-destructive"}`} />
                <div className="space-y-1">
                  <div className={`text-base font-bold ${storageWarningLevel === "warning" ? "text-amber-500" : "text-destructive"}`}>
                    {storageFull
                      ? t("panelDashboard.storage.fullTitle")
                      : storageWarningLevel === "critical"
                        ? t("panelDashboard.storage.criticalTitle")
                        : t("panelDashboard.storage.warningTitle")}
                  </div>
                  <p className="text-sm leading-7 text-foreground/80">
                    {storageFull
                      ? t("panelDashboard.storage.fullDescription", {
                        used: formatStorageBytes(storageUsedBytes),
                        total: formatStorageBytes(storageTotalBytes),
                      })
                      : t("panelDashboard.storage.warningDescription", {
                        used: formatStorageBytes(storageUsedBytes),
                        total: formatStorageBytes(storageTotalBytes),
                        remaining: formatStorageBytes(storageRemainingBytes),
                      })}
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Link href="/panel/files">
                  <Button variant="outline" className="w-full sm:w-auto">{t("panelDashboard.storage.manageFiles")}</Button>
                </Link>
                <Link href="/panel/files/upgrade">
                  <Button className="w-full sm:w-auto">{t("panelDashboard.storage.buyMore")}</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Card className="border-border/70 bg-card/50">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-primary">{format.number(barbers.length)}</div>
              <div className="mt-1 text-sm text-muted-foreground">{labels.singular}</div>
            </CardContent>
          </Card>
          <Card className="border-border/70 bg-card/50">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-primary">{format.number(sections.length)}</div>
              <div className="mt-1 text-sm text-muted-foreground">{t("panelDashboard.summary.activeSections")}</div>
            </CardContent>
          </Card>
          <Card className="border-border/70 bg-card/50 col-span-2">
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground leading-7">
                {generalSettings?.managementPanelNote?.trim() || t("panelDashboard.summary.mobileNote", { business: labels.business })}
              </div>
            </CardContent>
          </Card>
        </section>

        {sortedNutritionCards.length > 0 ? (
          <section className="space-y-3">
            <div className="space-y-1">
              <h2 className="text-lg font-bold">{t("panelDashboard.sections.nutrition.title")}</h2>
              <p className="text-sm text-muted-foreground">{t("panelDashboard.sections.nutrition.description")}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {sortedNutritionCards.map((item) => {
                const Icon = item.icon;
                const isDisabled = item.disabled || (storageFull && !isStorageAllowedHref(item.href));

                const content = (
                  <Card className={`relative h-full border-border/70 bg-card/60 transition-all ${isDisabled ? "opacity-60" : "cursor-pointer hover:border-primary/40 hover:bg-card/80"}`}>
                    <CardHeader className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex items-center gap-2">
                          {item.badge ? <Badge variant="secondary">{item.badge}</Badge> : null}
                          {isDisabled ? <Lock className="h-4 w-4 text-muted-foreground" /> : <ArrowRight className={`h-4 w-4 text-muted-foreground ${isRtl ? "rotate-180" : ""}`} />}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <CardTitle className="text-base">{item.title}</CardTitle>
                        <CardDescription className="leading-7">{item.description}</CardDescription>
                      </div>
                    </CardHeader>
                  </Card>
                );

                if (isDisabled) {
                  return <div key={item.title}>{content}</div>;
                }

                return (
                  <Link key={item.title} href={item.href!}>
                    {content}
                  </Link>
                );
              })}
            </div>
          </section>
        ) : null}

        <section className="space-y-3">
          <div className="space-y-1">
            <h2 className="text-lg font-bold">{t("panelDashboard.sections.main.title")}</h2>
            <p className="text-sm text-muted-foreground">{t("panelDashboard.sections.main.description")}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {sortedManagementCards.map((item) => {
              const Icon = item.icon;
              const isDisabled = item.disabled || (storageFull && !isStorageAllowedHref(item.href));

              const content = (
                  <Card className={`relative h-full border-border/70 bg-card/60 transition-all ${isDisabled ? "opacity-60" : "cursor-pointer hover:border-primary/40 hover:bg-card/80"}`}>
                    <CardHeader className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex items-center gap-2">
                          {item.badge ? <Badge variant="secondary">{item.badge}</Badge> : null}
                          {isDisabled ? <Lock className="h-4 w-4 text-muted-foreground" /> : <ArrowRight className={`h-4 w-4 text-muted-foreground ${isRtl ? "rotate-180" : ""}`} />}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <CardTitle className="text-base">{item.title}</CardTitle>
                        <CardDescription className="leading-7">{item.description}</CardDescription>
                      </div>
                    </CardHeader>
                  </Card>
              );

              if (isDisabled) {
                return <div key={item.title}>{content}</div>;
              }

              return (
                <Link key={item.title} href={item.href!}>
                  {content}
                </Link>
              );
            })}
          </div>
        </section>

        {sortedSpecialCards.length > 0 ? (
          <section className="space-y-3">
            <div className="space-y-1">
              <h2 className="text-lg font-bold">{t("panelDashboard.sections.special.title")}</h2>
              <p className="text-sm text-muted-foreground">{t("panelDashboard.sections.special.description")}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {sortedSpecialCards.map((item) => {
                const Icon = item.icon;
                const isDisabled = item.disabled || storageFull;
                const isPurchased = isSpecialModuleActive(item.featureKey);

                const content = (
                    <Card className={`relative h-full border-primary/20 bg-card/60 transition-all ${isDisabled ? "opacity-60" : "cursor-pointer hover:border-primary/40 hover:bg-card/80"}`}>
                      <CardHeader className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="flex items-center gap-2">
                            {item.badge ? (
                              <Badge
                                variant="secondary"
                                className={isPurchased ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : undefined}
                              >
                                {item.badge}
                              </Badge>
                            ) : null}
                            {isPurchased ? (
                              <LockOpen className="h-4 w-4 text-emerald-300" />
                            ) : (
                              <Lock className="h-4 w-4 text-primary" />
                            )}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <CardTitle className="text-base">{item.title}</CardTitle>
                          <CardDescription className="leading-7">{item.description}</CardDescription>
                        </div>
                      </CardHeader>
                    </Card>
                );

                if (isDisabled) {
                  return <div key={item.title}>{content}</div>;
                }

                return (
                  <Link key={item.title} href={item.href!}>
                    {content}
                  </Link>
                );
              })}
            </div>
          </section>
        ) : null}

        <section className="space-y-3">
          <div className="space-y-1">
            <h2 className="text-lg font-bold">{t("panelDashboard.sections.future.title")}</h2>
            <p className="text-sm text-muted-foreground">{t("panelDashboard.sections.future.description")}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {sortedFutureCards.map((item) => {
              const Icon = item.icon;

              return (
                <Card key={item.title} className="border-dashed border-border/70 bg-card/30 opacity-80">
                  <CardHeader className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                        <Icon className="h-5 w-5" />
                      </div>
                      {item.badge && <Badge variant="secondary">{item.badge}</Badge>}
                    </div>
                    <div className="space-y-1">
                      <CardTitle className="text-base">{item.title}</CardTitle>
                      <CardDescription className="leading-7">{item.description}</CardDescription>
                    </div>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        </section>

        <Dialog open={isAdmin && storageFull} onOpenChange={() => undefined}>
          <DialogContent
            className="max-w-md border-destructive/40 bg-card p-0 text-start shadow-2xl [&>button]:hidden"
            onEscapeKeyDown={(event) => event.preventDefault()}
            onPointerDownOutside={(event) => event.preventDefault()}
            onInteractOutside={(event) => event.preventDefault()}
            dir={dir}
          >
            <div className="space-y-5 p-6">
              <DialogHeader className="space-y-3">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-destructive/30 bg-destructive/10 text-destructive sm:mx-0">
                  <HardDrive className="h-7 w-7" />
                </div>
                <DialogTitle className="text-xl font-black">{t("panelDashboard.storage.dialogTitle")}</DialogTitle>
                <DialogDescription className="leading-7">
                  {t("panelDashboard.storage.dialogDescription")}
                </DialogDescription>
              </DialogHeader>

              <div className="rounded-2xl border border-destructive/25 bg-destructive/10 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">{t("panelFiles.storage.used")}</div>
                    <div className="mt-1 text-lg font-black">{formatStorageBytes(storageUsedBytes)}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{t("panelFiles.storage.fromTotal", { total: formatStorageBytes(storageTotalBytes) })}</div>
                  </div>
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-[8px] border-destructive/70 bg-background/50">
                    <div className="text-center">
                      <div className="text-sm font-black">{format.percent(storagePercent / 100)}</div>
                      <div className="text-[10px] text-muted-foreground">{t("panelFiles.storage.usedPercent")}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Link href="/panel/files">
                  <Button variant="outline" className="h-11 w-full rounded-2xl">
                    {t("panelDashboard.storage.manageFiles")}
                  </Button>
                </Link>
                <Link href="/panel/files/upgrade">
                  <Button className="h-11 w-full rounded-2xl bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    {t("panelDashboard.storage.buyMore")}
                  </Button>
                </Link>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
