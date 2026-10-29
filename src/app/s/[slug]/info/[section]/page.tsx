import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { Alert, ButtonLink, Card, EmptyState, FilterChip, cx } from "@/components/ui";
import { fill } from "@/i18n/locale";
import { common } from "@/i18n/messages/common";
import { storeMessages } from "@/i18n/messages/store";
import { formatMoney, whatsappLink } from "@/lib/format";
import { INFO_SECTIONS, ShopFrame } from "../../../../_storefront/ShopFrame";
import { loadStore } from "../../_components/load";
import { TestimonialCard } from "../../_components/tiles";
import { FeedbackForm } from "./FeedbackForm";

type Section = (typeof INFO_SECTIONS)[number];
type Params = { params: Promise<{ slug: string; section: string }> };

const TITLE = { about: "infoAbout", shipping: "infoShipping", contact: "infoContact", feedback: "infoFeedback" } as const;

function sectionOf(value: string): Section {
  if (!(INFO_SECTIONS as readonly string[]).includes(value)) notFound();
  return value as Section;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug, section } = await params;
  const { shop } = await loadStore(slug);
  return { title: `${common[shop.locale][TITLE[sectionOf(section)]]} · ${shop.name}` };
}

const h2 = "sl-heading mb-3 text-xl leading-snug";
const body = "mb-3.5 whitespace-pre-line break-words text-sm leading-[1.85] text-sl-muted";

/** The shop's About, Shipping, Contact and Feedback pages; the content is the owner's. */
export default async function InfoPage({ params }: Params) {
  const { slug, section: raw } = await params;
  const section = sectionOf(raw);
  const { shop, testimonials } = await loadStore(slug);
  const locale = shop.locale;
  const m = storeMessages[locale];
  const t = common[locale];
  const base = `/s/${slug}`;
  const intro = { about: m.aboutIntro, shipping: m.shippingIntro, contact: m.contactIntro, feedback: m.feedbackIntro }[section];

  let content: ReactNode;
  if (section === "about") {
    content = (
      <>
        <h2 className={h2}>{fill(m.aboutWelcome, { shop: shop.name })}</h2>
        <p className={body}>{shop.about || fill(m.aboutEmpty, { shop: shop.name })}</p>
        {shop.showTestimonials && (
          <section aria-labelledby="testimonials" className="mt-7">
            <h2 id="testimonials" className={cx(h2, "mb-1.5")}>
              {m.testimonialsTitle}
            </h2>
            <p className="mb-3 text-xs leading-normal text-sl-muted">{m.testimonialsNote}</p>
            {testimonials.length ? (
              <ul className="grid gap-2.5 sm:grid-cols-2">
                {testimonials.map((x) => (
                  <li key={x.id} className="flex">
                    <TestimonialCard t={x} locale={locale} className="w-full" />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title={m.testimonialsEmpty} />
            )}
            <p className="mt-3 rounded-sl-sm bg-sl-cat px-3 py-2 text-xs leading-normal text-sl-muted">{m.testimonialsConsent}</p>
          </section>
        )}
        <ButtonLink href={`${base}/info/feedback`} tone="outline" className="mt-4">
          {m.shareFeedback}
          <Icon name="arrow" className="size-4" />
        </ButtonLink>
      </>
    );
  } else if (section === "shipping") {
    const fee = shop.deliveryFeeMinor;
    content = (
      <>
        <h2 className={h2}>{m.shippingHeading}</h2>
        <p className={body}>{shop.shippingInfo || fill(m.shippingEmpty, { shop: shop.name })}</p>
        <p className="flex items-center gap-2 text-sm font-bold">
          <Icon name="truck" className="size-5 text-sl-accent" />
          {Number(fee) > 0 ? <bdi>{fill(m.deliveryFeeLine, { fee: formatMoney(fee, shop.currency, locale) })}</bdi> : m.freeDelivery}
        </p>
        <p className="mt-1 text-sm text-sl-muted">{m.payOnDelivery}</p>
        <Alert tone="note" className="mt-4 text-[13px]">
          {m.shippingNote}
        </Alert>
      </>
    );
  } else if (section === "contact") {
    const socials = [
      { network: t.instagram, href: shop.instagramUrl, icon: "instagram" as const, tile: "bg-[linear-gradient(45deg,#f9a03f,#d92e7f_55%,#7b3fe4)]" },
      { network: t.facebook, href: shop.facebookUrl, icon: "facebook" as const, tile: "bg-[#1877f2]" },
    ];
    content = (
      <>
        <h2 className={h2}>{m.contactHeading}</h2>
        <p className={body}>{fill(m.contactBody, { shop: shop.name })}</p>
        <h2 className={cx(h2, "mt-5")}>{m.followHeading}</h2>
        <ul className="my-3.5 grid gap-2.5 min-[360px]:grid-cols-2">
          {socials.map((s) => (
            <li key={s.icon} className="flex">
              {/* Defence in depth: the API only stores https links on the networks' own hosts. */}
              {s.href?.startsWith("https://") ? (
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
            <li className="flex min-[360px]:col-span-2">
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
        <p className="text-xs leading-normal text-sl-muted">{m.contactNote}</p>
      </>
    );
  } else {
    content = (
      <>
        <h2 className={h2}>{m.feedbackHeading}</h2>
        <p className={body}>{fill(m.feedbackBody, { shop: shop.name })}</p>
        <FeedbackForm slug={slug} locale={locale} />
      </>
    );
  }

  return (
    <ShopFrame shop={shop} locale={locale}>
      <nav aria-label={t.shopInfo} className="mb-3">
        {/* Wraps rather than scrolls: four chips, and the current one must never sit half off-screen. */}
        <ul className="flex flex-wrap gap-2 py-1">
          {INFO_SECTIONS.map((s) => (
            <li key={s}>
              <FilterChip href={`${base}/info/${s}`} selected={s === section}>
                {t[TITLE[s]]}
              </FilterChip>
            </li>
          ))}
        </ul>
      </nav>
      <div className="mx-auto max-w-2xl">
        <header className="mb-4 mt-2">
          <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.17em] text-sl-accent rtl:tracking-normal">{fill(m.infoEyebrow, { shop: shop.name })}</p>
          <h1 className="sl-heading mb-2 text-[28px] leading-tight">{t[TITLE[section]]}</h1>
          <p className="text-sm leading-relaxed text-sl-muted">{intro}</p>
        </header>
        <Card className="min-h-40 rounded-[17px] px-4 py-5 shadow-[0_8px_24px_rgba(0,0,0,0.035)] sm:px-6">{content}</Card>
      </div>
    </ShopFrame>
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
