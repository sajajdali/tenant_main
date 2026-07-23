import type { AppCalendar, AppLocale } from "./registry";

export type LocaleFormatContext = {
  locale: AppLocale;
  dateLocale: string;
  calendar: AppCalendar;
  numberingSystem: string;
  currency: string;
};

type DateInput = Date | string | number | null | undefined;

const FALLBACK_CONTEXT: LocaleFormatContext = {
  locale: "fa",
  dateLocale: "fa-IR",
  calendar: "jalali",
  numberingSystem: "arabext",
  currency: "IRR",
};

const CALENDAR_INTL_EXTENSION: Record<AppCalendar, string> = {
  gregorian: "gregory",
  hijri: "islamic-umalqura",
  jalali: "persian",
};

function getIntlLocale(context: Partial<LocaleFormatContext> = {}, options: { calendar?: boolean } = {}) {
  const locale = context.dateLocale || FALLBACK_CONTEXT.dateLocale;
  const numberingSystem = context.numberingSystem || FALLBACK_CONTEXT.numberingSystem;
  const calendar = CALENDAR_INTL_EXTENSION[context.calendar || FALLBACK_CONTEXT.calendar] ?? CALENDAR_INTL_EXTENSION[FALLBACK_CONTEXT.calendar];
  const extensions = [`nu-${numberingSystem}`];

  if (options.calendar) {
    extensions.unshift(`ca-${calendar}`);
  }

  return `${locale}-u-${extensions.join("-")}`;
}

function toDate(value: DateInput): Date | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const date = new Date(typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value);

  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value: DateInput, context: Partial<LocaleFormatContext> = {}, options: Intl.DateTimeFormatOptions = {}) {
  const date = toDate(value);

  if (!date) {
    return "";
  }

  return new Intl.DateTimeFormat(getIntlLocale(context, { calendar: true }), {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...options,
  }).format(date);
}

export function formatTime(value: DateInput, context: Partial<LocaleFormatContext> = {}, options: Intl.DateTimeFormatOptions = {}) {
  const date = toDate(value);

  if (!date) {
    return "";
  }

  return new Intl.DateTimeFormat(getIntlLocale(context), {
    hour: "2-digit",
    minute: "2-digit",
    ...options,
  }).format(date);
}

export function formatDateTime(value: DateInput, context: Partial<LocaleFormatContext> = {}, options: Intl.DateTimeFormatOptions = {}) {
  const date = toDate(value);

  if (!date) {
    return "";
  }

  return new Intl.DateTimeFormat(getIntlLocale(context, { calendar: true }), {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    ...options,
  }).format(date);
}

export function formatNumber(value: number | null | undefined, context: Partial<LocaleFormatContext> = {}, options: Intl.NumberFormatOptions = {}) {
  const number = Number(value ?? 0);

  return new Intl.NumberFormat(getIntlLocale(context), options).format(number);
}

export function formatCurrency(value: number | null | undefined, context: Partial<LocaleFormatContext> = {}, options: Intl.NumberFormatOptions = {}) {
  const currency = context.currency || FALLBACK_CONTEXT.currency;

  return new Intl.NumberFormat(getIntlLocale(context), {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "IRR" ? 0 : 2,
    ...options,
  }).format(Number(value ?? 0));
}

export function formatPercent(value: number | null | undefined, context: Partial<LocaleFormatContext> = {}, options: Intl.NumberFormatOptions = {}) {
  return new Intl.NumberFormat(getIntlLocale(context), {
    style: "percent",
    maximumFractionDigits: 0,
    ...options,
  }).format(Number(value ?? 0));
}

export function toLocaleDigits(value: string | number, context: Partial<LocaleFormatContext> = {}) {
  return String(value).replace(/\d/g, (digit) => formatNumber(Number(digit), context));
}

export function formatRelativeTime(value: DateInput, context: Partial<LocaleFormatContext> = {}, baseDate: Date = new Date()) {
  const date = toDate(value);

  if (!date) {
    return "";
  }

  const diffSeconds = Math.round((date.getTime() - baseDate.getTime()) / 1000);
  const ranges: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 60 * 60 * 24 * 365],
    ["month", 60 * 60 * 24 * 30],
    ["week", 60 * 60 * 24 * 7],
    ["day", 60 * 60 * 24],
    ["hour", 60 * 60],
    ["minute", 60],
    ["second", 1],
  ];
  const [unit, seconds] = ranges.find(([, itemSeconds]) => Math.abs(diffSeconds) >= itemSeconds) ?? ["second", 1];

  return new Intl.RelativeTimeFormat(getIntlLocale(context), { numeric: "auto" }).format(Math.round(diffSeconds / seconds), unit);
}

export function formatIsoDateInTimeZone(value: DateInput, timeZone: string) {
  const date = toDate(value);

  if (!date) {
    return "";
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";

  return year && month && day ? `${year}-${month}-${day}` : "";
}
