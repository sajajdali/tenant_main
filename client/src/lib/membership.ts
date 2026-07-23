import { getCitiesByProvince, getCityName, getProvinceName } from "@/lib/iran-location";
import { normalizeDigits } from "@/lib/normalize";
import { TenantPanelUser, User } from "@/lib/types";
import type { MessageKey } from "@/i18n/messages";

export type MembershipFieldKey = "email" | "gender" | "nationalCode" | "birthDate" | "location" | "jobTitle";
export type UserGender = "male" | "female";

export interface MembershipFieldRequirement {
  enabled: boolean;
  required: boolean;
}

export interface RegistrationRequirements {
  email: MembershipFieldRequirement;
  gender: MembershipFieldRequirement;
  nationalCode: MembershipFieldRequirement;
  birthDate: MembershipFieldRequirement;
  location: MembershipFieldRequirement;
  jobTitle: MembershipFieldRequirement;
}

export interface UserProfileFormValues {
  name: string;
  mobile: string;
  email: string;
  gender: string;
  nationalCode: string;
  birthYear: string;
  birthMonth: string;
  birthDay: string;
  provinceId: string;
  cityId: string;
  jobTitle: string;
  nutritionProfileFixedMessage?: string;
}

export interface UserProfilePayload {
  name: string;
  mobile?: string;
  email?: string | null;
  gender?: UserGender | null;
  nationalCode?: string | null;
  birthDate?: string | null;
  provinceId?: number | null;
  provinceName?: string | null;
  cityId?: number | null;
  cityName?: string | null;
  jobTitle?: string | null;
  nutritionProfileFixedMessage?: string | null;
}

export const MEMBERSHIP_FIELD_DEFINITIONS: Array<{
  key: MembershipFieldKey;
  labelKey: MessageKey;
  descriptionKey: MessageKey;
}> = [
  { key: "email", labelKey: "profile.emailLabel", descriptionKey: "settings.membership.fields.email.description" },
  { key: "gender", labelKey: "profile.genderLabel", descriptionKey: "settings.membership.fields.gender.description" },
  { key: "nationalCode", labelKey: "profile.nationalCodeLabel", descriptionKey: "settings.membership.fields.nationalCode.description" },
  { key: "birthDate", labelKey: "profile.birthDateLabel", descriptionKey: "settings.membership.fields.birthDate.description" },
  { key: "location", labelKey: "profile.locationLabel", descriptionKey: "settings.membership.fields.location.description" },
  { key: "jobTitle", labelKey: "profile.jobTitleLabel", descriptionKey: "settings.membership.fields.jobTitle.description" },
];

export const GENDER_OPTIONS: Array<{ value: UserGender }> = [
  { value: "male" },
  { value: "female" },
];

export const getDefaultRegistrationRequirements = (): RegistrationRequirements => ({
  email: { enabled: false, required: false },
  gender: { enabled: false, required: false },
  nationalCode: { enabled: false, required: false },
  birthDate: { enabled: false, required: false },
  location: { enabled: false, required: false },
  jobTitle: { enabled: false, required: false },
});

export const normalizeRegistrationRequirements = (
  requirements?: Partial<RegistrationRequirements> | null,
): RegistrationRequirements => {
  const defaults = getDefaultRegistrationRequirements();

  for (const key of Object.keys(defaults) as MembershipFieldKey[]) {
    const enabled = !!requirements?.[key]?.enabled;
    defaults[key] = {
      enabled,
      required: enabled && !!requirements?.[key]?.required,
    };
  }

  return defaults;
};

const splitBirthDate = (birthDate?: string | null) => {
  if (!birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
    return { year: "", month: "", day: "" };
  }

  const [year, month, day] = birthDate.split("-");
  return { year, month, day };
};

export const getUserProfileFormDefaults = (
  user?: Partial<UserProfilePayload & Pick<User, "phone"> & Pick<TenantPanelUser, "mobile">> | null,
): UserProfileFormValues => {
  const birth = splitBirthDate(user?.birthDate ?? null);

  return {
    name: user?.name ?? "",
    mobile: (user as { mobile?: string; phone?: string } | null | undefined)?.mobile ?? user?.phone ?? "",
    email: user?.email ?? "",
    gender: user?.gender ?? "",
    nationalCode: user?.nationalCode ?? "",
    birthYear: birth.year,
    birthMonth: birth.month,
    birthDay: birth.day,
    provinceId: user?.provinceId ? String(user.provinceId) : "",
    cityId: user?.cityId ? String(user.cityId) : "",
    jobTitle: user?.jobTitle ?? "",
    nutritionProfileFixedMessage: user?.nutritionProfileFixedMessage ?? "",
  };
};

const pad2 = (value: string) => value.padStart(2, "0");

export const buildUserProfilePayload = (form: UserProfileFormValues): UserProfilePayload => {
  const normalizedProvinceId = Number(normalizeDigits(form.provinceId));
  const normalizedCityId = Number(normalizeDigits(form.cityId));
  const hasBirthDate = form.birthYear && form.birthMonth && form.birthDay;

  return {
    name: form.name.trim(),
    mobile: form.mobile ? normalizeDigits(form.mobile).trim() : undefined,
    email: form.email.trim() || null,
    gender: (form.gender || null) as UserGender | null,
    nationalCode: normalizeDigits(form.nationalCode).trim() || null,
    birthDate: hasBirthDate
      ? `${normalizeDigits(form.birthYear).slice(0, 4)}-${pad2(normalizeDigits(form.birthMonth).slice(0, 2))}-${pad2(normalizeDigits(form.birthDay).slice(0, 2))}`
      : null,
    provinceId: normalizedProvinceId > 0 ? normalizedProvinceId : null,
    provinceName: normalizedProvinceId > 0 ? getProvinceName(normalizedProvinceId) : null,
    cityId: normalizedCityId > 0 ? normalizedCityId : null,
    cityName: normalizedCityId > 0 ? getCityName(normalizedCityId) : null,
    jobTitle: form.jobTitle.trim() || null,
  };
};

