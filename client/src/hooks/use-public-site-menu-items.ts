import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, BookOpenText, Coins, HeartPulse, Images, Info, MessageCircleMore, PhoneCall, ShoppingCart } from "lucide-react";
import { api } from "@/lib/api";
import { isAppointmentBookingDisabled } from "@/lib/audience";
import { getInitialTenantMeta } from "@/lib/bootstrap";
import type { TenantMeta } from "@/lib/types";
import { useT } from "@/i18n/locale";
import { translate, type MessageKey } from "@/i18n/messages";

export type PublicSiteMenuItem = {
  key: string;
  title: string;
  icon: LucideIcon;
  href: string;
  description?: string;
  badge?: number | null;
};

type BuildPublicSiteMenuItemsInput = {
  tenantMeta: TenantMeta | null;
  t?: (key: MessageKey) => string;
  aboutEnabled?: boolean;
  contactEnabled?: boolean;
  includeBooking?: boolean;
  includeNutrition?: boolean;
  onlineChatUnreadCount?: number;
  showCustomerClub?: boolean;
};

export function buildPublicSiteMenuItems({
  tenantMeta,
  t = (key) => translate("fa", key),
  aboutEnabled = false,
  contactEnabled = false,
  includeBooking = false,
  includeNutrition = true,
  onlineChatUnreadCount = 0,
  showCustomerClub = false,
}: BuildPublicSiteMenuItemsInput): PublicSiteMenuItem[] {
  const appointmentBookingDisabled = isAppointmentBookingDisabled(tenantMeta);
  const activeFeatureModules = tenantMeta?.activeFeatureModules ?? [];
  const isNutritionAudience = ["nutritionists", "nutrition-doctors"].includes(tenantMeta?.audience?.slug || "");
  const storeModuleActive = activeFeatureModules.some((item) => item.slug === "online-store");
  const customerClubModuleActive = activeFeatureModules.some((item) => item.slug === "customer-club");
  const customerClubActive = tenantMeta?.customerClubSettings?.isPublicActive ?? customerClubModuleActive;
  const onlineChatModuleActive =
    tenantMeta?.onlineChatSettings?.moduleActive ??
    activeFeatureModules.some((item) => item.slug === "online-chat");
  const articlesSettings = tenantMeta?.articlesSettings ?? { enabled: false, showInMenu: false };
  const onlineChatSettings = tenantMeta?.onlineChatSettings ?? {
    moduleActive: onlineChatModuleActive,
    showOnBookingPage: onlineChatModuleActive,
    showInMenu: false,
  };

  return [
    includeBooking && !appointmentBookingDisabled
      ? { key: "booking", title: t("publicMenu.booking.title"), icon: ArrowLeft, href: "/booking", description: t("publicMenu.booking.description") }
      : null,
    includeNutrition && isNutritionAudience
      ? { key: "nutrition", title: t("publicMenu.nutrition.title"), icon: HeartPulse, href: "/nutrition", description: t("publicMenu.nutrition.description") }
      : null,
    storeModuleActive && tenantMeta?.storeEnabled !== false
      ? { key: "store", title: t("publicMenu.store.title"), icon: ShoppingCart, href: "/store", description: t("publicMenu.store.description") }
      : null,
    tenantMeta?.galleryEnabled === true
      ? { key: "gallery", title: t("publicMenu.gallery.title"), icon: Images, href: "/gallery", description: t("publicMenu.gallery.description") }
      : null,
    aboutEnabled
      ? { key: "about", title: t("publicMenu.about.title"), icon: Info, href: "/about", description: t("publicMenu.about.description") }
      : null,
    contactEnabled || tenantMeta?.contactEnabled === true
      ? { key: "contact", title: t("publicMenu.contact.title"), icon: PhoneCall, href: "/contact", description: t("publicMenu.contact.description") }
      : null,
    articlesSettings.enabled && articlesSettings.showInMenu
      ? { key: "articles", title: t("publicMenu.articles.title"), icon: BookOpenText, href: "/articles", description: t("publicMenu.articles.description") }
      : null,
    showCustomerClub && customerClubActive
      ? { key: "customer-club", title: t("publicMenu.customerClub.title"), icon: Coins, href: "/club", description: t("publicMenu.customerClub.description") }
      : null,
    onlineChatModuleActive && onlineChatSettings.showInMenu
      ? {
          key: "online-chat",
          title: t("publicMenu.onlineChat.title"),
          icon: MessageCircleMore,
          href: "/support/chat",
          description: t("publicMenu.onlineChat.description"),
          badge: onlineChatUnreadCount > 0 ? onlineChatUnreadCount : null,
        }
      : null,
  ].filter(Boolean) as PublicSiteMenuItem[];
}

type UsePublicSiteMenuItemsOptions = {
  includeBooking?: boolean;
  includeNutrition?: boolean;
  onlineChatUnreadCount?: number;
  showCustomerClub?: boolean;
};

export function usePublicSiteMenuItems({
  includeBooking = false,
  includeNutrition = true,
  onlineChatUnreadCount = 0,
  showCustomerClub = false,
}: UsePublicSiteMenuItemsOptions = {}) {
  const t = useT();
  const [tenantMeta, setTenantMeta] = useState<TenantMeta | null>(() => getInitialTenantMeta());
  const [aboutEnabled, setAboutEnabled] = useState(false);
  const [contactEnabled, setContactEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;

    Promise.all([api.meta.get(), api.about.get(), api.contact.get()]).then(([metaRes, aboutRes, contactRes]) => {
      if (cancelled) {
        return;
      }

      if (metaRes.success) {
        setTenantMeta(metaRes.data);
      }

      if (aboutRes.success) {
        setAboutEnabled(aboutRes.data.enabled === true);
      }

      if (contactRes.success) {
        setContactEnabled(contactRes.data.enabled === true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const publicMenuItems = useMemo(
    () =>
      buildPublicSiteMenuItems({
        tenantMeta,
        t,
        aboutEnabled,
        contactEnabled,
        includeBooking,
        includeNutrition,
        onlineChatUnreadCount,
        showCustomerClub,
      }),
    [aboutEnabled, contactEnabled, includeBooking, includeNutrition, onlineChatUnreadCount, showCustomerClub, t, tenantMeta],
  );

  return {
    tenantMeta,
    aboutEnabled,
    contactEnabled,
    publicMenuItems,
  };
}
