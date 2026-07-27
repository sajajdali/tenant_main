import {
  getCountries,
  getCountryCallingCode,
  getExampleNumber,
  isSupportedCountry,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js/max";
import mobilePhoneExamples from "libphonenumber-js/mobile/examples";
import { normalizeDigits } from "@/lib/normalize";

export const PHONE_COUNTRIES = getCountries();

export function resolvePhoneCountry(country?: string | null): CountryCode {
  const normalized = country?.trim().toUpperCase();

  return normalized && isSupportedCountry(normalized) ? normalized : "US";
}

export function countryDialCode(country: CountryCode): string {
  return `+${getCountryCallingCode(country)}`;
}

export function countryShortCode(country: CountryCode): string {
  return country === "GB" ? "UK" : country;
}

export function countryPhoneExample(country: CountryCode): string {
  return getExampleNumber(country, mobilePhoneExamples)?.formatNational() ?? "";
}

export function normalizeNationalPhoneInput(value: string, country: CountryCode): string {
  const normalizedValue = normalizeDigits(value);
  let digits = normalizedValue.replace(/\D/g, "");

  if (normalizedValue.trim().startsWith("+")) {
    const callingCode = getCountryCallingCode(country);
    if (digits.startsWith(callingCode)) {
      digits = digits.slice(callingCode.length);
    }
  }

  return digits.slice(0, 15);
}

export function parseNationalPhone(value: string, country: CountryCode) {
  const phone = parsePhoneNumberFromString(value, country);
  const phoneType = phone?.getType();

  return phone?.isValid() && (phoneType === "MOBILE" || phoneType === "FIXED_LINE_OR_MOBILE")
    ? phone
    : null;
}

export function phoneForSubmission(value: string, country: CountryCode): string {
  const phone = parseNationalPhone(value, country);

  if (!phone) {
    return "";
  }

  // Preserve existing Iranian customer identities, which are stored as 09xxxxxxxxx.
  if (country === "IR") {
    return `0${phone.nationalNumber}`;
  }

  return phone.number.slice(1);
}

export function phoneForDisplay(value: string, country: CountryCode): string {
  const phone = parseNationalPhone(value, country);

  return phone?.number ?? `${countryDialCode(country)} ${value}`.trim();
}
