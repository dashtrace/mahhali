import Link from "next/link";
import { Badge, Card, EmptyState, FilterChip, PageHeader, Segmented, Stars, cx } from "@/components/ui";
import { fill, type Locale } from "@/i18n/locale";
import { common } from "@/i18n/messages/common";
import { reviewMessages } from "@/i18n/messages/money";
import { shopMessages } from "@/i18n/messages/shop";
import { getLocale } from "@/i18n/server";
import { formatDate } from "@/lib/format";
import { can } from "@/server/domain/policy";
import type { Actor } from "@/server/http/withRoute";
import { reviewService } from "@/server/services/reviewService";
import { testimonialService } from "@/server/services/storefrontService";
import { pageActor } from "../../_server/session";
import { ModerateButton } from "./ModerateButton";
import { TestimonialActions } from "./TestimonialActions";

export const metadata = { title: "Reviews" };

const REVIEW_FILTERS = ["", "PUBLISHED", "HIDDEN"] as const;
const TESTIMONIAL_FILTERS = ["PENDING", "APPROVED", "REJECTED"] as const;
const TESTIMONIAL_TONES = { PENDING: "amber", APPROVED: "green", REJECTED: "neutral" } as const;

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<{ status?: string; tab?: string }> }) {
  const actor = await pageActor("review.read", "/dashboard/reviews");
  const sp = await searchParams;
  const locale = await getLocale();
  const m = reviewMessages[locale];
  const s = shopMessages[locale];
  const testimonials = sp.tab === "testimonials";

  return (
    <>
      <PageHeader title={m.title} subtitle={testimonials ? s.testimonialsSubtitle : m.subtitle} />
      <Segmented
        label={s.reviewsTabs}
        className="mb-3 max-w-md"
        items={[
          { label: s.productReviewsTab, href: "/dashboard/reviews", current: !testimonials },
          { label: s.testimonialsTab, href: "/dashboard/reviews?tab=testimonials", current: testimonials },
        ]}
      />
      {testimonials ? <Testimonials actor={actor} status={sp.status} locale={locale} /> : <ProductReviews actor={actor} status={sp.status} locale={locale} />}
    </>
  );
}

async function ProductReviews({ actor, status: raw, locale }: { actor: Actor; status?: string; locale: Locale }) {
  const m = reviewMessages[locale];
  const t = common[locale];
  const status = raw === "PUBLISHED" || raw === "HIDDEN" ? raw : undefined;
  const reviews = await reviewService.list(actor, status);
  const moderate = can(actor.role, "review.moderate");
  const filterLabel = { "": t.all, PUBLISHED: m.published, HIDDEN: m.hidden };

  return (
    <>
      <nav aria-label={m.title} className="sl-scroll-row -mx-4 mb-4 gap-2 px-4 pb-1">
        {REVIEW_FILTERS.map((f) => (
          <FilterChip key={f} href={f ? `/dashboard/reviews?status=${f}` : "/dashboard/reviews"} selected={(status ?? "") === f}>
            {filterLabel[f]}
          </FilterChip>
        ))}
      </nav>

      {reviews.length === 0 ? (
        <EmptyState title={m.empty} body={m.emptyHint} />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {reviews.map((r) => {
            const hidden = r.status === "HIDDEN";
            return (
              <li key={r.id}>
                <Card className={cx("flex h-full flex-col gap-2", hidden && "border-dashed border-sl-control bg-sl-bg")}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Stars average={r.rating} label={fill(m.stars, { n: r.rating })} className="text-base" />
                    {hidden && <Badge>{m.hidden}</Badge>}
                  </div>
                  <p className="font-bold">{r.product.name}</p>
                  <p className={cx("whitespace-pre-line break-words text-sm leading-relaxed", r.comment ? "text-sl-fg" : "italic text-sl-muted")}>{r.comment ?? m.noComment}</p>
                  <p className="flex flex-wrap items-center gap-x-2 text-xs text-sl-muted">
                    <span className="font-bold text-sl-fg">{r.authorName}</span>
                    <Badge tone="green">{m.verifiedBuyer}</Badge>
                    <span>{formatDate(r.createdAt, locale)}</span>
                    <Link href={`/dashboard/orders/${r.order.id}`} className="inline-flex min-h-11 items-center font-bold text-sl-accent hover:underline">
                      {fill(m.order, { n: r.order.number })}
                    </Link>
                  </p>
                  {moderate && (
                    <div className="mt-auto border-t border-sl-border pt-3">
                      <ModerateButton id={r.id} hidden={hidden} labels={m} />
                    </div>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

async function Testimonials({ actor, status: raw, locale }: { actor: Actor; status?: string; locale: Locale }) {
  const s = shopMessages[locale];
  const status = TESTIMONIAL_FILTERS.find((f) => f === raw) ?? "PENDING";
  const items = await testimonialService.list(actor, status);
  const moderate = can(actor.role, "review.moderate");

  return (
    <>
      <nav aria-label={s.testimonialStatus} className="sl-scroll-row -mx-4 mb-4 gap-2 px-4 pb-1">
        {TESTIMONIAL_FILTERS.map((f) => (
          <FilterChip key={f} href={`/dashboard/reviews?tab=testimonials&status=${f}`} selected={status === f}>
            {s[`status${f}`]}
          </FilterChip>
        ))}
      </nav>

      {items.length === 0 ? (
        <EmptyState title={s.noTestimonials} body={s.noTestimonialsHint} />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {items.map((x) => (
            <li key={x.id}>
              <Card className="flex h-full flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold">{x.authorName}</span>
                  <Badge tone={TESTIMONIAL_TONES[x.status]}>{s[`status${x.status}`]}</Badge>
                </div>
                <blockquote className="whitespace-pre-line break-words rounded-sl bg-sl-cat px-3 py-2.5 text-sm leading-relaxed">{x.message}</blockquote>
                <p className="flex flex-wrap gap-x-3 text-xs text-sl-muted">
                  <span>{formatDate(x.createdAt, locale)}</span>
                  {x.moderatedAt && <span>{fill(s.moderatedOn, { date: formatDate(x.moderatedAt, locale) })}</span>}
                </p>
                {moderate && (
                  <div className="mt-auto border-t border-sl-border pt-3">
                    <TestimonialActions id={x.id} status={x.status} labels={{ approve: s.approve, reject: s.reject, testimonialFailed: s.testimonialFailed }} />
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
