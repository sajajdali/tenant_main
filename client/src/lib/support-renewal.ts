import { formatCurrency, formatDate } from "@/i18n/format";
import { translate } from "@/i18n/messages";
import { DEFAULT_LOCALE, LOCALE_DEFINITIONS, normalizeLocale, type AppLocale } from "@/i18n/registry";

function getCurrentLocale(): AppLocale {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return DEFAULT_LOCALE;
  }

  return (
    normalizeLocale(document.documentElement.lang) ||
    normalizeLocale(window.localStorage.getItem("barberbook.locale")) ||
    DEFAULT_LOCALE
  );
}

function getCurrentFormatContext() {
  const locale = getCurrentLocale();
  const definition = LOCALE_DEFINITIONS[locale];

  return {
    locale,
    dateLocale: definition.dateLocale,
    calendar: definition.calendar,
    numberingSystem: definition.numberingSystem,
    currency: definition.currency,
  };
}

export const formatSupportRenewalMoney = (amount?: number | null) => {
  return formatCurrency(Number(amount ?? 0), getCurrentFormatContext());
};

export const formatSupportRenewalDate = (value?: string | null) => {
  const locale = getCurrentLocale();

  if (!value) {
    return translate(locale, "supportRenewal.notSet");
  }

  return formatDate(value, getCurrentFormatContext(), {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
};
