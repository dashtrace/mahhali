import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Icon } from "@/components/Icon";
import { ButtonLink, Card, EmptyState, FilterChip, cx } from "@/components/ui";
import { fill } from "@/i18n/locale";
import { common } from "@/i18n/messages/common";
import { storeMessages } from "@/i18n/messages/store";
import { INFO_SECTIONS, ShopFrame } from "../../../../_storefront/ShopFrame";
import { loadStore } from "../../_components/load";
import { ContactList, ShippingPolicy, TestimonialCard } from "../../_components/tiles";
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
          </section>
        )}
        <ButtonLink href={`${base}/info/feedback`} tone="outline" className="mt-4">
          {m.shareFeedback}
          <Icon name="arrow" className="size-4" />
        </ButtonLink>
      </>
    );
  } else if (section === "shipping") {
    content = (
      <>
        <h2 className={h2}>{m.shippingHeading}</h2>
        <ShippingPolicy shop={shop} locale={locale} />
      </>
    );
  } else if (section === "contact") {
    content = (
      <>
        <h2 className={h2}>{m.contactHeading}</h2>
        <p className={body}>{fill(m.contactBody, { shop: shop.name })}</p>
        <h2 className={cx(h2, "mt-5")}>{m.followHeading}</h2>
        <ContactList shop={shop} locale={locale} />
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
          <h1 className="sl-heading mb-2 text-[22px] leading-tight sm:text-[28px]">{t[TITLE[section]]}</h1>
          <p className="text-sm leading-relaxed text-sl-muted">{intro}</p>
        </header>
        <Card className="min-h-40 rounded-[17px] px-4 py-5 shadow-[0_8px_24px_rgba(0,0,0,0.035)] sm:px-6">{content}</Card>
      </div>
    </ShopFrame>
  );
}
