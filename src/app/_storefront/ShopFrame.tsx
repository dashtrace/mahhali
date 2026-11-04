import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { IconButtonLink, cx } from "@/components/ui";
import { dirOf, fill, type Locale } from "@/i18n/locale";
import { common, type CommonMessages } from "@/i18n/messages/common";
import { whatsappLink } from "@/lib/format";
import { themeTone, themeVars } from "../_server/theme";
import { CartLink } from "./cart";
import { playfair } from "./fonts";
import { ShopMenu, ShopTopNav, WhatsAppFab } from "./ShopNav";
import { WishLink } from "./wishlist";

export { Stars } from "@/components/ui";

/** What the frame reads from a shop. Pages that load less (tracking, reviews) pass what they have. */
export type FrameShop = {
  name: string;
  slug: string;
  logo: string | null;
  theme: unknown;
  tagline?: string | null;
  logoMode?: string | null;
  whatsappPhone?: string | null;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  categories?: { id: string; name: string }[];
};

export const INFO_SECTIONS = ["about", "shipping", "contact", "feedback"] as const;
const INFO_LABEL = { about: "infoAbout", shipping: "infoShipping", contact: "infoContact", feedback: "infoFeedback" } as const;

// Defence in depth: the API only stores https links on allowlisted hosts.
const https = (url: string | null | undefined) => (url && url.startsWith("https://") ? url : null);

/**
 * The shop's own look and language around every public shop page: header with
 * menu drawer, logo, wishlist / cart; a Track shortcut on phones and a top nav
 * on desktop; footer; WhatsApp button on the home page.
 * `bar` adds a sticky action bar at the bottom (product page: Add to cart / Buy
 * now). `back` swaps the menu button for a back link; `wish` swaps the header
 * wishlist link (product page: a WishButton variant="icon").
 */
export function ShopFrame({
  shop,
  locale,
  bar,
  back,
  wish,
  children,
}: {
  shop: FrameShop;
  locale: Locale;
  bar?: ReactNode;
  back?: { href: string; label: string };
  wish?: ReactNode;
  children: ReactNode;
}) {
  const t = common[locale];
  const base = `/s/${shop.slug}`;
  const whatsapp = shop.whatsappPhone ? whatsappLink(shop.whatsappPhone, t.whatsappGreeting) : null;
  return (
    <div
      lang={locale}
      dir={dirOf(locale)}
      data-tone={themeTone(shop.theme)}
      style={{ ...themeVars(shop.theme), fontFamily: "var(--font-shop)" }}
      className={cx(
        playfair.variable,
        "sl-shop flex min-h-dvh flex-col bg-sl-bg text-sl-fg",
        !!bar && "pb-[calc(76px+env(safe-area-inset-bottom))]",
      )}
    >
      <header className="sticky top-0 z-30 border-b border-sl-border bg-sl-bg/95 backdrop-blur">
        {/* The middle column takes what the buttons leave, so a long name truncates instead of overlapping them. */}
        <div className="mx-auto grid h-[60px] max-w-6xl grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1.5 px-3 md:flex md:gap-4 md:px-4">
          <div className="flex items-center">
            {back ? (
              <IconButtonLink href={back.href} label={back.label} icon="back" />
            ) : (
              <ShopMenu title={shop.name} locale={locale}>
                <DrawerLinks shop={shop} t={t} />
              </ShopMenu>
            )}
          </div>
          <Link href={base} className="flex min-h-11 min-w-0 items-center justify-center">
            <ShopLogo shop={shop} t={t} />
          </Link>
          <ShopTopNav slug={shop.slug} locale={locale} />
          <div className="flex items-center justify-end gap-1 md:ms-auto md:gap-2">
            <Link
              href={`${base}/track`}
              aria-label={t.trackOrder}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-sl border border-sl-border bg-sl-panel px-1.5 text-xs font-bold text-sl-fg md:hidden"
            >
              {t.navTrack}
            </Link>
            {wish ?? <WishLink slug={shop.slug} locale={locale} />}
            <CartLink slug={shop.slug} label={t.navCart} countLabel={t.cartCount} />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-4">{children}</main>

      <footer className="border-t border-sl-border bg-sl-nav">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-sm">
          <div>
            <p className="sl-heading text-lg">{shop.name}</p>
            {shop.tagline && <p className="text-sl-muted">{shop.tagline}</p>}
          </div>
          <ul className="flex flex-wrap gap-x-4">
            {INFO_SECTIONS.map((s) => (
              <li key={s}>
                <Link href={`${base}/info/${s}`} className="inline-flex min-h-11 items-center text-sl-fg hover:text-sl-accent hover:underline">
                  {t[INFO_LABEL[s]]}
                </Link>
              </li>
            ))}
          </ul>
          <Socials shop={shop} t={t} whatsapp={whatsapp} />
          <Link href="/" className="inline-flex min-h-11 items-center self-start text-xs text-sl-muted hover:underline">
            {t.poweredBy}
          </Link>
        </div>
      </footer>

      {bar && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-sl-border bg-sl-nav pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_#00000010]">
          <div className="mx-auto flex max-w-6xl gap-2 px-3.5 py-2.5">{bar}</div>
        </div>
      )}
      {!bar && whatsapp && <WhatsAppFab slug={shop.slug} href={whatsapp} locale={locale} />}
    </div>
  );
}

