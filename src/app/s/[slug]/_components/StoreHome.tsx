import type { CSSProperties } from "react";
import Link from "next/link";
import { Reveal } from "@/app/_storefront/Reveal";
import { Icon, type IconName } from "@/components/Icon";
import { Card, EmptyState, SectionHeader, cx } from "@/components/ui";
import { fill } from "@/i18n/locale";
import { common } from "@/i18n/messages/common";
import { storeMessages, type StoreMessages } from "@/i18n/messages/store";
import { httpsLink, whatsappLink } from "@/lib/format";
import { homeHighlight } from "@/server/domain/storefront";
import { FeedbackForm } from "../info/[section]/FeedbackForm";
import { HeroCarousel } from "./HeroCarousel";
import type { StoreData } from "./load";
import { ContactList, ProductTile, ShippingPolicy, TestimonialCard } from "./tiles";

// No directive, no async, no server-only imports: the settings preview renders this in a client component.

const STRIP_SIZE = 8;
// One list has to fill the widest window (max-w-6xl) at 270px a card, or the loop shows a gap.
const MARQUEE_MIN_CARDS = 5;

const wrap = "mx-auto w-full max-w-6xl px-4";
const space = "py-10 md:py-16";
const heading = "sl-heading text-[22px] leading-tight md:text-3xl";
const headerSize = "md:[&_h2]:text-3xl";
const textLink = "inline-flex min-h-11 items-center gap-1.5 text-[13px] font-bold";

/** The owner's highlight strip, with its title and the "View all" filter on the shop page. */
function highlight({ shop, products }: Pick<StoreData, "shop" | "products">, m: StoreMessages) {
  const h = homeHighlight(products, shop.categories, shop.homeSection, shop.homeCategoryId);
  if (!h) return null;
  if (h.kind === "category") return { title: h.category.name, query: `cat=${encodeURIComponent(h.category.id)}`, items: h.items };
  const title = { bestsellers: m.sectionBestsellers, featured: m.sectionFeatured, new: m.sectionNew }[h.kind];
  return { title, query: `sort=${h.kind}`, items: h.items };
}