export const validateUserProfileForm = (
  form: UserProfileFormValues,
  requirements?: Partial<RegistrationRequirements> | null,
  options?: {
    requireMobile?: boolean;
    t?: (key: MessageKey, params?: Record<string, string | number>) => string;
    formatNumber?: (value: number) => string;
  },
): Partial<Record<keyof UserProfileFormValues, string>> => {
  const normalized = normalizeRegistrationRequirements(requirements);
  const errors: Partial<Record<keyof UserProfileFormValues, string>> = {};
  const fallbackT = (key: MessageKey, params?: Record<string, string | number>): string => {
    if (!params) {
      return key;
    }

    let message = String(key);

    Object.entries(params).forEach(([name, value]) => {
      message = message.replaceAll(`{{${name}}}`, String(value));
    });

    return message;
  };
  const t: (key: MessageKey, params?: Record<string, string | number>) => string = options?.t ?? fallbackT;
  const number = options?.formatNumber ?? ((value: number) => String(value));
  const name = form.name.trim();
  const mobile = normalizeDigits(form.mobile).trim();
  const email = form.email.trim();
  const nationalCode = normalizeDigits(form.nationalCode).trim();
  const provinceId = Number(normalizeDigits(form.provinceId));
  const cityId = Number(normalizeDigits(form.cityId));
  const day = normalizeDigits(form.birthDay);
  const month = normalizeDigits(form.birthMonth);
  const year = normalizeDigits(form.birthYear);

  if (name.length < 3) {
    errors.name = t("profile.validation.nameMin", { min: number(3) });
  }

  if (options?.requireMobile && mobile.length !== 11) {
    errors.mobile = t("profile.validation.mobileLength", { length: number(11) });
  }

  if (normalized.email.enabled) {
    if (normalized.email.required && email.length === 0) {
      errors.email = t("profile.validation.emailRequired");
    } else if (email.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = t("profile.validation.emailInvalid");
    }
  }

  if (normalized.gender.enabled && normalized.gender.required && !form.gender) {
    errors.gender = t("profile.validation.genderRequired");
  }

  if (normalized.nationalCode.enabled) {
    if (normalized.nationalCode.required && nationalCode.length === 0) {
      errors.nationalCode = t("profile.validation.nationalCodeRequired");
    } else if (nationalCode.length > 0 && nationalCode.length !== 10) {
      errors.nationalCode = t("profile.validation.nationalCodeLength", { length: number(10) });
    }
  }

  if (normalized.birthDate.enabled) {
    const hasAnyBirth = !!(day || month || year);
    const hasFullBirth = !!(day && month && year);

    if (normalized.birthDate.required && !hasFullBirth) {
      errors.birthYear = t("profile.validation.birthDateRequired");
    } else if (hasAnyBirth && !hasFullBirth) {
      errors.birthYear = t("profile.validation.birthDateIncomplete");
    } else if (hasFullBirth) {
      const yearNum = Number(year);
      const monthNum = Number(month);
      const dayNum = Number(day);

      if (year.length !== 4 || yearNum < 1300 || yearNum > 1600 || monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31) {
        errors.birthYear = t("profile.validation.birthDateInvalid");
      }
    }
  }

  if (normalized.location.enabled) {
    const hasAnyLocation = provinceId > 0 || cityId > 0;
    const hasFullLocation = provinceId > 0 && cityId > 0;

    if (normalized.location.required && !hasFullLocation) {
      errors.provinceId = t("profile.validation.locationRequired");
    } else if (hasAnyLocation && !hasFullLocation) {
      errors.provinceId = t("profile.validation.locationIncomplete");
    }
  }

  if (normalized.jobTitle.enabled && normalized.jobTitle.required && form.jobTitle.trim().length < 2) {
    errors.jobTitle = t("profile.validation.jobTitleRequired");
  }

  return errors;
};

export const isUserProfileComplete = (
  user?: Partial<UserProfilePayload> | null,
  requirements?: Partial<RegistrationRequirements> | null,
): boolean => {
  if (!user?.name || user.name.trim().length < 3) {
    return false;
  }

  const normalized = normalizeRegistrationRequirements(requirements);

  if (normalized.email.required && !user.email) return false;
  if (normalized.gender.required && !user.gender) return false;
  if (normalized.nationalCode.required && !user.nationalCode) return false;
  if (normalized.birthDate.required && !user.birthDate) return false;
  if (normalized.location.required && (!user.provinceId || !user.cityId)) return false;
  if (normalized.jobTitle.required && !user.jobTitle) return false;

  return true;
};

export const shouldShowMembershipField = (
  key: MembershipFieldKey,
  requirements?: Partial<RegistrationRequirements> | null,
  currentValue?: string | number | null,
): boolean => {
  const normalized = normalizeRegistrationRequirements(requirements);

  if (key === "location") {
    return normalized.location.enabled || !!currentValue;
  }

  return !!normalized[key].enabled || !!currentValue;
};

export const getCitiesForProfileForm = (provinceId: string) => {
  const normalizedProvinceId = Number(normalizeDigits(provinceId));
  return normalizedProvinceId > 0 ? getCitiesByProvince(normalizedProvinceId) : [];
};