/** Logo per the shop's logoMode; a missing image falls back to the name. */
function ShopLogo({ shop, t }: { shop: FrameShop; t: CommonMessages }) {
  const mode = shop.logoMode ?? "image-and-name";
  const showImage = !!shop.logo && mode !== "name-only";
  const showName = !shop.logo || mode !== "image-only";
  // The phone header leaves ~150px beside its buttons: long names step down in size and spacing, then truncate.
  const length = [...shop.name].length;
  // Letter-spacing only in Latin script: it breaks Arabic joining.
  const wordmark = length <= 10 ? "text-lg sm:text-xl ltr:tracking-[0.1em]" : length <= 14 ? "text-base ltr:tracking-[0.04em]" : "text-sm";
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      {showImage && (
        // eslint-disable-next-line @next/next/no-img-element -- uploaded files are served as-is
        <img
          src={shop.logo!}
          alt={showName ? "" : fill(t.shopLogo, { name: shop.name })}
          className={showName ? "size-8 shrink-0 object-contain" : "block max-h-[43px] w-auto max-w-[min(100%,168px)] object-contain"}
        />
      )}
      {showName && (
        // Beside a logo the name lines up against it; alone it centres over the tagline.
        <span className={cx("flex min-w-0 flex-col leading-none", showImage ? "items-start" : "items-center")}>
          <span
            className={cx(
              "max-w-full truncate [font-family:var(--sl-heading-font)] [font-weight:var(--sl-heading-weight)] md:max-w-xs md:text-xl md:ltr:tracking-[0.1em]",
              wordmark,
            )}
          >
            {shop.name}
          </span>
          {shop.tagline && (
            // A long tagline only fits on desktop; phones show it in the hero and footer.
            <span
              className={cx(
                "mt-1 max-w-full truncate text-[10px] font-bold uppercase tracking-[0.15em] text-sl-muted rtl:tracking-normal md:block md:max-w-xs",
                [...shop.tagline].length > 22 && "hidden",
              )}
            >
              {shop.tagline}
            </span>
          )}
        </span>
      )}
    </span>
  );
}

const drawerItem = "flex min-h-12 w-full items-center gap-3 border-b border-sl-border text-[15px] text-sl-fg hover:text-sl-accent";
const drawerHeading = "mb-1 mt-5 text-xs font-bold uppercase tracking-wide text-sl-muted rtl:tracking-normal";

function DrawerLinks({ shop, t }: { shop: FrameShop; t: CommonMessages }) {
  const base = `/s/${shop.slug}`;
  const main: { href: string; label: string; icon: IconName }[] = [
    { href: base, label: t.navHome, icon: "home" },
    { href: `${base}/shop`, label: t.navShop, icon: "grid" },
    { href: `${base}/cart`, label: t.navCart, icon: "cart" },
    { href: `${base}/wishlist`, label: t.navWishlist, icon: "heart" },
    { href: `${base}/track`, label: t.trackOrder, icon: "box" },
  ];
  const whatsapp = shop.whatsappPhone ? whatsappLink(shop.whatsappPhone, t.whatsappGreeting) : null;
  return (
    <nav aria-label={t.storeNav}>
      <ul>
        {main.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className={drawerItem}>
              <Icon name={l.icon} className="size-5 text-sl-accent" />
              {l.label}
            </Link>
          </li>
        ))}
        {whatsapp && (
          <li>
            <a href={whatsapp} target="_blank" rel="noopener noreferrer" aria-label={`${t.whatsappChat} (${t.opensNewTab})`} className={drawerItem}>
              <Icon name="whatsapp" className="size-5 text-sl-accent" />
              {t.whatsappChat}
            </a>
          </li>
        )}
      </ul>
      {!!shop.categories?.length && (
        <>
          <h3 className={drawerHeading}>{t.categories}</h3>
          <ul>
            {shop.categories.map((c) => (
              <li key={c.id}>
                <Link href={`${base}/shop?cat=${encodeURIComponent(c.id)}`} className={drawerItem}>
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
      <h3 className={drawerHeading}>{t.shopInfo}</h3>
      <ul>
        {INFO_SECTIONS.map((s) => (
          <li key={s}>
            <Link href={`${base}/info/${s}`} className={drawerItem}>
              {t[INFO_LABEL[s]]}
            </Link>
          </li>
        ))}
      </ul>
      <Socials shop={shop} t={t} whatsapp={null} className="mt-5" />
    </nav>
  );
}

/** Instagram / Facebook / WhatsApp icon links, only those the shop set. */
function Socials({ shop, t, whatsapp, className }: { shop: FrameShop; t: CommonMessages; whatsapp: string | null; className?: string }) {
  const links = [
    { href: https(shop.instagramUrl), label: t.instagram, icon: "instagram" as const },
    { href: https(shop.facebookUrl), label: t.facebook, icon: "facebook" as const },
    { href: whatsapp, label: t.whatsapp, icon: "whatsapp" as const },
  ].filter((l): l is { href: string; label: string; icon: "instagram" | "facebook" | "whatsapp" } => !!l.href);
  if (!links.length) return null;
  return (
    <ul aria-label={t.followUs} className={cx("flex gap-2", className)}>
      {links.map((l) => (
        <li key={l.icon}>
          <a
            href={l.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${l.label} (${t.opensNewTab})`}
            className="grid size-11 place-items-center rounded-sl border border-sl-border bg-sl-panel text-sl-fg transition hover:-translate-y-px hover:border-sl-accent"
          >
            <Icon name={l.icon} />
          </a>
        </li>
      ))}
    </ul>
  );
}

/** A page with one message, for links that no longer work (no shop to dress it in). */
export function Notice({ locale, title, body }: { locale: Locale; title: string; body?: string }) {
  return (
    <main lang={locale} dir={dirOf(locale)} className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-2 px-4 py-16 text-center">
      <h1 className="sl-heading text-2xl">{title}</h1>
      {body && <p className="text-sm leading-normal text-sl-muted">{body}</p>}
      <Link href="/" className="mt-4 inline-flex min-h-11 items-center justify-center text-sm font-bold text-sl-accent hover:underline">
        {common[locale].appName}
      </Link>
    </main>
  );
}
