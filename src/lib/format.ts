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

export function formatDateTime(value: string | Date, locale: Locale = "en"): string {
  return new Intl.DateTimeFormat(intl(locale), { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function formatDate(value: string | Date, locale: Locale = "en"): string {
  return new Intl.DateTimeFormat(intl(locale), { dateStyle: "medium" }).format(new Date(value));
}

export function formatNumber(value: number, locale: Locale = "en", digits = 0): string {
  return new Intl.NumberFormat(intl(locale), { maximumFractionDigits: digits }).format(value);
}

/** "+96171123456" -> https://wa.me/96171123456 for the one-tap WhatsApp button. */
export function whatsappLink(e164: string, text?: string): string {
  const base = `https://wa.me/${e164.replace(/\D/g, "")}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}
