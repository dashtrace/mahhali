import type { Metadata } from "next";
import { attempt } from "@/app/_storefront/data";
import { storeMessages } from "@/i18n/messages/store";
import { BROWSE_SORTS, type BrowseSort } from "@/server/domain/storefront";
import { plain } from "@/server/http/json";
import { catalogueService } from "@/server/services/productService";
import { ShopFrame } from "../../../_storefront/ShopFrame";
import { parsePriceRange } from "../_components/browse";
import { loadStore } from "../_components/load";
import { ShopCatalogue } from "../_components/ShopCatalogue";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

const PAGE_SIZE = 8;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { shop } = await loadStore((await params).slug);
  return { title: `${storeMessages[shop.locale].allProducts} · ${shop.name}` };
}

/** The catalogue page: reads the filters from the URL (search, collection, category, price range, page) and loads the matching products. */
export default async function ShopListingPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const { shop, products } = await loadStore(slug);

  // Anything unknown or malformed in the URL is ignored rather than an error.
  const q = one(sp.q).trim().slice(0, 100);
  const cat = shop.categories.find((c) => c.id === one(sp.cat));
  const sort: BrowseSort = (BROWSE_SORTS as readonly string[]).includes(one(sp.sort)) ? (one(sp.sort) as BrowseSort) : "all";
  const range = parsePriceRange(one(sp.min), one(sp.max), shop.currency);
  const priced = !!range && (range.min !== null || range.max !== null);

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

  return (
    <ShopFrame shop={shop} locale={shop.locale} page>
      <ShopCatalogue
        slug={slug}
        shopName={shop.name}
        categories={shop.categories}
        currency={shop.currency}
        locale={shop.locale}
        filters={{
          q: q || undefined,
          cat: cat?.id,
          sort: sort === "all" ? undefined : sort,
          min: priced ? one(sp.min).trim() || undefined : undefined,
          max: priced ? one(sp.max).trim() || undefined : undefined,
        }}
        listing={{ items, total, page, pageCount, pageSize: PAGE_SIZE }}
        shopHasProducts={products.length > 0}
        collections={{ bestsellers: products.some((p) => p.soldCount > 0), featured: products.some((p) => p.featured) }}
      />
    </ShopFrame>
  );
}
