import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { WishButton } from "@/app/_storefront/wishlist";
import { Icon } from "@/components/Icon";
import { Card, SectionHeader, Stars } from "@/components/ui";
import { fill } from "@/i18n/locale";
import { common } from "@/i18n/messages/common";
import { storeMessages } from "@/i18n/messages/store";
import { formatDate, formatNumber } from "@/lib/format";
import { plain } from "@/server/http/json";
import { reviewService } from "@/server/services/reviewService";
import { ShopFrame } from "../../../../_storefront/ShopFrame";
import { loadStore } from "../../_components/load";
import { ProductTile } from "../../_components/tiles";
import { Gallery, ProductBar, ProductOptions, ProductProvider } from "./ProductClient";

type Params = { params: Promise<{ slug: string; id: string }> };

const RELATED = 4;

async function load(slug: string, id: string) {
  const data = await loadStore(slug);
  const product = data.products.find((p) => p.id === id);
  if (!product) notFound();
  return { ...data, product };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug, id } = await params;
  const { shop, product } = await load(slug, id);
  return { title: `${product.name} · ${shop.name}`, description: product.description?.slice(0, 160) || undefined };
}

export default async function ProductPage({ params }: Params) {
  const { slug, id } = await params;
  const { shop, products, product } = await load(slug, id);
  const reviews = plain(await reviewService.forProduct(slug, id));
  const locale = shop.locale;
  const m = storeMessages[locale];
  const t = common[locale];
  const base = `/s/${slug}`;

  // Same category first, then the newest of the rest.
  const others = products.filter((p) => p.id !== product.id);
  const related = [...others.filter((p) => product.categoryId && p.categoryId === product.categoryId), ...others.filter((p) => !product.categoryId || p.categoryId !== product.categoryId)].slice(
    0,
    RELATED,
  );
  const specs = product.specs.length
    ? product.specs
    : [
        { label: m.specCategory, value: product.categoryName ?? m.products },
        { label: m.specSoldBy, value: shop.name },
      ];
  const average = formatNumber(reviews.average, locale, 1);

  return (
    <ProductProvider
      product={{ id: product.id, name: product.name, images: product.images, variants: product.variants, customization: product.customization }}
      slug={slug}
      locale={locale}
    >
      <ShopFrame
        shop={shop}
        locale={locale}
        back={{ href: `${base}/shop`, label: m.backToShop }}
        wish={<WishButton slug={slug} productId={product.id} locale={locale} variant="icon" />}
        bar={<ProductBar />}
      >
        <nav aria-label={m.breadcrumb} className="mb-2 text-[13px] font-semibold text-sl-muted">
          <ol className="flex min-w-0 flex-wrap items-center gap-1.5">
            <li>
              <Link href={base} className="inline-flex min-h-11 items-center hover:text-sl-accent">
                {shop.name}
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li className="min-w-0">
              <Link
                href={product.categoryId ? `${base}/shop?cat=${encodeURIComponent(product.categoryId)}` : `${base}/shop`}
                className="inline-flex min-h-11 items-center truncate hover:text-sl-accent"
              >
                {product.categoryName ?? m.products}
              </Link>
            </li>
          </ol>
        </nav>

        <div className="grid gap-5 md:grid-cols-2 md:gap-8">
          <Gallery />
          <div className="min-w-0">
            <h1 className="sl-heading text-[26px] leading-tight">{product.name}</h1>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[13px] text-sl-muted">
              {reviews.count > 0 ? (
                <>
                  <Stars average={reviews.average} label={fill(t.ratingLabel, { n: average })} />
                  <span aria-hidden>{fill(m.reviewSummary, { avg: average, n: reviews.count })}</span>
                  <a href="#reviews" className="inline-flex min-h-11 items-center font-bold text-sl-accent hover:underline">
                    {m.readReviews}
                  </a>
                </>
              ) : (
                <span className="inline-flex min-h-11 items-center">{m.notReviewed}</span>
              )}
            </p>
            <ProductOptions currency={shop.currency} />
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2">
          <Card className="rounded-[14px]">
            <h2 className="sl-heading mb-2 text-lg">{m.descriptionTitle}</h2>
            <p className="whitespace-pre-line break-words text-sm leading-relaxed text-sl-muted">
              {product.description || fill(m.descriptionFallback, { name: product.name, shop: shop.name })}
            </p>
          </Card>

          <Card className="rounded-[14px]">
            <h2 className="sl-heading mb-2.5 text-lg">{m.specsTitle}</h2>
            <dl className="grid grid-cols-2 gap-2.5">
              {specs.map((s, i) => (
                <div key={i} className="min-w-0 rounded-sl bg-sl-cat p-3">
                  <dt className="text-[13px] font-bold">{s.label}</dt>
                  <dd className="mt-1 break-words text-xs leading-snug text-sl-muted">{s.value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card className="flex gap-3 rounded-[14px] md:col-span-2">
            <Icon name="truck" className="size-6 shrink-0 text-sl-accent" />
            <div className="min-w-0 text-sm leading-normal">
              <p>
                <strong>{m.shippingTitle}</strong> · <span className="text-sl-muted">{m.shippingLine}</span>
              </p>
              <Link href={`${base}/info/shipping`} className="inline-flex min-h-11 items-center gap-1.5 text-[13px] font-extrabold text-sl-accent hover:underline">
                {fill(m.shippingLink, { shop: shop.name })}
                <Icon name="arrow" className="size-3.5" />
              </Link>
            </div>
          </Card>

          <Card id="reviews" className="scroll-mt-24 rounded-[14px] md:col-span-2">
            <h2 className="sl-heading mb-1 text-lg">{fill(m.reviewsHeading, { n: reviews.count })}</h2>
            <p className="mb-3 text-xs leading-normal text-sl-muted">{m.reviewsNote}</p>
            {reviews.reviews.length === 0 ? (
              <p className="text-sm text-sl-muted">{m.noReviews}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {reviews.reviews.map((r, i) => (
                  <li key={i} className="rounded-sl bg-sl-cat p-3">
                    <Stars average={r.rating} label={fill(m.starsLabel, { n: r.rating })} />
                    {r.comment && <p className="mt-1 whitespace-pre-line break-words text-sm italic leading-relaxed rtl:not-italic">{r.comment}</p>}
                    <p className="mt-1.5 text-xs text-sl-muted">
                      <bdi>{r.authorName}</bdi> · <span className="font-bold text-sl-ok">{m.verifiedBuyer}</span> · {formatDate(r.createdAt, locale)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {related.length > 0 && (
          <section aria-labelledby="related" className="mt-6">
            <SectionHeader id="related" title={m.relatedTitle} />
            <ul className="sl-scroll-row -mx-4 gap-2.5 px-4 pb-3">
              {related.map((p) => (
                <li key={p.id} className="flex">
                  <ProductTile slug={slug} product={p} currency={shop.currency} locale={locale} layout="strip" />
                </li>
              ))}
            </ul>
          </section>
        )}
      </ShopFrame>
    </ProductProvider>
  );
}
