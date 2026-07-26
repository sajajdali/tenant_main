import { TenantMeta } from "./types";
import { translate } from "@/i18n/messages";
import type { MessageKey } from "@/i18n/messages";
import { DEFAULT_LOCALE, normalizeLocale } from "@/i18n/registry";

const NUTRITION_AUDIENCE_SLUGS = ["nutritionists", "nutrition-doctors"];

const AUDIENCE_LABEL_KEYS = {
  barbers: {
    singular: "audience.barbers.singular",
    plural: "audience.barbers.plural",
    business: "audience.barbers.business",
  },
  doctors: {
    singular: "audience.doctors.singular",
    plural: "audience.doctors.plural",
    business: "audience.doctors.business",
  },
  lawyers: {
    singular: "audience.lawyers.singular",
    plural: "audience.lawyers.plural",
    business: "audience.lawyers.business",
  },
  consultants: {
    singular: "audience.consultants.singular",
    plural: "audience.consultants.plural",
    business: "audience.consultants.business",
  },
  experts: {
    singular: "audience.experts.singular",
    plural: "audience.experts.plural",
    business: "audience.experts.business",
  },
  nutritionists: {
    singular: "audience.nutritionists.singular",
    plural: "audience.nutritionists.plural",
    business: "audience.nutritionists.business",
  },
  "nutrition-doctors": {
    singular: "audience.nutrition-doctors.singular",
    plural: "audience.nutrition-doctors.plural",
    business: "audience.nutrition-doctors.business",
  },
} satisfies Record<string, Record<"singular" | "plural" | "business", MessageKey>>;

const DEFAULT_AUDIENCE_LABEL_KEYS = {
  singular: "audience.default.singular",
  plural: "audience.default.plural",
  business: "audience.default.business",
} satisfies Record<"singular" | "plural" | "business", MessageKey>;

const FEATURE_FALLBACKS: Record<string, string[]> = {
  finance_reports: ["reports"],
  sms_settings: ["general_settings"],
  notification_campaigns: ["sms_campaigns"],
  brand_kit: ["appearance"],
  contact_page: ["appearance"],
  about_page: ["appearance"],
};

function resolveFeatureIndex(features: string[], key: string) {
  const directIndex = features.indexOf(key);

  if (directIndex >= 0) {
    return directIndex;
  }

  const fallbackKeys = FEATURE_FALLBACKS[key] ?? [];

  for (const fallbackKey of fallbackKeys) {
    const fallbackIndex = features.indexOf(fallbackKey);

    if (fallbackIndex >= 0) {
      return fallbackIndex;
    }
  }

  return -1;
}

export function getAudienceLabels(meta?: TenantMeta | null) {
  const locale = normalizeLocale(meta?.locale) ?? DEFAULT_LOCALE;
  const slug = meta?.audience?.slug;
  const labelKeys = slug && slug in AUDIENCE_LABEL_KEYS
    ? AUDIENCE_LABEL_KEYS[slug as keyof typeof AUDIENCE_LABEL_KEYS]
    : DEFAULT_AUDIENCE_LABEL_KEYS;

  if (locale !== "fa") {
    return {
      singular: translate(locale, labelKeys.singular),
      plural: translate(locale, labelKeys.plural),
      business: translate(locale, labelKeys.business),
    };
  }

  return {
    singular: meta?.audience?.singularLabel || translate(locale, "audience.default.singular"),
    plural: meta?.audience?.pluralLabel || translate(locale, "audience.default.plural"),
    business: meta?.audience?.businessLabel || translate(locale, "audience.default.business"),
  };
}

export function isNutritionAudience(meta: TenantMeta | null | undefined) {
  return NUTRITION_AUDIENCE_SLUGS.includes(meta?.audience?.slug || "");
}

export function isAppointmentBookingDisabled(meta: TenantMeta | null | undefined) {
  return isNutritionAudience(meta) && meta?.appointmentBookingDisabled === true;
}

export function hasAudienceFeature(meta: TenantMeta | null | undefined, key: string) {
  const enabledFeatures = meta?.audience?.enabledFeatures;

  if (!enabledFeatures || enabledFeatures.length === 0) {
    return true;
  }

  return resolveFeatureIndex(enabledFeatures, key) >= 0;
}

export function hasAudienceFutureFeature(meta: TenantMeta | null | undefined, key: string) {
  const futureFeatures = meta?.audience?.futureFeatures;

  if (!futureFeatures || futureFeatures.length === 0) {
    return true;
  }

  return futureFeatures.includes(key);
}

export function hasAudienceNutritionFeature(meta: TenantMeta | null | undefined, key: string) {
  const nutritionFeatures = meta?.audience?.nutritionFeatures;

  if (!nutritionFeatures || nutritionFeatures.length === 0) {
    return false;
  }

  return nutritionFeatures.includes(key);
}

export function getAudienceFeatureOrder(meta: TenantMeta | null | undefined, key: string, fallbackIndex = 999) {
  const enabledFeatures = meta?.audience?.enabledFeatures ?? [];
  const index = resolveFeatureIndex(enabledFeatures, key);

  return index >= 0 ? index : fallbackIndex;
}

export function getAudienceFutureFeatureOrder(meta: TenantMeta | null | undefined, key: string, fallbackIndex = 999) {
  const futureFeatures = meta?.audience?.futureFeatures ?? [];
  const index = futureFeatures.indexOf(key);

  return index >= 0 ? index : fallbackIndex;
}

export function getAudienceNutritionFeatureOrder(meta: TenantMeta | null | undefined, key: string, fallbackIndex = 999) {
  const nutritionFeatures = meta?.audience?.nutritionFeatures ?? [];
  const index = nutritionFeatures.indexOf(key);

  return index >= 0 ? index : fallbackIndex;
}
