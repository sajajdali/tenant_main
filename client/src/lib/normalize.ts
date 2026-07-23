const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

export const normalizeDigits = (value: string) =>
  value.replace(/[۰-۹٠-٩]/g, (char) => {
    const persianIndex = PERSIAN_DIGITS.indexOf(char);
    if (persianIndex >= 0) {
      return String(persianIndex);
    }

    const arabicIndex = ARABIC_DIGITS.indexOf(char);
    if (arabicIndex >= 0) {
      return String(arabicIndex);
    }

    return char;
  });

export const normalizePhoneInput = (value: string) =>
  normalizeDigits(value).replace(/\D/g, "").slice(0, 11);
