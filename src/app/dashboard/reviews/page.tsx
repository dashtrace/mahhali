import Link from "next/link";
import { Badge, Card, EmptyState, PageHeader, cx } from "@/components/ui";
import { fill } from "@/i18n/locale";
import { common } from "@/i18n/messages/common";
import { reviewMessages } from "@/i18n/messages/money";
import { getLocale } from "@/i18n/server";
import { formatDate } from "@/lib/format";
import { can } from "@/server/domain/policy";
import { reviewService } from "@/server/services/reviewService";
import { pageActor } from "../../_server/session";
import { ModerateButton } from "./ModerateButton";

export const metadata = { title: "Reviews" };

const FILTERS = ["", "PUBLISHED", "HIDDEN"] as const;

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const actor = await pageActor("review.read", "/dashboard/reviews");
  const sp = await searchParams;
  const status = sp.status === "PUBLISHED" || sp.status === "HIDDEN" ? sp.status : undefined;
  const locale = await getLocale();
  const m = reviewMessages[locale];
  const t = common[locale];
  const reviews = await reviewService.list(actor, status);
  const moderate = can(actor.role, "review.moderate");
  const filterLabel = { "": t.all, PUBLISHED: m.published, HIDDEN: m.hidden };

  return (
    <>
      <PageHeader title={m.title} subtitle={m.subtitle} />
      <nav aria-label={m.title} className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {FILTERS.map((f) => {
          const active = (status ?? "") === f;
          return (
            <Link
              key={f}
              href={f ? `/dashboard/reviews?status=${f}` : "/dashboard/reviews"}
              aria-current={active ? "page" : undefined}
              className={cx(
                "inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium",
                active ? "border-[var(--brand)] bg-[var(--brand)] text-[var(--brand-ink)]" : "border-stone-300 bg-white text-stone-700",
              )}
            >
              {filterLabel[f]}
            </Link>
          );
        })}
      </nav>

      {reviews.length === 0 ? (
        <EmptyState title={m.empty} body={m.emptyHint} />
      ) : (
        <ul className="flex flex-col gap-3">
          {reviews.map((r) => {
            const hidden = r.status === "HIDDEN";
            return (
              <li key={r.id}>
                <Card className={cx("flex gap-3", hidden && "bg-stone-50")}>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span role="img" aria-label={fill(m.stars, { n: r.rating })} className="text-amber-500">
                        {"★".repeat(r.rating)}
                        <span className="text-stone-300">{"★".repeat(5 - r.rating)}</span>
                      </span>
                      {hidden && <Badge tone="neutral">{m.hidden}</Badge>}
                    </div>
                    <p className="mt-1 font-medium">{r.product.name}</p>
                    <p className={cx("mt-1 text-sm whitespace-pre-line", r.comment ? "text-stone-800" : "text-stone-500 italic")}>
                      {r.comment ?? m.noComment}
                    </p>
                    <p className="mt-2 flex flex-wrap items-center gap-x-2 text-xs text-stone-500">
                      <span>{r.authorName}</span>
                      <Badge tone="green">{m.verifiedBuyer}</Badge>
                      <span>{formatDate(r.createdAt, locale)}</span>
                      <Link href={`/dashboard/orders/${r.order.id}`} className="inline-flex min-h-11 items-center text-[var(--brand)] hover:underline">
                        {fill(m.order, { n: r.order.number })}
                      </Link>
                    </p>
                  </div>
                  {moderate && <ModerateButton id={r.id} hidden={hidden} labels={m} />}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
