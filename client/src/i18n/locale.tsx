import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { getInitialTenantMeta } from "@/lib/bootstrap";
import type { TenantMeta } from "@/lib/types";
import { formatCurrency, formatDate, formatDateTime, formatNumber, formatPercent, formatRelativeTime, formatTime, type LocaleFormatContext } from "./format";
import { areMessagesLoaded, loadMessages, translate, type MessageKey } from "./messages";
import {
  DEFAULT_COUNTRY,
  DEFAULT_LOCALE,
  LOCALE_DEFINITIONS,
  SELECTABLE_COUNTRIES,
  SELECTABLE_LOCALES,
  normalizeLocale,
  type AppCalendar,
  type AppDirection,
  type AppLocale,
} from "./registry";

declare global {
  interface Window {
    __BOOKING_APPLY_SHELL_LOCALE__?: () => void;
  }
}

type LocaleContextValue = {
  locale: AppLocale;
  fallbackLocale: AppLocale;
  supportedLocales: AppLocale[];
  country: string;
  defaultCountry: string;
  supportedCountries: string[];
  dir: AppDirection;
  isRtl: boolean;
  htmlLang: string;
  dateLocale: string;
  calendar: AppCalendar;
  numberingSystem: string;
  currency: string;
  t: (key: MessageKey, params?: Record<string, string | number>) => string;
  format: {
    date: (value: Parameters<typeof formatDate>[0], options?: Intl.DateTimeFormatOptions) => string;
    time: (value: Parameters<typeof formatTime>[0], options?: Intl.DateTimeFormatOptions) => string;
    dateTime: (value: Parameters<typeof formatDateTime>[0], options?: Intl.DateTimeFormatOptions) => string;
    number: (value: Parameters<typeof formatNumber>[0], options?: Intl.NumberFormatOptions) => string;
    currency: (value: Parameters<typeof formatCurrency>[0], options?: Intl.NumberFormatOptions) => string;
    percent: (value: Parameters<typeof formatPercent>[0], options?: Intl.NumberFormatOptions) => string;
    relativeTime: (value: Parameters<typeof formatRelativeTime>[0], baseDate?: Date) => string;
  };
};

const DEFAULT_LOCALE_META: LocaleContextValue = {
  locale: DEFAULT_LOCALE,
  fallbackLocale: DEFAULT_LOCALE,
  supportedLocales: SELECTABLE_LOCALES,
  country: DEFAULT_COUNTRY,
  defaultCountry: DEFAULT_COUNTRY,
  supportedCountries: SELECTABLE_COUNTRIES,
  dir: LOCALE_DEFINITIONS[DEFAULT_LOCALE].dir,
  isRtl: true,
  htmlLang: LOCALE_DEFINITIONS[DEFAULT_LOCALE].htmlLang,
  dateLocale: LOCALE_DEFINITIONS[DEFAULT_LOCALE].dateLocale,
  calendar: LOCALE_DEFINITIONS[DEFAULT_LOCALE].calendar,
  numberingSystem: LOCALE_DEFINITIONS[DEFAULT_LOCALE].numberingSystem,
  currency: LOCALE_DEFINITIONS[DEFAULT_LOCALE].currency,
  t: (key, params) => translate(DEFAULT_LOCALE, key, params),
  format: {
    date: (value, options) => formatDate(value, undefined, options),
    time: (value, options) => formatTime(value, undefined, options),
    dateTime: (value, options) => formatDateTime(value, undefined, options),
    number: (value, options) => formatNumber(value, undefined, options),
    currency: (value, options) => formatCurrency(value, undefined, options),
    percent: (value, options) => formatPercent(value, undefined, options),
    relativeTime: (value, baseDate) => formatRelativeTime(value, undefined, baseDate),
  },
};

const LocaleContext = createContext<LocaleContextValue>(DEFAULT_LOCALE_META);

function normalizeDirection(dir?: string | null, locale?: AppLocale): AppDirection {
  if (dir === "rtl" || dir === "ltr") {
    return dir;
  }

  return LOCALE_DEFINITIONS[locale ?? DEFAULT_LOCALE]?.dir ?? DEFAULT_LOCALE_META.dir;
}

function normalizeCalendar(calendar?: string | null, locale?: AppLocale): AppCalendar {
  if (calendar === "jalali" || calendar === "gregorian" || calendar === "hijri") {
    return calendar;
  }

  return LOCALE_DEFINITIONS[locale ?? DEFAULT_LOCALE]?.calendar ?? DEFAULT_LOCALE_META.calendar;
}

