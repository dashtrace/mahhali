import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { cx } from "@/components/ui";
import { dirOf, fill, type Locale } from "@/i18n/locale";
import { common, type CommonMessages } from "@/i18n/messages/common";
import { storeMessages } from "@/i18n/messages/store";
import { httpsLink, whatsappLink } from "@/lib/format";
import { themeTone, themeVars } from "../_server/theme";
import { CartLink } from "./cart";
import { dmSans, playfair } from "./fonts";
import { OverlayHeader, ShopMenu, ShopTopNav, TrackPill, WhatsAppFab } from "./ShopNav";
import { WishLink } from "./wishlist";

export { Stars } from "@/components/ui";

/** What the frame reads from a shop. Pages that load less (tracking, reviews) pass what they have. */
export type FrameShop = {
  name: string;
  slug: string;
  logo: string | null;
  theme: unknown;
  tagline?: string | null;
  about?: string | null;
  logoMode?: string | null;
  whatsappPhone?: string | null;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  categories?: { id: string; name: string }[];
};

export const INFO_SECTIONS = ["about", "shipping", "contact", "feedback"] as const;
const INFO_LABEL = { about: "infoAbout", shipping: "infoShipping", contact: "infoContact", feedback: "infoFeedback" } as const;

/**
 * The shop's own look and language around every public shop page: header with
 * menu drawer, brand, wishlist / bag; a Track shortcut on phones and text links
 * on desktop; footer; WhatsApp button on the home page.
 * `wish` swaps the header wishlist link (product page: a WishButton variant="icon").
 * `overlay` (home page) floats the header over a full-width hero: "photo" for a
 * slide, "band" for the themed hero of a shop without slides. Children then lay out
 * their own width. `page` uses the approved design's inner-page shell.
 */
export function ShopFrame({
  shop,
  locale,
  wish,
  overlay,
  page,
  children,
}: {
  shop: FrameShop;
  locale: Locale;
  wish?: ReactNode;
  overlay?: "photo" | "band";
  page?: boolean;
  children: ReactNode;
}) {
  const t = common[locale];
  const base = `/s/${shop.slug}`;
  const whatsapp = shop.whatsappPhone ? whatsappLink(shop.whatsappPhone, t.whatsappGreeting) : null;
  const startLinks = [
    ...(shop.categories?.length ? [{ href: `${base}#home-categories`, label: t.categories }] : []),
    { href: `${base}/shop`, label: t.navShop, tab: "shop" as const },
  ];
  const endLinks = [
    { href: shop.about?.trim() ? `${base}#home-story` : `${base}/info/about`, label: storeMessages[locale].storyEyebrow },
    { href: `${base}/track`, label: t.trackOrder, tab: "track" as const },
  ];
  const headerRow = (
    // The middle column takes what the sides leave, so a long name truncates instead of overlapping them.
    <div className="sl-nav">
      <div className="sl-nav-edge">
        <ShopMenu title={shop.name} locale={locale}>
          <DrawerLinks shop={shop} t={t} />
        </ShopMenu>
        <TrackPill slug={shop.slug} locale={locale} />
        <ShopTopNav slug={shop.slug} label={t.storeNav} links={startLinks} />
      </div>
      <Link href={base} className="sl-brand">
        <ShopLogo shop={shop} t={t} />
      </Link>
      <div className="sl-nav-edge justify-end">
        <ShopTopNav slug={shop.slug} label={t.shopInfo} links={endLinks} />
        {wish ?? <WishLink slug={shop.slug} locale={locale} className="sl-nav-btn" />}
        <CartLink slug={shop.slug} label={t.navCart} countLabel={t.cartCount} className="sl-nav-btn" />
      </div>
    </div>
  );
  return (
    <div
      lang={locale}
      dir={dirOf(locale)}
      data-tone={themeTone(shop.theme)}
      style={{ ...themeVars(shop.theme), fontFamily: "var(--font-shop)" }}
      className={cx(playfair.variable, dmSans.variable, "sl-shop flex min-h-dvh flex-col bg-sl-bg text-sl-fg")}
    >
      {overlay ? (
        <OverlayHeader tone={overlay}>{headerRow}</OverlayHeader>
      ) : (
        <header className="sl-header sticky top-0 z-30">{headerRow}</header>
      )}

      <main className={overlay ? "flex-1" : page ? "sl-page flex-1" : "mx-auto w-full max-w-6xl flex-1 px-4 py-4"}>{children}</main>

      <footer className="sl-footer sl-on-surface">
        <p className="sl-footer-name">{shop.name}</p>
        {shop.tagline && <p className="sl-footer-tag">{shop.tagline}</p>}
        <nav aria-label={t.shopInfo}>
          <ul className="sl-footer-links">
            {INFO_SECTIONS.map((s) => (
              <li key={s}>
                <Link href={`${base}/info/${s}`}>{t[INFO_LABEL[s]]}</Link>
              </li>
            ))}
            <li>
              <Link href={`${base}/track`}>{t.trackOrder}</Link>
            </li>
          </ul>
        </nav>
        {/* On the home page the centred line stays clear of the floating WhatsApp button. */}
        <div className={cx("sl-legal", overlay && whatsapp && "max-[700px]:px-[66px]")}>
          <span>{shop.name}</span>
          <Link href="/">{t.poweredBy}</Link>
        </div>
      </footer>

      {whatsapp && <WhatsAppFab slug={shop.slug} href={whatsapp} locale={locale} />}
    </div>
  );
}

/** Logo per the shop's logoMode; a missing image falls back to the name. */
function ShopLogo({ shop, t }: { shop: FrameShop; t: CommonMessages }) {
  const mode = shop.logoMode ?? "image-and-name";
  const showImage = !!shop.logo && mode !== "name-only";
  const showName = !shop.logo || mode !== "image-only";
  // The phone header leaves about 100vw - 208px beside its buttons: globals.css fits the name to it from its length.
  const chars = [...shop.name].length + (showImage ? 3 : 0);
  return (
    <span className="flex min-w-0 items-center justify-center gap-1.5">
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
        <span className={cx("flex min-w-0 flex-col", showImage ? "items-start" : "items-center")}>
          <span className="sl-brand-name" style={{ "--sl-brand-chars": chars } as CSSProperties}>
            {shop.name}
          </span>
          {shop.tagline && (
            // A long tagline only fits on desktop; phones show it in the hero and footer.
            <span className={cx("sl-brand-tag", [...shop.tagline].length > 28 && "max-[700px]:hidden")}>{shop.tagline}</span>
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
    { href: `${base}/cart`, label: t.navCart, icon: "bag" },
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
      <Socials shop={shop} t={t} className="mt-5" />
    </nav>
  );
}

/** Instagram / Facebook icon links, only those the shop set. */
function Socials({ shop, t, className }: { shop: FrameShop; t: CommonMessages; className?: string }) {
  const links = [
    { href: httpsLink(shop.instagramUrl), label: t.instagram, icon: "instagram" as const },
    { href: httpsLink(shop.facebookUrl), label: t.facebook, icon: "facebook" as const },
  ].filter((l): l is { href: string; label: string; icon: "instagram" | "facebook" } => !!l.href);
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
