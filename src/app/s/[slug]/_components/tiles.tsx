import { WishButton } from "@/app/_storefront/wishlist";
import { Icon, type IconName } from "@/components/Icon";
import { Badge, ProductCard, cx } from "@/components/ui";
import { fill, type Locale } from "@/i18n/locale";
import { common } from "@/i18n/messages/common";
import { storeMessages } from "@/i18n/messages/store";
import { formatDate, formatMoney, httpsLink, whatsappLink } from "@/lib/format";
import type { StoreProduct, StoreShop } from "./load";

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

/** The shop's shipping & returns terms (Shipping page, and the product page's sheet). */
export function ShippingPolicy({ shop, locale }: { shop: Pick<StoreShop, "name" | "shippingInfo" | "deliveryFeeMinor" | "currency">; locale: Locale }) {
  const m = storeMessages[locale];
  const fee = shop.deliveryFeeMinor;
  return (
    <>
      <p className="mb-3.5 whitespace-pre-line break-words text-sm leading-[1.85] text-sl-muted">{shop.shippingInfo || fill(m.shippingEmpty, { shop: shop.name })}</p>
      <p className="flex items-center gap-2 text-sm font-bold">
        <Icon name="truck" className="size-5 text-sl-accent" />
        {Number(fee) > 0 ? <bdi>{fill(m.deliveryFeeLine, { fee: formatMoney(fee, shop.currency, locale) })}</bdi> : m.freeDelivery}
      </p>
      <p className="mt-1 text-sm text-sl-muted">{m.payOnDelivery}</p>
    </>
  );
}

/** The shop's contact channels (Contact page, home). `omitUnset` drops a network the shop has not set instead of dimming it. */
export function ContactList({ shop, locale, omitUnset }: { shop: Pick<StoreShop, "instagramUrl" | "facebookUrl" | "whatsappPhone">; locale: Locale; omitUnset?: boolean }) {
  const m = storeMessages[locale];
  const t = common[locale];
  const socials = [
    { network: t.instagram, href: httpsLink(shop.instagramUrl), icon: "instagram" as const, tile: "bg-[linear-gradient(45deg,#f9a03f,#d92e7f_55%,#7b3fe4)]" },
    { network: t.facebook, href: httpsLink(shop.facebookUrl), icon: "facebook" as const, tile: "bg-[#1877f2]" },
  ];
  return (
    <ul className={omitUnset ? "grid gap-2.5 sm:auto-cols-fr sm:grid-flow-col" : "my-3.5 grid gap-2.5 min-[360px]:grid-cols-2"}>
      {socials
        .filter((s) => s.href || !omitUnset)
        .map((s) => (
          <li key={s.icon} className="flex">
            {s.href ? (
              <SocialCard
                href={s.href}
                label={`${fill(m.visitLabel, { network: s.network })} (${t.opensNewTab})`}
                icon={s.icon}
                tile={s.tile}
                title={s.network}
                sub={m.visitPage}
              />
            ) : (
              <SocialCard label={fill(m.notConfiguredLabel, { network: s.network })} icon={s.icon} tile={s.tile} title={s.network} sub={m.notConfigured} />
            )}
          </li>
        ))}
      {shop.whatsappPhone && (
        <li className={cx("flex", !omitUnset && "min-[360px]:col-span-2")}>
          <SocialCard
            href={whatsappLink(shop.whatsappPhone, t.whatsappGreeting)}
            label={`${t.whatsappChat} (${t.opensNewTab})`}
            icon="whatsapp"
            tile="bg-sl-whatsapp"
            title={t.whatsapp}
            sub={m.messageThisShop}
          />
        </li>
      )}
    </ul>
  );
}

/** A contact channel tile: a link when the shop set it, otherwise a dimmed "not set up" card. */
function SocialCard({ href, label, icon, tile, title, sub }: { href?: string; label: string; icon: IconName; tile: string; title: string; sub: string }) {
  const inner = (
    <>
      <span aria-hidden className={cx("grid size-[30px] shrink-0 place-items-center rounded-[9px] text-white", tile)}>
        <Icon name={icon} className="size-[18px]" />
      </span>
      <span className="min-w-0">
        <span className="block break-words text-[13px] font-bold">{title}</span>
        <span className="mt-0.5 block text-xs leading-tight text-sl-muted">{sub}</span>
      </span>
    </>
  );
  const box = "flex min-h-[60px] w-full items-center gap-2.5 rounded-sl border border-sl-border bg-sl-bg p-2.5 text-sl-fg";
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className={cx(box, "transition hover:-translate-y-px hover:border-sl-accent")}>
      {inner}
    </a>
  ) : (
    <div role="img" aria-label={label} className={cx(box, "cursor-not-allowed opacity-60")}>
      {inner}
    </div>
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
