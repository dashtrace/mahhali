import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Pagination } from "@/components/ui";
import { fill, type Locale } from "@/i18n/locale";
import { storeMessages } from "@/i18n/messages/store";
import { formatMoney } from "@/lib/format";
import { PriceFilter } from "../shop/PriceFilter";
import { filterHref, parsePriceRange, shopHref, type BrowseFilters } from "./browse";
import { PageEmpty, PageHead, ProductTile, type TileProduct } from "./tiles";

/**
 * The catalogue itself: heading, search, chips, price filter, count and grid. It
 * only renders what it is given and every filter is a plain URL, so it needs
 * nothing from the server and can also render inside a client-side preview.
 */
export function ShopCatalogue({
  slug,
  shopName,
  categories,
  currency,
  locale,
  filters,
  listing,
  shopHasProducts,
  collections,
}: {
  slug: string;
  shopName: string;
  categories: { id: string; name: string }[];
  currency: "USD" | "LBP";
  locale: Locale;
  /** Only filters that were valid in the URL. */
  filters: BrowseFilters;
  listing: { items: (TileProduct & { matchPriceMinor?: number | null })[]; total: number; page: number; pageCount: number; pageSize: number };
  shopHasProducts: boolean;
  /** Which collection chips to offer: an empty collection isn't shown to a new shop. */
  collections: { bestsellers: boolean; featured: boolean };
}) {
  const m = storeMessages[locale];
  const { q, cat, sort, min = "", max = "" } = filters;
  const { items, total, page, pageCount, pageSize } = listing;
  const range = parsePriceRange(min, max, currency);
  const priced = !!(min || max);
  const bound = (v: bigint | null | undefined) => (v == null ? m.anyBound : formatMoney(v, currency, locale));
  const summary = priced ? `${bound(range?.min)} – ${bound(range?.max)}` : m.anyPrice;
  const category = categories.find((c) => c.id === cat);
  const sortTitles: Record<string, string> = { bestsellers: m.sectionBestsellers, new: m.sectionNew, featured: m.sectionFeatured };
  const title = category?.name ?? (sort && sortTitles[sort]) ?? m.allProducts;
  const filtered = !!(q || cat || sort || priced);
  const first = (page - 1) * pageSize + 1;
  // A chip adds its filter and keeps the rest; tapping a selected chip takes it off again.
  const sortChip = (value: string, label: string) => (
    <li>
      <Link href={filterHref(slug, filters, { sort: sort === value ? undefined : value })} aria-current={sort === value ? "true" : undefined} className="sl-pill">
        {label}
      </Link>
    </li>
  );

  return (
    <>
      <PageHead eyebrow={fill(m.shopEyebrow, { shop: shopName })} title={title} lead={m.shopLead} />

      <div className="sl-shop-tools">
        <form action={`/s/${slug}/shop`} role="search" className="sl-search">
          <Icon name="search" />
          <input type="search" name="q" defaultValue={q} maxLength={100} aria-label={m.searchLabel} placeholder={m.searchPlaceholder} enterKeyHint="search" />
          {/* A new search keeps the category, collection and price range. */}
          {(["cat", "sort", "min", "max"] as const).map((k) => filters[k] && <input key={k} type="hidden" name={k} value={filters[k]} />)}
        </form>

        {q && (
          <p className="sl-filter-note">
            <bdi className="font-bold">{fill(m.resultsFor, { q })}</bdi>
            <Link href={filterHref(slug, filters, { q: undefined })}>
              {m.clearSearch}
              <Icon name="x" className="size-3.5" />
            </Link>
          </p>
        )}

        <nav aria-label={m.filtersLabel}>
          <ul className="sl-filter-row">
            <li>
              <Link href={filterHref(slug, filters, { cat: undefined, sort: undefined })} aria-current={!cat && !sort ? "true" : undefined} className="sl-pill">
                {m.allProducts}
              </Link>
            </li>
            {sortChip("new", m.sectionNew)}
            {categories.map((c) => (
              <li key={c.id}>
                <Link href={filterHref(slug, filters, { cat: cat === c.id ? undefined : c.id })} aria-current={cat === c.id ? "true" : undefined} className="sl-pill">
                  {c.name}
                </Link>
              </li>
            ))}
            {(sort === "bestsellers" || collections.bestsellers) && sortChip("bestsellers", m.sectionBestsellers)}
            {(sort === "featured" || collections.featured) && sortChip("featured", m.sectionFeatured)}
          </ul>
        </nav>

        <PriceFilter key={`${min}|${max}`} slug={slug} currency={currency} locale={locale} filters={filters} min={min} max={max} summary={summary} />

        {/* A shop with no products gets only the "coming soon" message below. */}
        {shopHasProducts && (
          <p aria-live="polite" className="sl-result-label">
            <span>
              {total > 0 ? fill(m.showing, { a: first, b: first + items.length - 1, n: total }) : m.noMatches}
              {priced && <bdi>{` · ${summary}`}</bdi>}
            </span>
            {filtered && (
              <Link href={shopHref(slug, {})} aria-label={m.clearAll}>
                {m.priceReset}
              </Link>
            )}
          </p>
        )}
      </div>

      {items.length > 0 ? (
        <ul className="sl-card-grid sl-card-grid-tall">
          {items.map((p) => (
            <li key={p.id}>
              <ProductTile slug={slug} product={p} currency={currency} locale={locale} priceMinor={priced ? p.matchPriceMinor : undefined} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="sl-shop-tools">
          {shopHasProducts ? (
            <PageEmpty
              title={m.emptyFilters}
              body={m.emptyFiltersBody}
              action={
                <Link href={shopHref(slug, {})} className="sl-reset-filters">
                  {m.clearAll}
                </Link>
              }
            />
          ) : (
            <PageEmpty title={m.comingSoon} body={m.comingSoonBody} />
          )}
        </div>
      )}

      <Pagination page={page} pageCount={pageCount} hrefFor={(p) => shopHref(slug, { ...filters, page: p > 1 ? p : undefined })} locale={locale} summary={fill(m.pageSummary, { page, pages: pageCount, n: total })} />
    </>
  );
}
