import type { Metadata } from "next";
import Link from "next/link";
import { Badge, EmptyState } from "@/components/ui";
import { fill } from "@/i18n/locale";
import { storeMessages } from "@/i18n/messages/store";
import { formatMoney } from "@/lib/format";
import { loadCatalogue } from "../../_storefront/data";
import { ShopFrame, Stars } from "../../_storefront/ShopFrame";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { shop } = await loadCatalogue((await params).slug);
  return { title: shop.name };
}

export default async function CataloguePage({ params }: Params) {
  const { slug } = await params;
  const { shop, products } = await loadCatalogue(slug);
  const locale = shop.locale;
  const m = storeMessages[locale];

  return (
    <ShopFrame shop={shop} locale={locale} cart>
      <h1 className="mb-4 text-2xl font-semibold">{shop.name}</h1>
      {products.length === 0 ? (
        <EmptyState title={m.noProducts} body={m.noProductsBody} />
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => {
            const inStock = p.variants.some((v) => v.inStock);
            const prices = p.variants.map((v) => v.priceMinor);
            const min = Math.min(...prices);
            const price = formatMoney(min, shop.currency, locale);
            return (
              <li key={p.id}>
                <Link
                  href={`/s/${slug}/p/${p.id}`}
                  className="flex h-full flex-col overflow-hidden rounded-[var(--radius)] border border-stone-200 bg-white text-stone-900 shadow-sm"
                >
                  <div className="relative aspect-square bg-stone-100">
                    {p.images[0] && (
                      // eslint-disable-next-line @next/next/no-img-element -- uploaded files are served as-is
                      <img src={p.images[0].url} alt="" loading="lazy" className="size-full object-cover" />
                    )}
                    {!inStock && <Badge className="absolute start-2 top-2">{m.outOfStock}</Badge>}
                  </div>
                  <div className="flex flex-1 flex-col gap-1 p-3">
                    <span className="line-clamp-2 text-sm font-medium">{p.name}</span>
                    <span className="text-sm font-semibold tabular-nums">
                      {prices.some((x) => x !== min) ? fill(m.fromPrice, { price }) : price}
                    </span>
                    {p.rating.count > 0 && (
                      <Stars
                        average={p.rating.average}
                        count={p.rating.count}
                        label={fill(m.rated, { avg: p.rating.average.toFixed(1), n: p.rating.count })}
                      />
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </ShopFrame>
  );
}
