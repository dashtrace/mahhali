import { WishButton } from "@/app/_storefront/wishlist";
import { Badge, ProductCard, cx } from "@/components/ui";
import type { Locale } from "@/i18n/locale";
import { storeMessages } from "@/i18n/messages/store";
import { formatDate, formatMoney } from "@/lib/format";
import type { StoreProduct } from "./load";

// Shared by the home strips, the shop grid, the wishlist (a client page) and
// "You may also like". No directive, so it renders on either side.

type TileProduct = Pick<StoreProduct, "id" | "name" | "description" | "images" | "variants" | "rating">;

/**
 * One product card. `priceMinor` overrides the shown price (the in-range price
 * under a price filter); otherwise the lowest price, "From …" when they differ.
 */
export function ProductTile({
  slug,
  product,
  currency,
  locale,
  layout,
  priceMinor,
}: {
  slug: string;
  product: TileProduct;
  currency: "USD" | "LBP";
  locale: Locale;
  layout?: "grid" | "strip";
  priceMinor?: number | null;
}) {
  const m = storeMessages[locale];
  const prices = product.variants.map((v) => v.priceMinor);
  const lowest = Math.min(...prices);
  const amount = <bdi className="whitespace-nowrap">{formatMoney(priceMinor ?? lowest, currency, locale)}</bdi>;
  const [before, after] = m.fromPrice.split("{price}");
  return (
    <ProductCard
      href={`/s/${slug}/p/${product.id}`}
      name={product.name}
      image={product.images[0]?.url}
      description={product.description}
      rating={product.rating}
      price={priceMinor == null && prices.some((p) => p !== lowest) ? <>{before}{amount}{after}</> : amount}
      badge={product.variants.some((v) => v.inStock) ? undefined : <Badge tone="red">{m.soldOut}</Badge>}
      wish={<WishButton slug={slug} productId={product.id} locale={locale} />}
      locale={locale}
      layout={layout}
    />
  );
}

/** An approved customer testimonial (home strip, About page). */
export function TestimonialCard({ t, locale, className }: { t: { authorName: string; message: string; createdAt: string }; locale: Locale; className?: string }) {
  return (
    <figure className={cx("flex flex-col rounded-[15px] border border-sl-border bg-sl-panel p-3.5 shadow-[0_2px_10px_#00000006]", className)}>
      <blockquote className="flex-1 whitespace-pre-line break-words text-sm italic leading-relaxed rtl:not-italic">{t.message}</blockquote>
      <figcaption className="mt-2.5 flex items-center justify-between gap-2 text-xs text-sl-muted">
        <strong className="truncate text-sl-fg">{t.authorName}</strong>
        <time dateTime={t.createdAt}>{formatDate(t.createdAt, locale)}</time>
      </figcaption>
    </figure>
  );
}
