import type { Metadata } from "next";
import Link from "next/link";
import { attempt } from "@/app/_storefront/data";
import { Icon } from "@/components/Icon";
import { ButtonLink, EmptyState, FilterChip, Pagination } from "@/components/ui";
import { fill } from "@/i18n/locale";
import { storeMessages } from "@/i18n/messages/store";
import { formatMoney } from "@/lib/format";
import { BROWSE_SORTS, type BrowseSort } from "@/server/domain/storefront";
import { plain } from "@/server/http/json";
import { catalogueService } from "@/server/services/productService";
import { ShopFrame } from "../../../_storefront/ShopFrame";
import { parsePriceRange, shopHref } from "../_components/browse";
import { loadStore } from "../_components/load";
import { ProductTile } from "../_components/tiles";
import { PriceFilter } from "./PriceFilter";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

const PAGE_SIZE = 8;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { shop } = await loadStore((await params).slug);
  return { title: `${storeMessages[shop.locale].allProducts} · ${shop.name}` };
}

/** The catalogue: search, collection or category chips, price range and pages, all in the URL. */
export default async function ShopListingPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const { shop, products } = await loadStore(slug);
  const locale = shop.locale;
  const m = storeMessages[locale];

  // Anything unknown or malformed in the URL is ignored rather than an error.
  const q = one(sp.q).trim().slice(0, 100);
  const cat = shop.categories.find((c) => c.id === one(sp.cat));
  const sort: BrowseSort = (BROWSE_SORTS as readonly string[]).includes(one(sp.sort)) ? (one(sp.sort) as BrowseSort) : "all";
  const range = parsePriceRange(one(sp.min), one(sp.max), shop.currency);
  const priced = !!range && (range.min !== null || range.max !== null);
  const minText = priced ? one(sp.min).trim() : "";
  const maxText = priced ? one(sp.max).trim() : "";

  const res = await attempt(
    catalogueService.browse(slug, {
      q: q || undefined,
      categoryId: cat?.id,
      min: range?.min ?? undefined,
      max: range?.max ?? undefined,
      sort,
      page: Number.parseInt(one(sp.page), 10),
      pageSize: PAGE_SIZE,
    }),
  );
  if (!res.ok) throw res.error;
  const { items, total, page, pageCount } = plain(res.data);

  const keep = { q: q || undefined, cat: cat?.id, sort: sort === "all" ? undefined : sort };
  const price = { min: minText, max: maxText };
  const bound = (v: bigint | null | undefined) => (v == null ? m.anyBound : formatMoney(v, shop.currency, locale));
  const summary = priced ? `${bound(range?.min)} – ${bound(range?.max)}` : m.anyPrice;
  const title = cat?.name ?? { all: m.allProducts, bestsellers: m.sectionBestsellers, new: m.sectionNew, featured: m.sectionFeatured }[sort];
  const plainCollection = !cat && (sort === "all" || sort === "new");
  const first = (page - 1) * PAGE_SIZE + 1;

  return (
    <ShopFrame shop={shop} locale={locale}>
      <h1 className="sl-heading mb-3 mt-1 text-[26px] leading-tight">{title}</h1>

      <form
        action={`/s/${slug}/shop`}
        role="search"
        className="mb-3 flex h-11 items-center gap-2.5 rounded-full border border-sl-border bg-sl-panel px-3.5 shadow-[0_4px_15px_#15181d05] focus-within:outline-2 focus-within:outline-sl-accent"
      >
        <Icon name="search" className="size-[18px] shrink-0 text-sl-muted" />
        <input
          type="search"
          name="q"
          defaultValue={q}
          maxLength={100}
          aria-label={m.searchLabel}
          placeholder={m.searchPlaceholder}
          enterKeyHint="search"
          className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-sl-muted sm:text-sm"
        />
        {/* Searching starts over from all products but keeps the price range. */}
        {minText && <input type="hidden" name="min" value={minText} />}
        {maxText && <input type="hidden" name="max" value={maxText} />}
      </form>

      {q && (
        <p className="mb-2 flex flex-wrap items-center gap-x-2 text-sm">
          <bdi className="font-bold">{fill(m.resultsFor, { q })}</bdi>
          <Link href={shopHref(slug, { ...keep, q: undefined, ...price })} className="inline-flex min-h-11 items-center gap-1 text-[13px] font-bold text-sl-accent">
            {m.clearSearch}
            <Icon name="x" className="size-3.5" />
          </Link>
        </p>
      )}

      <nav aria-label={m.filtersLabel} className="mb-3">
        <ul className="sl-scroll-row -mx-4 gap-2 px-4 py-1">
          <li className="snap-start">
            <FilterChip href={shopHref(slug, price)} selected={plainCollection}>
              {m.allProducts}
            </FilterChip>
          </li>
          <li className="snap-start">
            <FilterChip href={shopHref(slug, { sort: "bestsellers", ...price })} selected={!cat && sort === "bestsellers"}>
              {m.sectionBestsellers}
            </FilterChip>
          </li>
          {(sort === "featured" || products.some((p) => p.featured)) && (
            <li className="snap-start">
              <FilterChip href={shopHref(slug, { sort: "featured", ...price })} selected={!cat && sort === "featured"}>
                {m.sectionFeatured}
              </FilterChip>
            </li>
          )}
          {shop.categories.map((c) => (
            <li key={c.id} className="snap-start">
              <FilterChip href={shopHref(slug, { cat: c.id, ...price })} selected={cat?.id === c.id}>
                {c.name}
              </FilterChip>
            </li>
          ))}
        </ul>
      </nav>

      <PriceFilter key={`${minText}|${maxText}`} slug={slug} currency={shop.currency} locale={locale} keep={keep} min={minText} max={maxText} summary={summary} />

      <p aria-live="polite" className="mb-3 text-[13px] text-sl-muted">
        {total > 0 ? fill(m.showing, { a: first, b: first + items.length - 1, n: total }) : m.noMatches}
        {priced && <bdi>{` · ${summary}`}</bdi>}
      </p>

      {items.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((p) => (
            <li key={p.id} className="flex">
              <ProductTile slug={slug} product={p} currency={shop.currency} locale={locale} priceMinor={priced ? p.matchPriceMinor : undefined} />
            </li>
          ))}
        </ul>
      ) : products.length === 0 ? (
        <EmptyState title={m.comingSoon} body={m.comingSoonBody} />
      ) : (
        <EmptyState
          title={m.emptyFilters}
          body={m.emptyFiltersBody}
          action={
            <ButtonLink href={`/s/${slug}/shop`} tone="secondary">
              {m.clearAll}
            </ButtonLink>
          }
        />
      )}

      <Pagination
        page={page}
        pageCount={pageCount}
        hrefFor={(p) => shopHref(slug, { ...keep, ...price, page: p > 1 ? p : undefined })}
        locale={locale}
        summary={fill(m.pageSummary, { page, pages: pageCount, n: total })}
      />
    </ShopFrame>
  );
}
