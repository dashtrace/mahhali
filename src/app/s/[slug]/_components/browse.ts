import { toMinor, type Currency } from "@/server/domain/money";

// The shop listing's URL state (?q=&cat=&min=&max=&sort=&page=), shared by the
// server page and the price popover. Prices travel as typed ("12.50").

const MAX_PRICE = "10000000";

/** One price box: "" -> null (no bound), a valid amount -> minor units, anything else -> undefined. */
export function parsePrice(text: string, currency: Currency): bigint | null | undefined {
  const value = text.trim();
  if (!value) return null;
  try {
    const minor = toMinor(value, currency);
    return minor <= toMinor(MAX_PRICE, currency) ? minor : undefined;
  } catch {
    return undefined;
  }
}

/** Both boxes; null when either is invalid or min > max. */
export function parsePriceRange(min: string, max: string, currency: Currency): { min: bigint | null; max: bigint | null } | null {
  const a = parsePrice(min, currency);
  const b = parsePrice(max, currency);
  if (a === undefined || b === undefined || (a !== null && b !== null && a > b)) return null;
  return { min: a, max: b };
}

/** /s/{slug}/shop with the non-empty params only. */
export function shopHref(slug: string, params: Record<string, string | number | null | undefined>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== null && v !== undefined && v !== "") qs.set(k, String(v));
  const s = qs.toString();
  return `/s/${slug}/shop${s ? `?${s}` : ""}`;
}
