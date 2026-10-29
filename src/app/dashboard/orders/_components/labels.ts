import type { Locale } from "@/i18n/locale";
import type { CommonMessages } from "@/i18n/messages/common";
import { formatMoney } from "@/lib/format";
import type { OrderMessages } from "@/i18n/messages/orders";

/** "Mount Lebanon" -> m.govMountLebanon; unknown values show as stored. */
export function govLabel(m: OrderMessages, governorate: string): string {
  return m[`gov${governorate.replace(/[^A-Za-z]/g, "")}` as keyof OrderMessages] ?? governorate;
}

/** What the courier said they collected at the door: "$20.00 + 450,000 LBP". */
export function reportedCash(usd: number | null, lbp: number | null, locale: Locale): string {
  if (usd === null && lbp === null) return "—";
  const parts = [usd ? formatMoney(usd, "USD", locale) : null, lbp ? formatMoney(lbp, "LBP", locale) : null].filter(Boolean);
  return parts.length ? parts.join(" + ") : formatMoney(0, "USD", locale);
}

export function statusLabel(t: CommonMessages, status: string): string {
  return t[`status${status}` as keyof CommonMessages] ?? status;
}

const intl = (locale: Locale) => (locale === "ar" ? "ar-LB-u-nu-latn" : "en-US");

/** How long ago, for board cards: "12 min. ago", "3 hr. ago", "2 days ago". */
export function age(iso: string, locale: Locale, now = Date.now()): string {
  const minutes = Math.round((Date.parse(iso) - now) / 60_000);
  const rtf = new Intl.RelativeTimeFormat(intl(locale), { numeric: "auto", style: "short" });
  if (minutes > -60) return rtf.format(minutes, "minute");
  if (minutes > -24 * 60) return rtf.format(Math.round(minutes / 60), "hour");
  return rtf.format(Math.round(minutes / (24 * 60)), "day");
}

/** "Oct 26, 3:20 PM" under a timeline step. */
export function shortDateTime(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(intl(locale), { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}
