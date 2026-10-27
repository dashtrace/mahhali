// Pure storefront rules: social links, item customization notes, catalogue browsing
// and reordering. No I/O; the services load the data and call these.

export const LOGO_MODES = ["image-and-name", "image-only", "name-only"] as const;
export const HOME_SECTIONS = ["bestsellers", "new", "featured", "hidden"] as const;
export type LogoMode = (typeof LOGO_MODES)[number];
export type HomeSection = (typeof HOME_SECTIONS)[number];
export const BROWSE_SORTS = ["all", "bestsellers", "new", "featured"] as const;
export type BrowseSort = (typeof BROWSE_SORTS)[number];

export const MAX_SLIDES = 6;
export const MAX_CATEGORIES = 30;

const SOCIAL_HOSTS = {
  instagram: ["instagram.com", "www.instagram.com"],
  facebook: ["facebook.com", "www.facebook.com", "m.facebook.com"],
} as const;

/** An https link to the network's own host, with no login part or port. */
export function isAllowedSocialUrl(network: keyof typeof SOCIAL_HOSTS, value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return (
    url.protocol === "https:" &&
    !url.username &&
    !url.password &&
    !url.port &&
    (SOCIAL_HOSTS[network] as readonly string[]).includes(url.hostname)
  );
}

export type Customization = { label: string | null; required: boolean; maxLength: number };

export type NoteCheck = { ok: true; note: string | null } | { ok: false; code: "CUSTOMIZATION_REQUIRED" | "NOTE_TOO_LONG" };

/**
 * The note to store on an order line. A product without customization drops any
 * note; one that asks for it may require it and caps its length.
 */
export function checkNote(product: Customization, note: string | null | undefined): NoteCheck {
  if (!product.label) return { ok: true, note: null };
  const text = note?.trim() || null;
  if (!text) return product.required ? { ok: false, code: "CUSTOMIZATION_REQUIRED" } : { ok: true, note: null };
  if ([...text].length > product.maxLength) return { ok: false, code: "NOTE_TOO_LONG" };
  return { ok: true, note: text };
}

export type BrowsableProduct = {
  name: string;
  description: string | null;
  categoryId: string | null;
  categoryName: string | null;
  featured: boolean;
  soldCount: number;
  createdAt: Date | string;
  variants: { priceMinor: bigint; inStock: boolean }[];
};

export type BrowseOptions = {
  q?: string;
  categoryId?: string;
  /** Inclusive price range in the shop currency's minor unit. */
  min?: bigint;
  max?: bigint;
  sort?: BrowseSort;
  page?: number;
  pageSize?: number;
};

/** The cheapest in-stock price inside [min, max]; null when no in-stock variant fits. */
export function matchPrice(variants: BrowsableProduct["variants"], min?: bigint, max?: bigint): bigint | null {
  let best: bigint | null = null;
  for (const v of variants) {
    if (!v.inStock || (min !== undefined && v.priceMinor < min) || (max !== undefined && v.priceMinor > max)) continue;
    if (best === null || v.priceMinor < best) best = v.priceMinor;
  }
  return best;
}

const time = (d: Date | string) => new Date(d).getTime();

/**
 * The shop listing: search, category, collection and price filter, then one page.
 * A sold-out variant never makes a product match a price range. The page is
 * clamped to the pages that exist.
 */
export function browseProducts<P extends BrowsableProduct>(products: P[], o: BrowseOptions = {}) {
  const pageSize = o.pageSize ?? 8;
  const q = o.q?.trim().toLocaleLowerCase();
  const priced = o.min !== undefined || o.max !== undefined;
  const matched: (P & { matchPriceMinor: bigint | null })[] = [];
  for (const p of products) {
    if (o.categoryId && p.categoryId !== o.categoryId) continue;
    if (o.sort === "bestsellers" && p.soldCount <= 0) continue;
    if (o.sort === "featured" && !p.featured) continue;
    if (q && ![p.name, p.description, p.categoryName].some((t) => t?.toLocaleLowerCase().includes(q))) continue;
    const matchPriceMinor = matchPrice(p.variants, o.min, o.max);
    if (priced && matchPriceMinor === null) continue;
    matched.push({ ...p, matchPriceMinor });
  }
  matched.sort((a, b) =>
    o.sort === "bestsellers" ? b.soldCount - a.soldCount || time(b.createdAt) - time(a.createdAt) : time(b.createdAt) - time(a.createdAt),
  );
  const total = matched.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const requested = o.page !== undefined && Number.isFinite(o.page) ? Math.floor(o.page) : 1;
  const page = Math.min(Math.max(1, requested), pageCount);
  return { items: matched.slice((page - 1) * pageSize, page * pageSize), total, page, pageCount };
}

/** Ids in their new order after moving `id` to index `to` (clamped). */
export function moveTo(ids: string[], id: string, to: number): string[] {
  const rest = ids.filter((x) => x !== id);
  if (rest.length === ids.length) return ids;
  const at = Math.min(Math.max(0, to), rest.length);
  return [...rest.slice(0, at), id, ...rest.slice(at)];
}
