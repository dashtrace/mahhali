import type { Metadata } from "next";
import { fill } from "@/i18n/locale";
import { common } from "@/i18n/messages/common";
import { storeMessages } from "@/i18n/messages/store";
import { getLocale } from "@/i18n/server";
import { plain } from "@/server/http/json";
import { reviewService } from "@/server/services/reviewService";
import { requestIp } from "../../_server/session";
import { attempt, shopLocale } from "../../_storefront/data";
import { Notice, ShopFrame } from "../../_storefront/ShopFrame";
import { ReviewForm } from "./ReviewForm";

export const metadata: Metadata = { title: "Review", robots: { index: false } };

export default async function ReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const res = await attempt(reviewService.forToken(token, await requestIp()));
  if (!res.ok) {
    const locale = await getLocale();
    const m = storeMessages[locale];
    const code = res.error.code;
    if (code === "REVIEW_LINK_USED") return <Notice locale={locale} title={m.linkUsedTitle} body={m.linkUsedBody} />;
    if (code === "REVIEW_LINK_EXPIRED") return <Notice locale={locale} title={m.linkExpiredTitle} body={m.linkExpiredBody} />;
    return <Notice locale={locale} title={res.error.status === 429 ? m.rateLimited : common[locale].error} />;
  }
  const data = plain(res.data);
  const locale = shopLocale(data.shop.language);
  const m = storeMessages[locale];

  return (
    <ShopFrame shop={data.shop} locale={locale}>
      <div className="mx-auto max-w-xl">
        <h1 className="text-2xl font-semibold">{fill(m.reviewTitle, { n: data.order.number })}</h1>
        <p className="mb-4 mt-1 text-sm opacity-70">{fill(m.reviewLead, { name: data.customerFirstName })}</p>
        {data.items.length === 0 ? (
          <p className="text-sm">{m.nothingToReview}</p>
        ) : (
          <ReviewForm token={token} slug={data.shop.slug} items={data.items} m={m} t={common[locale]} />
        )}
      </div>
    </ShopFrame>
  );
}