export function resolveLocaleMeta(meta?: TenantMeta | null): LocaleContextValue {
  const locale = normalizeLocale(meta?.locale) ?? DEFAULT_LOCALE_META.locale;
  const fallbackLocale = normalizeLocale(meta?.fallbackLocale) ?? DEFAULT_LOCALE_META.fallbackLocale;
  const supportedLocales = (meta?.supportedLocales ?? DEFAULT_LOCALE_META.supportedLocales)
    .map((item) => normalizeLocale(item))
    .filter((item): item is AppLocale => item !== null);
  const dir = normalizeDirection(meta?.dir, locale);
  const localeDefinition = LOCALE_DEFINITIONS[locale] ?? LOCALE_DEFINITIONS[DEFAULT_LOCALE];

  const formatContext: LocaleFormatContext = {
    locale,
    dateLocale: meta?.dateLocale || localeDefinition.dateLocale,
    calendar: normalizeCalendar(meta?.calendar, locale),
    numberingSystem: meta?.numberingSystem || localeDefinition.numberingSystem,
    currency: localeDefinition.currency,
  };

  const value: LocaleContextValue = {
    locale,
    fallbackLocale,
    supportedLocales: supportedLocales.length > 0 ? supportedLocales : DEFAULT_LOCALE_META.supportedLocales,
    country: meta?.country || DEFAULT_LOCALE_META.country,
    defaultCountry: meta?.defaultCountry || DEFAULT_LOCALE_META.defaultCountry,
    supportedCountries: meta?.supportedCountries?.length ? meta.supportedCountries : DEFAULT_LOCALE_META.supportedCountries,
    dir,
    isRtl: dir === "rtl",
    htmlLang: meta?.htmlLang || locale,
    dateLocale: formatContext.dateLocale,
    calendar: formatContext.calendar,
    numberingSystem: formatContext.numberingSystem,
    currency: formatContext.currency,
    t: (key: MessageKey, params?: Record<string, string | number>) => translate(locale, key, params),
    format: {
      date: (date, options) => formatDate(date, formatContext, options),
      time: (date, options) => formatTime(date, formatContext, options),
      dateTime: (date, options) => formatDateTime(date, formatContext, options),
      number: (number, options) => formatNumber(number, formatContext, options),
      currency: (number, options) => formatCurrency(number, formatContext, options),
      percent: (number, options) => formatPercent(number, formatContext, options),
      relativeTime: (date, baseDate) => formatRelativeTime(date, formatContext, baseDate),
    },
  };

  return value;
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [tenantMeta, setTenantMeta] = useState<TenantMeta | null>(() => getInitialTenantMeta());
  const initialLocaleMeta = useMemo(() => resolveLocaleMeta(tenantMeta), []);
  const [messagesReady, setMessagesReady] = useState(() => areMessagesLoaded(initialLocaleMeta.locale) && areMessagesLoaded(initialLocaleMeta.fallbackLocale));
  const [messageVersion, setMessageVersion] = useState(0);
  const value = useMemo(() => resolveLocaleMeta(tenantMeta), [messageVersion, tenantMeta]);

  useEffect(() => {
    const handleMetaRefresh = () => setTenantMeta(getInitialTenantMeta());

    window.addEventListener("booking:payment-settings-updated", handleMetaRefresh);
    window.addEventListener("booking:tenant-meta-updated", handleMetaRefresh);

    return () => {
      window.removeEventListener("booking:payment-settings-updated", handleMetaRefresh);
      window.removeEventListener("booking:tenant-meta-updated", handleMetaRefresh);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setMessagesReady(areMessagesLoaded(value.locale) && areMessagesLoaded(value.fallbackLocale));

    Promise.all([loadMessages(value.fallbackLocale), loadMessages(value.locale)]).then(() => {
      if (cancelled) {
        return;
      }

      setMessagesReady(true);
      setMessageVersion((version) => version + 1);
    });

    return () => {
      cancelled = true;
    };
  }, [value.fallbackLocale, value.locale]);

  useEffect(() => {
    document.documentElement.lang = value.htmlLang;
    document.documentElement.dir = value.dir;

    try {
      window.localStorage.setItem("barberbook.locale", value.locale);
    } catch (error) {
      // Ignore storage failures in private or restricted browsing contexts.
    }

    window.__BOOKING_APPLY_SHELL_LOCALE__?.();
  }, [value.dir, value.htmlLang, value.locale]);

  return <LocaleContext.Provider value={value}>{messagesReady ? children : null}</LocaleContext.Provider>;
}

export function useLocale() {
  return useContext(LocaleContext);
}

export function useT() {
  return useLocale().t;
}

export function useFormat() {
  return useLocale().format;
}
