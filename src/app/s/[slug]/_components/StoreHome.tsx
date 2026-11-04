import type { CSSProperties } from "react";
import Link from "next/link";
import { Reveal } from "@/app/_storefront/Reveal";
import { ArrowOut, Icon, type IconName } from "@/components/Icon";
import { EmptyState, cx } from "@/components/ui";
import { fill } from "@/i18n/locale";
import { common } from "@/i18n/messages/common";
import { storeMessages, type StoreMessages } from "@/i18n/messages/store";
import { httpsLink, whatsappLink } from "@/lib/format";
import { homeHighlight } from "@/server/domain/storefront";
import { FeedbackForm } from "../info/[section]/FeedbackForm";
import { HeroCarousel } from "./HeroCarousel";
import type { StoreData } from "./load";
import { ContactList, HomeTile, TestimonialCard } from "./tiles";

// No directive, no async, no server-only imports: the settings preview renders this in a client component.
// The sl-* classes port the approved storefront's CSS (globals.css).

const SHELF_SIZE = 4;
// One list has to fill the widest window (1900px) at 365px + 18px gap a card, or the loop shows a gap.
const MARQUEE_MIN_CARDS = 5;

/** The owner's highlight strip, with its labels and the "View all" filter on the shop page. */
function highlight({ shop, products }: Pick<StoreData, "shop" | "products">, m: StoreMessages) {
  const h = homeHighlight(products, shop.categories, shop.homeSection, shop.homeCategoryId);
  if (!h) return null;
  if (h.kind === "category") return { eyebrow: m.eyebrowCategory, title: h.category.name, query: `cat=${encodeURIComponent(h.category.id)}`, items: h.items };
  const eyebrow = { bestsellers: m.eyebrowBestsellers, featured: m.eyebrowFeatured, new: m.eyebrowNew }[h.kind];
  const title = { bestsellers: m.sectionBestsellers, featured: m.sectionFeatured, new: m.sectionNew }[h.kind];
  return { eyebrow, title, query: `sort=${h.kind}`, items: h.items };
}

/** The small letter-spaced line and large heading that open every section. */
function Heading({ id, eyebrow, children, className }: { id: string; eyebrow: string; children: string; className?: string }) {
  return (
    <>
      <p className="sl-kicker">{eyebrow}</p>
      <h2 id={id} className={cx("sl-display", className)}>
        {children}
      </h2>
    </>
  );
}

