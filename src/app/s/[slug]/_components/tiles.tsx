import Link from "next/link";
import type { ReactNode } from "react";
import { WishButton } from "@/app/_storefront/wishlist";
import { Icon, type IconName } from "@/components/Icon";
import { Badge, ProductPhoto, cx } from "@/components/ui";
import { fill, type Locale } from "@/i18n/locale";
import { common } from "@/i18n/messages/common";
import { storeMessages } from "@/i18n/messages/store";
import { formatMoney, formatMonth, httpsLink, whatsappLink } from "@/lib/format";
import type { StoreProduct, StoreShop } from "./load";
import { QuickAdd } from "./QuickAdd";

// Shared by the home strips, the shop grid, the wishlist (a client page) and
// "You may also like". No directive, so it renders on either side.

export type TileProduct = Pick<StoreProduct, "id" | "name" | "description" | "images" | "variants" | "categoryName" | "customization">;

/**
 * One product card: the photo and the name link to the product, with the heart
 * and add button beside them, not inside a link. `priceMinor` overrides the shown
 * price (the in-range price under a price filter); otherwise the lowest price,
 * "From …" when they differ.
 */
export function ProductTile({ slug, product, currency, locale, priceMinor }: { slug: string; product: TileProduct; currency: "USD" | "LBP"; locale: Locale; priceMinor?: number | null }) {
  const href = `/s/${slug}/p/${product.id}`;
  return (
    <article className="sl-card">
      <div className="sl-card-photo">
        {/* The name below is the same link for keyboards and screen readers. */}
        <Link href={href} tabIndex={-1} aria-hidden className="block size-full">
          <ProductPhoto src={product.images[0]?.url} name={product.name} loading="lazy" />
        </Link>
        {!product.variants.some((v) => v.inStock) && (
          <div className="absolute start-2 top-2">
            <Badge tone="red">{storeMessages[locale].soldOut}</Badge>
          </div>
        )}
        <div className="sl-card-heart">
          <WishButton slug={slug} productId={product.id} locale={locale} />
        </div>
      </div>
      <div className="sl-card-info">
        {product.categoryName && <p className="sl-card-type">{product.categoryName}</p>}
        <h3 className="sl-card-name">
          <Link href={href}>{product.name}</Link>
        </h3>
        {product.description && <p className="sl-card-desc">{product.description}</p>}
        <div className="sl-card-row">
          <strong className="min-w-0">{tilePrice(product, currency, locale, priceMinor)}</strong>
          <QuickAdd slug={slug} product={product} locale={locale} />
        </div>
      </div>
    </article>
  );
}

/** The inner pages' opening: small kicker, big heading with an accent full stop, one line of lead. */
export function PageHead({ eyebrow, title, lead }: { eyebrow: ReactNode; title: ReactNode; lead?: ReactNode }) {
  return (
    <>
      <p className="sl-page-eyebrow">{eyebrow}</p>
      <h1 className="sl-page-title">
        {title}
        <span aria-hidden className="sl-dot">
          .
        </span>
      </h1>
      {lead && <p className="sl-page-lead">{lead}</p>}
    </>
  );
}

/** An inner page with nothing to show (empty bag, no saved products, no matches). */
export function PageEmpty({ title, body, action }: { title: ReactNode; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="sl-empty">
      <h2>{title}</h2>
      {body && <p>{body}</p>}
      {action}
    </div>
  );
}

function tilePrice(product: Pick<TileProduct, "variants">, currency: "USD" | "LBP", locale: Locale, priceMinor?: number | null) {
  const prices = product.variants.map((v) => v.priceMinor);
  const lowest = Math.min(...prices);
  const amount = <bdi className="whitespace-nowrap">{formatMoney(priceMinor ?? lowest, currency, locale)}</bdi>;
  const [before, after] = storeMessages[locale].fromPrice.split("{price}");
  return priceMinor == null && prices.some((p) => p !== lowest) ? <>{before}{amount}{after}</> : amount;
}

