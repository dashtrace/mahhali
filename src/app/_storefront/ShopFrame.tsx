import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { cx } from "@/components/ui";
import { dirOf, fill, type Locale } from "@/i18n/locale";
import { common, type CommonMessages } from "@/i18n/messages/common";
import { storeMessages } from "@/i18n/messages/store";
import { httpsLink, nameUnits, whatsappLink } from "@/lib/format";
import { themeTone, themeVars } from "../_server/theme";
import { CartLink } from "./cart";
import { dmSans, playfair } from "./fonts";
import { OverlayHeader, ShopMenu, ShopTopNav, TrackPill, WhatsAppFab } from "./ShopNav";
import { Toast } from "./Toast";
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
  shippingInfo?: string | null;
  showTestimonials?: boolean;
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
 * their own width. `page` uses the approved design's inner-page shell; a string adds that class to it.
 * `fontClass` is for a client parent (the settings preview): next/font names a font differently in each bundle, so the class must come from the server to hydrate.
 */
export function ShopFrame({
  shop,
  locale,
  wish,
  overlay,
  page,
  fontClass,
  children,
}: {
  shop: FrameShop;
  locale: Locale;
  wish?: ReactNode;
  overlay?: "photo" | "band";
  page?: boolean | string;
  fontClass?: string;
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
          <DrawerLinks shop={shop} locale={locale} />
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
      className={cx(fontClass ?? `${playfair.variable} ${dmSans.variable}`, "sl-shop flex min-h-dvh flex-col bg-sl-bg text-sl-fg")}
    >
      {overlay ? (
        <OverlayHeader tone={overlay}>{headerRow}</OverlayHeader>
      ) : (
        <header className="sl-header sticky top-0 z-30">{headerRow}</header>
      )}

      <main className={overlay ? "flex-1" : page ? cx("sl-page flex-1", typeof page === "string" && page) : "mx-auto w-full max-w-6xl flex-1 px-4 py-4"}>{children}</main>

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

      {whatsapp && overlay && <WhatsAppFab href={whatsapp} locale={locale} />}
      <Toast />
    </div>
  );
}

/** Logo per the shop's logoMode; a missing image falls back to the name. */
function ShopLogo({ shop, t }: { shop: FrameShop; t: CommonMessages }) {
  const mode = shop.logoMode ?? "image-and-name";
  const showImage = !!shop.logo && mode !== "name-only";
  const showName = !shop.logo || mode !== "image-only";
  // The phone header leaves about 100vw - 208px beside its buttons: globals.css fits the name to it from its length.
  const chars = nameUnits(shop.name) + (showImage ? 3 : 0);
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

/** The two link groups of the approved menu. A home section the shop has no data for falls back to its info page, or is left out. */
function DrawerLinks({ shop, locale }: { shop: FrameShop; locale: Locale }) {
  const t = common[locale];
  const m = storeMessages[locale];
  const base = `/s/${shop.slug}`;
  const instagram = httpsLink(shop.instagramUrl);
  const groups = [
    {
      title: fill(m.menuExplore, { shop: shop.name }),
      links: [
        { href: base, label: t.navHome },
        !!shop.categories?.length && { href: `${base}#home-categories`, label: t.categories },
        { href: `${base}/shop?sort=new`, label: m.sectionNew },
        { href: shop.about?.trim() ? `${base}#home-story` : `${base}/info/about`, label: t.infoAbout },
        { href: shop.shippingInfo?.trim() ? `${base}#home-shipping` : `${base}/info/shipping`, label: t.infoShipping },
        !!shop.showTestimonials && { href: `${base}/info/about#testimonials`, label: m.menuReviews },
        { href: `${base}#home-feedback`, label: m.menuFeedback },
        !!(shop.whatsappPhone || instagram) && { href: `${base}#home-stay`, label: m.menuStay },
        { href: shop.whatsappPhone || instagram || httpsLink(shop.facebookUrl) ? `${base}#home-contact` : `${base}/info/contact`, label: t.infoContact },
      ],
    },
    {
      title: m.menuShopping,
      links: [
        { href: `${base}/shop`, label: m.menuShop },
        { href: `${base}/wishlist`, label: t.navWishlist },
        { href: `${base}/track`, label: m.menuTrack },
        { href: `${base}/cart`, label: m.menuBag },
      ],
    },
  ];
  return (
    <nav aria-label={t.storeNav}>
      {groups.map((g) => (
        <section key={g.title}>
          <h3 className="sl-drawer-kicker">{g.title}</h3>
          <ul>
            {g.links
              .filter((l) => !!l)
              .map((l) => (
                <li key={l.label}>
                  <Link href={l.href}>{l.label}</Link>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </nav>
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