/** The shop's home page under the header, in the agreed order. A section with no data is left out, with any link to it. */
export function StoreHome({ shop, products, testimonials }: StoreData) {
  const locale = shop.locale;
  const m = storeMessages[locale];
  const t = common[locale];
  const base = `/s/${shop.slug}`;
  const section = highlight({ shop, products }, m);
  const about = shop.about?.trim();
  const showTestimonials = shop.showTestimonials && testimonials.length > 0;
  const whatsapp = shop.whatsappPhone ? whatsappLink(shop.whatsappPhone, t.whatsappGreeting) : null;
  const instagram = httpsLink(shop.instagramUrl);
  const facebook = httpsLink(shop.facebookUrl);

  return (
    <>
      <h1 className="sr-only">{shop.name}</h1>
      <HeroCarousel slides={shop.slides} shopHref={`${base}/shop`} shopName={shop.name} tagline={shop.tagline} locale={locale} />

      {shop.categories.length > 0 && (
        <section aria-labelledby="home-categories" className="pt-10 md:pt-16">
          <Reveal className={wrap}>
            <SectionHeader id="home-categories" title={m.catRow} className={headerSize} />
            <ul className="sl-scroll-row -mx-4 gap-3.5 px-4 pb-1 pt-1">
              {shop.categories.map((c) => {
                const photo = products.find((p) => p.categoryId === c.id && p.images[0])?.images[0].url;
                return (
                  // The auto margins centre a short row without cutting off the start of a long one.
                  <li key={c.id} className="w-[88px] shrink-0 snap-start first:ms-auto last:me-auto md:w-28">
                    <Link href={`${base}/shop?cat=${encodeURIComponent(c.id)}`} title={c.name} className="block text-center">
                      <span aria-hidden className="sl-heading mx-auto mb-2 grid size-[72px] place-items-center overflow-hidden rounded-full border border-sl-line bg-sl-cat text-2xl text-sl-accent md:size-24">
                        {photo ? (
                          // eslint-disable-next-line @next/next/no-img-element -- uploaded files are served as-is
                          <img src={photo} alt="" loading="lazy" className="size-full object-cover" />
                        ) : (
                          [...c.name.trim()][0]?.toLocaleUpperCase(locale)
                        )}
                      </span>
                      <span className="line-clamp-2 break-words text-[13px] leading-tight">{c.name}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Reveal>
        </section>
      )}

      {section && (
        <section aria-labelledby="home-highlight" className={space}>
          <Reveal className={wrap}>
            <SectionHeader id="home-highlight" title={section.title} href={`${base}/shop?${section.query}`} linkLabel={t.viewAll} className={headerSize} />
            <ul className="sl-scroll-row -mx-4 gap-2.5 px-4 pb-3">
              {section.items.slice(0, STRIP_SIZE).map((p) => (
                <li key={p.id} className="flex">
                  <ProductTile slug={shop.slug} product={p} currency={shop.currency} locale={locale} layout="strip" />
                </li>
              ))}
            </ul>
            {about && (
              <a href="#home-story" className={cx(textLink, "text-sl-accent hover:underline")}>
                {m.discoverStory}
                <Icon name="arrow" className="size-4" />
              </a>
            )}
          </Reveal>
        </section>
      )}

      {products.length === 0 && (
        <div className={cx(wrap, "py-10")}>
          <EmptyState title={m.comingSoon} body={m.comingSoonBody} />
        </div>
      )}

      {about && (
        <section id="home-story" aria-labelledby="home-story-title" className="scroll-mt-14 bg-sl-surface py-14 md:py-20">
          <Reveal className="mx-auto max-w-2xl px-5 text-center">
            <h2 id="home-story-title" className="sl-heading text-3xl leading-tight md:text-5xl">
              {m.storyHeading}
            </h2>
            <span aria-hidden className="mx-auto my-5 block h-px w-12 bg-sl-ornament" />
            <p className="whitespace-pre-line break-words leading-[1.9]">{about}</p>
            {showTestimonials && (
              <a href="#home-testimonials" className={cx(textLink, "mt-5 underline underline-offset-4")}>
                {m.readStories}
                <Icon name="arrow" className="size-4" />
              </a>
            )}
          </Reveal>
        </section>
      )}

      {shop.shippingInfo?.trim() && (
        <section aria-labelledby="home-shipping" className={cx(space, "border-t border-sl-line")}>
          <Reveal className="mx-auto max-w-2xl px-4">
            <h2 id="home-shipping" className={cx(heading, "mb-4")}>
              {t.infoShipping}
            </h2>
            <ShippingPolicy shop={shop} locale={locale} />
          </Reveal>
        </section>
      )}

      {showTestimonials && (
        <section id="home-testimonials" aria-labelledby="home-testimonials-title" className={cx("scroll-mt-14 bg-sl-surface", space)}>
          <Reveal>
            <div className={wrap}>
              {/* On the surface colour links and notes take the body text colour: neither primary nor muted is checked against it. */}
              <SectionHeader
                id="home-testimonials-title"
                title={m.testimonialsTitle}
                href={about ? `${base}/info/about` : undefined}
                linkLabel={m.aboutLink}
                className={cx(headerSize, "[&_a]:text-sl-fg")}
              />
              <p className="-mt-1 mb-4 text-xs leading-normal">{m.testimonialsNote}</p>
            </div>
            <Testimonials items={testimonials} locale={locale} labelledBy="home-testimonials-title" />
          </Reveal>
        </section>
      )}

      <section aria-labelledby="home-feedback" className={cx(space, "border-t border-sl-line")}>
        <Reveal className={cx(wrap, "grid items-start gap-6 md:grid-cols-2 md:gap-12")}>
          <div>
            <h2 id="home-feedback" className={cx(heading, "mb-3")}>
              {m.feedbackHeading}
            </h2>
            <p className="text-sm leading-[1.85] text-sl-muted">{fill(m.feedbackBody, { shop: shop.name })}</p>
          </div>
          <Card className="border-sl-line">
            <FeedbackForm slug={shop.slug} locale={locale} />
          </Card>
        </Reveal>
      </section>

      {(whatsapp || instagram) && (
        <section aria-labelledby="home-stay" className="bg-sl-band text-sl-band-ink [&_:focus-visible]:outline-sl-band-ink">
          <Reveal className="mx-auto max-w-2xl px-5 py-14 text-center md:py-20">
            <h2 id="home-stay" className="sl-heading text-3xl leading-tight md:text-5xl">
              {m.stayHeading}
            </h2>
            <span aria-hidden className="mx-auto my-5 block h-px w-12 bg-sl-ornament" />
            <p className="mb-6 leading-relaxed">{m.stayBody}</p>
            <div className="flex flex-wrap justify-center gap-2.5">
              {whatsapp && <BandLink href={whatsapp} icon="whatsapp" label={t.whatsappChat} newTab={t.opensNewTab} />}
              {instagram && <BandLink href={instagram} icon="instagram" label={t.instagram} newTab={t.opensNewTab} />}
            </div>
          </Reveal>
        </section>
      )}

      {(whatsapp || instagram || facebook) && (
        <section aria-labelledby="home-contact" className={space}>
          <Reveal className="mx-auto max-w-2xl px-4">
            <h2 id="home-contact" className={cx(heading, "mb-3")}>
              {m.contactHeading}
            </h2>
            <p className="mb-5 text-sm leading-[1.85] text-sl-muted">{fill(m.contactBody, { shop: shop.name })}</p>
            <ContactList shop={shop} locale={locale} omitUnset />
          </Reveal>
        </section>
      )}
    </>
  );
}

function BandLink({ href, icon, label, newTab }: { href: string; icon: IconName; label: string; newTab: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center gap-2 rounded-sl border border-current px-5 text-sm font-bold transition hover:-translate-y-px">
      <Icon name={icon} className="size-5" />
      {label}
      <span className="sr-only">({newTab})</span>
    </a>
  );
}

/** A soft marquee (globals.css). Too few cards to fill the window stay a plain scroll row, as does reduced motion. */
function Testimonials({ items, locale, labelledBy }: { items: StoreData["testimonials"]; locale: StoreData["shop"]["locale"]; labelledBy: string }) {
  const list = "sl-scroll-row gap-2.5 px-4 pb-3 pt-1";
  const cards = items.map((x) => (
    <li key={x.id} className="flex w-[260px] shrink-0 snap-start">
      {/* Clipped so one long message can't stretch the row; the About page shows them in full. */}
      <TestimonialCard t={x} locale={locale} className="w-full border-sl-line [&_blockquote]:line-clamp-6" />
    </li>
  ));
  if (items.length < MARQUEE_MIN_CARDS) return <ul className={cx(list, "mx-auto max-w-6xl")}>{cards}</ul>;
  return (
    // Focusable, so a keyboard or a tap can hold it still: it has nothing else to focus.
    <div role="group" tabIndex={0} aria-labelledby={labelledBy} className="sl-marquee mx-auto max-w-6xl">
      <div className="sl-marquee-track" style={{ "--sl-marquee-cards": items.length } as CSSProperties}>
        <ul className={list}>{cards}</ul>
        <ul aria-hidden className={list}>
          {cards}
        </ul>
      </div>
    </div>
  );
}