/** The home page's borderless card: the photo and the name link to the product, with the heart and add button beside them, not inside a link. */
export function HomeTile({ slug, product, currency, locale }: { slug: string; product: StoreProduct; currency: "USD" | "LBP"; locale: Locale }) {
  const href = `/s/${slug}/p/${product.id}`;
  return (
    <article className="sl-tile">
      <div className="sl-tile-photo">
        {/* The name below is the same link for keyboards and screen readers. */}
        <Link href={href} tabIndex={-1} aria-hidden className="block size-full">
          <ProductPhoto src={product.images[0]?.url} name={product.name} loading="lazy" />
        </Link>
        {!product.variants.some((v) => v.inStock) && (
          <div className="absolute start-2 top-2">
            <Badge tone="red">{storeMessages[locale].soldOut}</Badge>
          </div>
        )}
        <div className="absolute end-[3.5px] top-[3.5px]">
          <WishButton slug={slug} productId={product.id} locale={locale} />
        </div>
      </div>
      <div className="sl-tile-info">
        {product.categoryName && <p className="sl-tile-type">{product.categoryName}</p>}
        <h3 className="sl-tile-name">
          <Link href={href}>{product.name}</Link>
        </h3>
        <div className="sl-tile-row">
          <span className="sl-tile-price">{tilePrice(product, currency, locale)}</span>
          <QuickAdd slug={slug} product={product} locale={locale} />
        </div>
      </div>
    </article>
  );
}

/** The shop's shipping & returns terms (Shipping page, and the product page's accordion). */
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
    { network: t.instagram, href: httpsLink(shop.instagramUrl), icon: "instagram" as const },
    { network: t.facebook, href: httpsLink(shop.facebookUrl), icon: "facebook" as const },
  ];
  return (
    <ul className={omitUnset ? "sl-contact-grid" : "my-3.5 grid gap-2.5 min-[701px]:grid-cols-2"}>
      {socials
        .filter((s) => s.href || !omitUnset)
        .map((s) => (
          <li key={s.icon} className="flex">
            {s.href ? (
              <SocialCard
                href={s.href}
                label={`${fill(m.visitLabel, { network: s.network })} (${t.opensNewTab})`}
                icon={s.icon}
                title={s.network}
                sub={m.visitPage}
              />
            ) : (
              <SocialCard label={fill(m.notConfiguredLabel, { network: s.network })} icon={s.icon} title={s.network} sub={m.notConfigured} />
            )}
          </li>
        ))}
      {shop.whatsappPhone && (
        <li className={cx("flex", !omitUnset && "min-[701px]:col-span-2")}>
          <SocialCard
            href={whatsappLink(shop.whatsappPhone, t.whatsappGreeting)}
            label={`${t.whatsappChat} (${t.opensNewTab})`}
            icon="whatsapp"
            title={t.whatsapp}
            sub={m.messageThisShop}
          />
        </li>
      )}
    </ul>
  );
}

/** A contact channel tile: a link when the shop set it, otherwise a dimmed "not set up" card. */
function SocialCard({ href, label, icon, title, sub }: { href?: string; label: string; icon: IconName; title: string; sub: string }) {
  const inner = (
    <>
      {/* Text glyphs as in the approved design; WhatsApp keeps its own mark. */}
      <span aria-hidden className="sl-contact-icon">
        {icon === "instagram" ? "◎" : icon === "facebook" ? "f" : <Icon name={icon} />}
      </span>
      <span className="min-w-0">
        <b>{title}</b>
        <small>{sub}</small>
      </span>
    </>
  );
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className="sl-contact-card">
      {inner}
    </a>
  ) : (
    <div role="img" aria-label={label} className="sl-contact-card cursor-not-allowed opacity-60">
      {inner}
    </div>
  );
}

/** An approved customer testimonial (home strip, About page). */
export function TestimonialCard({ t, locale, className }: { t: { authorName: string; message: string; createdAt: string }; locale: Locale; className?: string }) {
  return (
    <figure className={cx("sl-quote sl-on-surface", className)}>
      <span aria-hidden className="sl-quote-mark">
        “
      </span>
      <blockquote>{t.message}</blockquote>
      <figcaption>
        <strong className="truncate">{t.authorName}</strong>
        <time dateTime={t.createdAt}>{formatMonth(t.createdAt, locale)}</time>
      </figcaption>
    </figure>
  );
}
