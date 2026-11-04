import type { Locale } from "@/i18n/locale";
import { formatMoney } from "@/lib/format";

/** Dollars and pounds as handed over, e.g. "$40.00 + LBP 900,000". */
export function cash(r: { usdCents: bigint; lbp: bigint }, locale: Locale) {
  const parts = [r.usdCents ? formatMoney(r.usdCents, "USD", locale) : null, r.lbp ? formatMoney(r.lbp, "LBP", locale) : null].filter(Boolean);
  return parts.join(" + ");
}

/** Remittances have no number of their own: the owner's reference, else a short stable code. */
export const remittanceRef = (id: string, reference: string | null) => reference || `RM-${id.slice(-6).toUpperCase()}`;

export const remittanceHref = (id: string) => `/dashboard/cash/remittances/${id}`;

/** What its orders add up to after fees. A fee is in the order's currency; like reconcile(), this takes that to be the shop's. */
export function reportedOf(r: { lines: { collectedUsdCents: bigint; collectedLbp: bigint; feeMinor: bigint }[] }, currency: "USD" | "LBP") {
  const fees = r.lines.reduce((sum, l) => sum + l.feeMinor, 0n);
  return {
    usdCents: r.lines.reduce((sum, l) => sum + l.collectedUsdCents, 0n) - (currency === "USD" ? fees : 0n),
    lbp: r.lines.reduce((sum, l) => sum + l.collectedLbp, 0n) - (currency === "LBP" ? fees : 0n),
  };
}
