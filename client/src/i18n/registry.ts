export type AppLocale = "fa" | "en" | "ar" | "de";
export type AppDirection = "rtl" | "ltr";
export type AppCalendar = "jalali" | "gregorian" | "hijri";

export type LocaleDefinition = {
  code: AppLocale;
  label: string;
  nativeLabel: string;
  dir: AppDirection;
  htmlLang: string;
  dateLocale: string;
  calendar: AppCalendar;
  numberingSystem: string;
  currency: string;
  enabled: boolean;
  selectable: boolean;
};

export type CountryDefinition = {
  code: string;
  label: string;
  nativeLabel: string;
  currency: string;
  timezone: string;
  enabled: boolean;
  selectable: boolean;
};

export const DEFAULT_LOCALE: AppLocale = "fa";
export const DEFAULT_COUNTRY = "IR";

export const LOCALE_DEFINITIONS = {
  fa: {
    code: "fa",
    label: "Persian",
    nativeLabel: "فارسی",
    dir: "rtl",
    htmlLang: "fa",
    dateLocale: "fa-IR",
    calendar: "jalali",
    numberingSystem: "arabext",
    currency: "IRR",
    enabled: true,
    selectable: true,
  },
  en: {
    code: "en",
    label: "English",
    nativeLabel: "English",
    dir: "ltr",
    htmlLang: "en",
    dateLocale: "en-US",
    calendar: "gregorian",
    numberingSystem: "latn",
    currency: "USD",
    enabled: true,
    selectable: true,
  },
  ar: {
    code: "ar",
    label: "Arabic",
    nativeLabel: "العربية",
    dir: "rtl",
    htmlLang: "ar",
    dateLocale: "ar-SA",
    calendar: "hijri",
    numberingSystem: "arab",
    currency: "SAR",
    enabled: true,
    selectable: true,
  },
  de: {
    code: "de",
    label: "German",
    nativeLabel: "Deutsch",
    dir: "ltr",
    htmlLang: "de",
    dateLocale: "de-DE",
    calendar: "gregorian",
    numberingSystem: "latn",
    currency: "EUR",
    enabled: true,
    selectable: true,
  },
} as const satisfies Record<AppLocale, LocaleDefinition>;

export const COUNTRY_DEFINITIONS = {
  IR: {
    code: "IR",
    label: "Iran",
    nativeLabel: "ایران",
    currency: "IRR",
    timezone: "Asia/Tehran",
    enabled: true,
    selectable: true,
  },
  US: {
    code: "US",
    label: "United States",
    nativeLabel: "United States",
    currency: "USD",
    timezone: "America/New_York",
    enabled: true,
    selectable: true,
  },
  SA: {
    code: "SA",
    label: "Saudi Arabia",
    nativeLabel: "السعودية",
    currency: "SAR",
    timezone: "Asia/Riyadh",
    enabled: true,
    selectable: true,
  },
  DE: {
    code: "DE",
    label: "Germany",
    nativeLabel: "Deutschland",
    currency: "EUR",
    timezone: "Europe/Berlin",
    enabled: true,
    selectable: true,
  },
} as const satisfies Record<string, CountryDefinition>;

export const ENABLED_LOCALES = Object.values(LOCALE_DEFINITIONS)
  .filter((locale) => locale.enabled)
  .map((locale) => locale.code);

export const SELECTABLE_LOCALES = Object.values(LOCALE_DEFINITIONS)
  .filter((locale) => locale.enabled && locale.selectable)
  .map((locale) => locale.code);

export const ENABLED_COUNTRIES = Object.values(COUNTRY_DEFINITIONS)
  .filter((country) => country.enabled)
  .map((country) => country.code);

export const SELECTABLE_COUNTRIES = Object.values(COUNTRY_DEFINITIONS)
  .filter((country) => country.enabled && country.selectable)
  .map((country) => country.code);

export function normalizeLocale(value?: string | null): AppLocale | null {
  const raw = value?.trim().toLowerCase().replace("_", "-");

  if (!raw) {
    return null;
  }

  const base = raw.split("-")[0] as AppLocale;
  const definition = LOCALE_DEFINITIONS[base];

  return definition?.enabled ? base : null;
}

export function normalizeCountry(value?: string | null): string | null {
  const code = value?.trim().toUpperCase();

  if (!code) {
    return null;
  }

  if (!Object.prototype.hasOwnProperty.call(COUNTRY_DEFINITIONS, code)) {
    return null;
  }

  const definition = COUNTRY_DEFINITIONS[code as keyof typeof COUNTRY_DEFINITIONS];

  return definition.enabled ? code : null;
}
