import type { Locale } from "@/i18n/locale";

// Display helpers shared by server and client components. Amounts arrive as
// minor units: numbers from the API, bigint straight from a service.
type Minor = number | bigint | string;
type Currency = "USD" | "LBP";

const intl = (locale: Locale) => (locale === "ar" ? "ar-LB-u-nu-latn" : "en-US");

export function formatMoney(minor: Minor, currency: Currency, locale: Locale = "en"): string {
  const value = Number(minor) / (currency === "USD" ? 100 : 1);
  const text = new Intl.NumberFormat(intl(locale), {
    style: "currency",
    currency,
    currencyDisplay: currency === "LBP" ? "code" : "symbol",
    minimumFractionDigits: currency === "USD" ? 2 : 0,
    maximumFractionDigits: currency === "USD" ? 2 : 0,
  }).format(value);
  // Arabic ends in "US$": a trailing LRM keeps the "$" after "US" in right-to-left text (else it shows "$US").
  return locale === "ar" ? text + "‎" : text;
}

/** The same amount in the other currency at the order's frozen rate (pounds per dollar). */
export function convert(minor: Minor, from: Currency, rate: string | number | null | undefined) {
  if (!rate) return null;
  const r = Number(rate);
  if (from === "USD") return { currency: "LBP" as const, minor: Math.round((Number(minor) / 100) * r) };
  return { currency: "USD" as const, minor: Math.round((Number(minor) / r) * 100) };
}

/** Minor units back to the decimal text the API accepts ("24.50", "450000"). */
export function toAmountText(minor: Minor, currency: Currency): string {
  return currency === "USD" ? (Number(minor) / 100).toFixed(2) : String(minor);
}

export function formatDateTime(value: string | Date, locale: Locale = "en", timeZone?: string): string {
  return new Intl.DateTimeFormat(intl(locale), { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(value));
}

export function formatDate(value: string | Date, locale: Locale = "en", timeZone?: string): string {
  return new Intl.DateTimeFormat(intl(locale), { dateStyle: "medium", timeZone }).format(new Date(value));
}

export function formatMonth(value: string | Date, locale: Locale = "en"): string {
  return new Intl.DateTimeFormat(intl(locale), { month: "short", year: "numeric" }).format(new Date(value));
}

export function formatNumber(value: number, locale: Locale = "en", digits = 0): string {
  return new Intl.NumberFormat(intl(locale), { maximumFractionDigits: digits }).format(value);
}

/** Defence in depth for owner links: the API only stores https links on allowlisted hosts. */
export const httpsLink = (url: string | null | undefined) => (url?.startsWith("https://") ? url : null);

/** "https://www.instagram.com/yourshop/" -> "@yourshop". Null for a link that isn't one plain handle, like facebook.com/profile.php. */
export function socialHandle(url: string): string | null {
  let path: string;
  try {
    path = new URL(url).pathname;
  } catch {
    // A link still being typed in the live preview ("https://") isn't a URL yet.
    return null;
  }
  const handle = /^\/([\w.-]+)\/?$/.exec(path)?.[1];
  return handle && !handle.endsWith(".php") ? `@${handle}` : null;
}

/**
 * How much room a shop name takes, in average letters, for fitting it in the phone header.
 * At least its length, so a name of average letters keeps its size; wide letters count for more, or they'd be cut.
 */
export function nameUnits(name: string): number {
  const letters = [...name];
  return Math.max(letters.length, letters.reduce((sum, c) => sum + (/[A-Zmw]/.test(c) ? 1.5 : /[iljtfr ]/.test(c) ? 0.6 : 1), 0));
}

/** "+96171123456" -> https://wa.me/96171123456 for the one-tap WhatsApp button. */
export function whatsappLink(e164: string, text?: string): string {
  const base = `https://wa.me/${e164.replace(/\D/g, "")}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}
