import type { Metadata } from "next";
import { cache } from "react";
import { EmptyState } from "@/components/ui";
import { fill } from "@/i18n/locale";
import { checkoutMessages } from "@/i18n/messages/checkout";
import { getLocale } from "@/i18n/server";
import { formatDate } from "@/lib/format";
import { plain } from "@/server/http/json";
import { reviewService } from "@/server/services/reviewService";
import { requestIp } from "../../_server/session";
import { attempt, shopLocale } from "../../_storefront/data";
import { ShopFrame } from "../../_storefront/ShopFrame";
import { LinkNotice } from "../../t/_components/LinkNotice";
import { ReviewForm } from "./ReviewForm";

type Props = { params: Promise<{ token: string }> };

// Metadata and page share one lookup (and one hit on the rate limit) per request.
const load = cache(async (token: string) => attempt(reviewService.forToken(token, await requestIp())));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const res = await load((await params).token);
  if (!res.ok) return { robots: { index: false } };
  const m = checkoutMessages[shopLocale(res.data.shop.language)];
  return { title: `${fill(m.reviewTitle, { n: res.data.order.number })} · ${res.data.shop.name}`, robots: { index: false } };
}

export default async function ReviewPage({ params }: Props) {
  const { token } = await params;
  const res = await load(token);
  if (!res.ok) {
    const locale = await getLocale();
    const m = checkoutMessages[locale];
    const code = res.error.code;
    if (code === "REVIEW_LINK_USED") return <LinkNotice locale={locale} icon="check" title={m.linkUsedTitle} body={m.linkUsedBody} />;
    if (code === "REVIEW_LINK_EXPIRED") return <LinkNotice locale={locale} icon="calendar" title={m.linkExpiredTitle} body={m.linkExpiredBody} />;
    return <LinkNotice locale={locale} title={res.error.status === 429 ? m.rateLimited : m.error} />;
  }
  const data = plain(res.data);
  const locale = shopLocale(data.shop.language);
  const m = checkoutMessages[locale];

  return (
    <ShopFrame shop={data.shop} locale={locale}>
      <div className="mx-auto max-w-xl py-2">
        <h1 className="sl-heading text-[28px] leading-tight">{fill(m.reviewTitle, { n: data.order.number })}</h1>
        <p className="mb-4 mt-1.5 text-sm leading-normal text-sl-muted">{fill(m.reviewLead, { name: data.customerFirstName })}</p>
        {data.items.length === 0 ? (
          <EmptyState title={m.nothingToReview} />
        ) : (
          <ReviewForm token={token} slug={data.shop.slug} items={data.items} expires={formatDate(data.expiresAt, locale)} m={m} />
        )}
      </div>
    </ShopFrame>
  );
}
