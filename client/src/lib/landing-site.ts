import { getInitialTenantMeta } from "./bootstrap";
import { translate, type MessageKey } from "@/i18n/messages";
import { DEFAULT_LOCALE, normalizeLocale } from "@/i18n/registry";

export type LandingMenuKey = "home" | "about" | "features" | "plans" | "faq" | "contact" | "orders";

export type LandingMenuItem = {
  key: LandingMenuKey;
  label: string;
  href: string;
  enabled: boolean;
};

type DefaultLandingMenuItem = Omit<LandingMenuItem, "label"> & {
  labelKey: MessageKey;
};

const currentLandingLocale = () => {
  const meta = getInitialTenantMeta();

  return (
    normalizeLocale(meta?.locale) ||
    normalizeLocale(document.documentElement.lang) ||
    normalizeLocale(window.localStorage.getItem("barberbook.locale")) ||
    DEFAULT_LOCALE
  );
};

const landingText = (key: MessageKey) => translate(currentLandingLocale(), key);

export function getLandingPath(path = ""): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const meta = getInitialTenantMeta();

  if (meta?.isLandingDomain) {
    return normalizedPath === "/" ? "/" : normalizedPath;
  }

  return normalizedPath === "/" ? "/landing-preview" : `/landing-preview${normalizedPath}`;
}

const defaultMenuItems: DefaultLandingMenuItem[] = [
  { key: "home", labelKey: "landing.menu.home", href: getLandingPath("/"), enabled: true },
  { key: "about", labelKey: "landing.menu.about", href: getLandingPath("/about"), enabled: true },
  { key: "features", labelKey: "landing.menu.features", href: getLandingPath("/features"), enabled: true },
  { key: "plans", labelKey: "landing.menu.plans", href: getLandingPath("/plans"), enabled: true },
  { key: "faq", labelKey: "landing.menu.faq", href: getLandingPath("/faq"), enabled: true },
  { key: "contact", labelKey: "landing.menu.contact", href: getLandingPath("/contact"), enabled: true },
  { key: "orders", labelKey: "landing.menu.orders", href: getLandingPath("/orders"), enabled: true },
];

const getDefaultMenuLabel = (key: LandingMenuKey) => {
  const item = defaultMenuItems.find((menuItem) => menuItem.key === key);
  return item ? landingText(item.labelKey) : key;
};

export function getLandingSiteSettings() {
  const meta = getInitialTenantMeta();
  const settings = (meta?.landingSiteSettings ?? {}) as Record<string, unknown>;

  return {
    siteTitle: typeof settings.siteTitle === "string" && settings.siteTitle.trim() !== "" ? settings.siteTitle : (meta?.name ?? landingText("landing.defaultSiteTitle")),
    headerLabel: typeof settings.headerLabel === "string" && settings.headerLabel.trim() !== "" ? settings.headerLabel : "Landing",
    logoUrl: typeof settings.logoUrl === "string" && settings.logoUrl.trim() !== "" ? settings.logoUrl : "/icon-192.png",
    faviconUrl: typeof settings.faviconUrl === "string" && settings.faviconUrl.trim() !== "" ? settings.faviconUrl : "/booking-app/favicon.png",
    contactPhones: Array.isArray(settings.contactPhones)
      ? settings.contactPhones.filter((item): item is string => typeof item === "string" && item.trim() !== "")
      : ["0912-000-0000", "0935-000-0000", "021-0000-0000"],
    rawMenuItems: Array.isArray(settings.menuItems) ? settings.menuItems : [],
  };
}

export function getLandingHeaderMenuItems(): LandingMenuItem[] {
  const settings = getLandingSiteSettings();
  const configured = new Map<string, { label: string; enabled: boolean }>();

  settings.rawMenuItems.forEach((item) => {
    if (!item || typeof item !== "object") return;
    const record = item as Record<string, unknown>;
    const key = typeof record.key === "string" ? record.key : "";
    if (!key) return;

    configured.set(key, {
      label: typeof record.label === "string" && record.label.trim() !== "" ? record.label : getDefaultMenuLabel(key as LandingMenuKey),
      enabled: Boolean(record.enabled),
    });
  });

  return defaultMenuItems
    .map((item) => {
      const override = configured.get(item.key);
      return {
        key: item.key,
        href: item.href,
        label: override?.label ?? landingText(item.labelKey),
        enabled: override?.enabled ?? item.enabled,
      };
    })
    .filter((item) => item.enabled);
}
