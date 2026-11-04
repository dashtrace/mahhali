import Link from "next/link";
import type { ReactNode } from "react";
import { fill, type Locale } from "@/i18n/locale";
import { common } from "@/i18n/messages/common";
import { storeMessages } from "@/i18n/messages/store";
import { formatMonth, formatNumber } from "@/lib/format";
import type { StoreProduct, StoreShop } from "../../_components/load";
import { ProductTile, ShippingPolicy, type TileProduct } from "../../_components/tiles";
import { Gallery, ProductActions, ProductOptions, ProductPrice, ProductProvider } from "./ProductClient";

type Review = { rating: number; comment?: string | null; authorName: string; createdAt: string };

const RELATED = 4;

const firstSentence =(text: string) => text.split(/(?<=[.!?؟])\s|\n/)[0];

/** "You may also like": same category first, then the newest of the rest. */
export function relatedTo<P extends Pick<StoreProduct, "id" | "categoryId">>(products: P[], product: Pick<StoreProduct, "id" | "categoryId">) {
  const others = products.filter((p) => p.id !== product.id);
  return [...others.filter((p) => product.categoryId && p.categoryId === product.categoryId), ...others.filter((p) => !product.categoryId || p.categoryId !== product.categoryId)].slice(0, RELATED);
}

/** Filled and empty stars as in the approved design; the label is what a screen reader hears. */
function StarRow({ rating, label }: { rating: number; label: string }) {
  const full = Math.round(rating);
  return (
    <span className="sl-stars">
      <span aria-hidden>{"★".repeat(full) + "☆".repeat(5 - full)}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

/** One accordion row. */
function Accordion({ title, open, children }: { title: string; open?: boolean; children: ReactNode }) {
  return (
    <details open={open}>
      <summary>
        {title}
        <span aria-hidden className="sl-plus" />
      </summary>
      <div className="sl-accordion-body">{children}</div>
    </details>
  );
}

/**
 * Everything under the product page's header. It only renders what it is given
 * (the page loads the data), so it can also render inside a client-side preview.
 */
export function ProductContent({
  slug,
  shop,
  product,
  reviews,
  related,
  locale,
}: {
  slug: string;
  shop: Pick<StoreShop, "name" | "shippingInfo" | "deliveryFeeMinor" | "currency">;
  product: Pick<StoreProduct, "id" | "name" | "description" | "options" | "images" | "variants" | "customization" | "categoryName" | "specs">;
  reviews: { count: number; average: number; reviews: Review[] };
  related: TileProduct[];
  locale: Locale;
}) {
  const m = storeMessages[locale];
  const t = common[locale];
  const average = formatNumber(reviews.average, locale, 1);
  // Each only when the shop filled it in; the first one starts open.
  const sections = [
    product.description && {
      title: m.detailAbout,
      body: <p className="whitespace-pre-line break-words">{product.description}</p>,
    },
    product.specs.length > 0 && {
      title: m.detailDetails,
      body: (
        <dl>
          {product.specs.map((s, i) => (
            <div key={i}>
              <dt>{s.label}</dt>
              <dd>{s.value}</dd>
            </div>
          ))}
        </dl>
      ),
    },
    shop.shippingInfo && { title: m.shippingTitle, body: <ShippingPolicy shop={shop} locale={locale} /> },
  ].filter((s) => !!s);

  return (
    <ProductProvider
      product={{ id: product.id, name: product.name, options: product.options, images: product.images, variants: product.variants, customization: product.customization }}
      slug={slug}
      locale={locale}
    >
      <nav aria-label={m.breadcrumb} className="sl-crumbs">
        <Link href={`/s/${slug}/shop`}>{m.allProducts}</Link>
        <span aria-hidden> / </span>
        <span>{product.name}</span>
      </nav>

      <div className="sl-detail">
        <Gallery collection={fill(m.galleryCollection, { shop: shop.name })} />
        <div className="sl-detail-content">
          {product.categoryName && <p className="sl-page-eyebrow">{product.categoryName}</p>}
          <h1 className="sl-page-title sl-detail-title">{product.name}</h1>
          {reviews.count > 0 && (
            <p className="sl-detail-rating">
              <StarRow rating={reviews.average} label={fill(t.ratingLabel, { n: average })} />
              <span aria-hidden>{average} ·</span>
              <a href="#reviews">{fill(m.reviewCount, { n: reviews.count })}</a>
            </p>
          )}
          <ProductPrice currency={shop.currency} />
          {product.description && <p className="sl-detail-short">{firstSentence(product.description)}</p>}
          <ProductOptions currency={shop.currency} />
          <ProductActions />
          {sections.length > 0 && (
            <div className="sl-accordions">
              {sections.map((s, i) => (
                <Accordion key={s.title} title={s.title} open={i === 0}>
                  {s.body}
                </Accordion>
              ))}
            </div>
          )}
        </div>
      </div>

      <section id="reviews" className="sl-below-detail">
        <p className="sl-page-eyebrow">{m.reviewsEyebrow}</p>
        <h2 className="sl-section-title">{m.reviewsHeading}</h2>
        <p className="sl-below-note">{reviews.count > 0 ? m.reviewsNote : m.noReviews}</p>
        {reviews.reviews.length > 0 && (
          <ul className="sl-review-lines">
            {reviews.reviews.map((r, i) => (
              <li key={i}>
                <StarRow rating={r.rating} label={fill(m.starsLabel, { n: r.rating })} />
                {r.comment && <p className="whitespace-pre-line break-words">{r.comment}</p>}
                <small>
                  <bdi>{r.authorName}</bdi> · {m.verifiedBuyer} · {formatMonth(r.createdAt, locale)}
                </small>
              </li>
            ))}
          </ul>
        )}
      </section>

      {related.length > 0 && (
        <section aria-labelledby="related" className="sl-below-detail sl-related">
          <p className="sl-page-eyebrow">{m.relatedEyebrow}</p>
          <h2 id="related" className="sl-section-title">
            {m.relatedTitle}
          </h2>
          <ul className="sl-card-grid">
            {related.map((p) => (
              <li key={p.id}>
                <ProductTile slug={slug} product={p} currency={shop.currency} locale={locale} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </ProductProvider>
  );
}