/** The shop's home page under the header, in the agreed order. A section with no data is left out, with any link to it. */
export function StoreHome({ shop, products, testimonials }: StoreData) {
  const locale = shop.locale;
  const m = storeMessages[locale];
  const t = common[locale];
  const base = `/s/${shop.slug}`;
  const section = highlight({ shop, products }, m);
  const about = shop.about?.trim();
  const shipping = shop.shippingInfo?.trim();
  const showTestimonials = shop.showTestimonials && testimonials.length > 0;
  const whatsapp = shop.whatsappPhone ? whatsappLink(shop.whatsappPhone, t.whatsappGreeting) : null;
  const instagram = httpsLink(shop.instagramUrl);
  const facebook = httpsLink(shop.facebookUrl);
  const hasContact = !!(whatsapp || instagram || facebook);

  return (
    <>
      <h1 className="sr-only">{shop.name}</h1>
      <HeroCarousel slides={shop.slides} shopHref={`${base}/shop`} shopName={shop.name} tagline={shop.tagline} locale={locale} />

      {shop.categories.length > 0 && (
        <section aria-labelledby="home-categories" className="sl-shell sl-categories">
          <Reveal>
            <div className="sl-head-center">
              <Heading id="home-categories" eyebrow={m.catEyebrow}>
                {m.catRow}
              </Heading>
            </div>
            <ul className="sl-category-row">
              {shop.categories.map((c) => {
                const photo = products.find((p) => p.categoryId === c.id && p.images[0])?.images[0].url;
                return (
                  <li key={c.id}>
                    <Link href={`${base}/shop?cat=${encodeURIComponent(c.id)}`} title={c.name} className="sl-category">
                      <span aria-hidden className="sl-orb">
                        {photo ? (
                          // eslint-disable-next-line @next/next/no-img-element -- uploaded files are served as-is
                          <img src={photo} alt="" loading="lazy" className="size-full object-cover" />
                        ) : (
                          [...c.name.trim()][0]?.toLocaleUpperCase(locale)
                        )}
                      </span>
                      <span className="sl-category-name">{c.name}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Reveal>
        </section>
      )}

      {section && (
        <section aria-labelledby="home-highlight" className="sl-section">
          <Reveal className="sl-shell">
            <div className="sl-head">
              <div className="min-w-0">
                <Heading id="home-highlight" eyebrow={section.eyebrow}>
                  {section.title}
                </Heading>
              </div>
              <Link href={`${base}/shop?${section.query}`} className="sl-text-link">
                {t.viewAll}
                <Icon name="arrow" className="size-4" />
              </Link>
            </div>
            <ul className="sl-tile-grid">
              {section.items.slice(0, SHELF_SIZE).map((p) => (
                <li key={p.id}>
                  <HomeTile slug={shop.slug} product={p} currency={shop.currency} locale={locale} />
                </li>
              ))}
            </ul>
            {about && (
              <a href="#home-story" className="sl-catalog-link">
                {m.discoverStory}
                <ArrowOut />
              </a>
            )}
          </Reveal>
        </section>
      )}

      {products.length === 0 && (
        <div className="sl-shell py-10">
          <EmptyState title={m.comingSoon} body={m.comingSoonBody} />
        </div>
      )}

      {about && (
        <section id="home-story" aria-labelledby="home-story-title" className="sl-story sl-on-surface">
          <Reveal className="max-w-[700px]">
            <Heading id="home-story-title" eyebrow={m.storyEyebrow} className="sl-story-title">
              {m.storyHeading}
            </Heading>
            <p className="sl-story-text">{about}</p>
            {showTestimonials && (
              <a href="#home-testimonials" className="sl-outline-link">
                {m.readStories}
                <ArrowOut />
              </a>
            )}
          </Reveal>
        </section>
      )}

      {shipping && (
        <section aria-labelledby="home-shipping" className="sl-section sl-policy">
          <Reveal className="sl-shell">
            <div className="max-w-[760px]">
              <Heading id="home-shipping" eyebrow={m.shippingEyebrow}>
                {m.homeShippingTitle}
              </Heading>
              <p className="sl-policy-intro">{m.shippingLead}</p>
            </div>
            <div className="sl-policy-message">
              <span aria-hidden className="sl-policy-rule" />
              <div className="min-w-0 py-1">
                <p className="sl-policy-overline">{fill(m.shippingFrom, { shop: shop.name })}</p>
                <p className="sl-policy-text">{shipping}</p>
              </div>
            </div>
            <div className="sl-policy-contact">
              <span>{m.shippingQuestion}</span>
              <a href={hasContact ? "#home-contact" : `${base}/info/contact`} className="sl-text-link">
                {m.contactHeading}
                <ArrowOut />
              </a>
            </div>
          </Reveal>
        </section>
      )}

      {showTestimonials && (
        <section id="home-testimonials" aria-labelledby="home-testimonials-title" className="sl-section sl-testimonials">
          <Reveal>
            <div className="sl-shell sl-testimonials-intro">
              <Heading id="home-testimonials-title" eyebrow={m.testimonialsEyebrow}>
                {m.testimonialsTitle}
              </Heading>
              <p className="sl-muted">{m.testimonialsIntro}</p>
            </div>
            <Testimonials items={testimonials} locale={locale} labelledBy="home-testimonials-title" />
            <p className="sl-testimonials-note">{m.testimonialsNote}</p>
          </Reveal>
        </section>
      )}

      <section aria-labelledby="home-feedback" className="sl-section">
        <Reveal className="sl-shell sl-feedback">
          <div>
            <Heading id="home-feedback" eyebrow={m.feedbackEyebrow}>
              {m.feedbackHeading}
            </Heading>
            <p className="sl-muted sl-feedback-text">{fill(m.feedbackBody, { shop: shop.name })}</p>
          </div>
          <div className="sl-form-card">
            <FeedbackForm slug={shop.slug} locale={locale} />
          </div>
        </Reveal>
      </section>

      {(whatsapp || instagram) && (
        <section aria-labelledby="home-stay" className="sl-band [&_:focus-visible]:outline-sl-band-ink">
          <Reveal className="sl-band-inner">
            <p className="sl-eyebrow">{m.stayEyebrow}</p>
            <h2 id="home-stay" className="sl-display sl-band-title">
              {m.stayHeading}
            </h2>
            <p className="sl-band-text">{m.stayBody}</p>
            <div className="sl-band-links">
              {whatsapp && <BandLink href={whatsapp} icon="whatsapp" label={t.whatsappChat} newTab={t.opensNewTab} solid />}
              {instagram && <BandLink href={instagram} icon="instagram" label={t.instagram} newTab={t.opensNewTab} solid={!whatsapp} />}
            </div>
          </Reveal>
        </section>
      )}

      {hasContact && (
        <section id="home-contact" aria-labelledby="home-contact-title" className="sl-section sl-contact">
          <Reveal className="sl-shell">
            <div className="sl-contact-head">
              <Heading id="home-contact-title" eyebrow={m.contactEyebrow}>
                {m.contactTitle}
              </Heading>
              <p className="sl-muted">{m.homeContactBody}</p>
            </div>
            <ContactList shop={shop} locale={locale} omitUnset />
          </Reveal>
        </section>
      )}
    </>
  );
}

function BandLink({ href, icon, label, newTab, solid }: { href: string; icon: IconName; label: string; newTab: string; solid?: boolean }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="sl-band-link" data-solid={solid}>
      <Icon name={icon} className="size-[18px]" />
      {label}
      <span className="sr-only">({newTab})</span>
    </a>
  );
}

/** A soft marquee (globals.css). Too few cards to fill the window stay a plain scroll row, as does reduced motion. */
function Testimonials({ items, locale, labelledBy }: { items: StoreData["testimonials"]; locale: StoreData["shop"]["locale"]; labelledBy: string }) {
  const list = "sl-scroll-row sl-quote-row";
  const cards = items.map((x) => (
    <li key={x.id} className="flex shrink-0 snap-start">
      {/* Clipped so one long message can't stretch the row; the About page shows them in full. */}
      <TestimonialCard t={x} locale={locale} />
    </li>
  ));
  if (items.length < MARQUEE_MIN_CARDS) return <ul className={list}>{cards}</ul>;
  return (
    // Focusable, so a keyboard or a tap can hold it still: it has nothing else to focus.
    <div role="group" tabIndex={0} aria-labelledby={labelledBy} className="sl-marquee">
      <div className="sl-marquee-track" style={{ "--sl-marquee-cards": items.length } as CSSProperties}>
        <ul className={list}>{cards}</ul>
        <ul aria-hidden className={list}>
          {cards}
        </ul>
      </div>
    </div>
  );
}
