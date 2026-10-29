import { parsePhoneNumberFromString } from "libphonenumber-js";

/** Accepts local ("03 123 456", "71123456") or international input; returns E.164 or null. */
export function normalizePhone(input: string, defaultCountry: "LB" = "LB"): string | null {
  const parsed = parsePhoneNumberFromString(input, defaultCountry);
  return parsed && parsed.isValid() ? parsed.number : null;
}
