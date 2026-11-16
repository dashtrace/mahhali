import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { fill, type Locale } from "@/i18n/locale";
import { reviewMessages } from "@/i18n/messages/money";
import { shopMessages } from "@/i18n/messages/shop";
import { getLocale } from "@/i18n/server";
import { formatDate } from "@/lib/format";
import { can } from "@/server/domain/policy";
import type { Actor } from "@/server/http/withRoute";
import { reviewService } from "@/server/services/reviewService";
import { testimonialService } from "@/server/services/storefrontService";
import { pageActor } from "../../_server/session";
import { DashIcon } from "../_components/DashIcon";
import { ModerateButton } from "./ModerateButton";
import { TestimonialActions } from "./TestimonialActions";

export const metadata = { title: "Reviews" };

const REVIEW_FILTERS = ["PENDING", "PUBLISHED", "HIDDEN", ""] as const;
const TESTIMONIAL_FILTERS = ["PENDING", "APPROVED", "REJECTED"] as const;
const TESTIMONIAL_TONES = { PENDING: "amber", APPROVED: "green", REJECTED: "gray" } as const;

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<{ status?: string; tab?: string }> }) {
  const actor = await pageActor("review.read", "/dashboard/reviews");
  const sp = await searchParams;
  const locale = await getLocale();
  const m = reviewMessages[locale];
  const testimonials = sp.tab === "testimonials";

  return (
    <>
      <PageHeader title={m.title} subtitle={m.subtitle} />
      <nav aria-label={m.tabsLabel} className="segbar">
        <Link href="/dashboard/reviews" aria-current={testimonials ? undefined : "page"}>
          {m.productTab}
        </Link>
        <Link href="/dashboard/reviews?tab=testimonials" aria-current={testimonials ? "page" : undefined}>
          {m.testimonialTab}
        </Link>
      </nav>
      {testimonials ? <Testimonials actor={actor} status={sp.status} locale={locale} /> : <ProductReviews actor={actor} status={sp.status} locale={locale} />}
    </>
  );
}

function Stars({ rating, label }: { rating: number; label: string }) {
  return (
    <div role="img" aria-label={label} className="text-[18px] text-[#c78639]">
      {"★".repeat(rating) + "☆".repeat(5 - rating)}
    </div>
  );
}

async function ProductReviews({ actor, status: raw, locale }: { actor: Actor; status?: string; locale: Locale }) {
  const m = reviewMessages[locale];
  const status = raw === "PUBLISHED" || raw === "HIDDEN" ? raw : raw === "" ? undefined : "PENDING";
  const reviews = await reviewService.list(actor, status);
  const moderate = can(actor.role, "review.moderate");
  const filterLabel = { "": m.all, PENDING: m.pending, PUBLISHED: m.published, HIDDEN: m.hidden };

  return (
    <>
      <nav aria-label={m.statusLabel} className="pills mb-[15px]">
        {REVIEW_FILTERS.map((f) => (
          <Link key={f} href={f ? `/dashboard/reviews?status=${f}` : "/dashboard/reviews?status="} className="pill" aria-current={(status ?? "") === f ? "page" : undefined}>
            {filterLabel[f]}
          </Link>
        ))}
      </nav>

      {reviews.length === 0 ? (
        <div className="empty">
          <strong>{m.empty}</strong>
          {m.emptyHint}
        </div>
      ) : (
        <div className="split">
          {reviews.map((r) => {
            const hidden = r.status === "HIDDEN";
            const pending = r.status === "PENDING";
            return (
              <article key={r.id} className="card">
                <div className="between">
                  <div className="min-w-0">
                    <Stars rating={r.rating} label={fill(m.stars, { n: r.rating })} />
                    <b>{r.product.name}</b>
                  </div>
                  <span className={`mini-badge ${pending ? "amber" : hidden ? "gray" : "green"}`}>{pending ? m.pending : hidden ? m.hidden : m.published}</span>
                </div>
                <p className="my-3.5 whitespace-pre-line break-words">{r.comment ?? <em className="hint">{m.noComment}</em>}</p>
                <p className="hint">
                  {r.authorName} · {m.verifiedBuyer} · {formatDate(r.createdAt, locale)} ·{" "}
                  <Link href={`/dashboard/orders/${r.order.id}`} className="underline-offset-2 hover:underline">
                    {fill(m.order, { n: r.order.number })}
                  </Link>
                </p>
                {moderate && <ModerateButton id={r.id} status={r.status} labels={m} />}
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}

async function Testimonials({ actor, status: raw, locale }: { actor: Actor; status?: string; locale: Locale }) {
  const m = reviewMessages[locale];
  const s = shopMessages[locale];
  const status = TESTIMONIAL_FILTERS.find((f) => f === raw) ?? "PENDING";
  const items = await testimonialService.list(actor, status);
  const moderate = can(actor.role, "review.moderate");

  return (
    <>
      <nav aria-label={m.statusLabel} className="pills mb-[15px]">
        {TESTIMONIAL_FILTERS.map((f) => (
          <Link key={f} href={`/dashboard/reviews?tab=testimonials&status=${f}`} className="pill" aria-current={status === f ? "page" : undefined}>
            {s[`status${f}`]}
          </Link>
        ))}
      </nav>

      {items.length === 0 ? (
        <div className="empty">
          <strong>{s.noTestimonials}</strong>
          {s.noTestimonialsHint}
        </div>
      ) : (
        <div className="split">
          {items.map((x) => (
            <article key={x.id} className="card">
              <div className="between">
                <div className="min-w-0">
                  <div className="text-[18px] text-[#c78639]">
                    <DashIcon name="message" />
                  </div>
                  <b>{m.storeFeedback}</b>
                </div>
                <span className={`mini-badge ${TESTIMONIAL_TONES[x.status]}`}>{s[`status${x.status}`]}</span>
              </div>
              <p className="my-3.5 whitespace-pre-line break-words">{x.message}</p>
              <p className="hint">
                {x.authorName} · {m.withConsent} · {formatDate(x.createdAt, locale)}
                {x.moderatedAt && <> · {fill(s.moderatedOn, { date: formatDate(x.moderatedAt, locale) })}</>}
              </p>
              {moderate && <TestimonialActions id={x.id} status={x.status} labels={{ approve: m.approve, reject: m.reject, testimonialFailed: s.testimonialFailed }} />}
            </article>
          ))}
        </div>
      )}
    </>
  );
}
