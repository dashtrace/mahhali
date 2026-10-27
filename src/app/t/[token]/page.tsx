import type { Metadata } from "next";
import { Alert, Badge, ButtonLink, Card, STATUS_TONES, cx } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { fill } from "@/i18n/locale";
import { common } from "@/i18n/messages/common";
import { storeMessages } from "@/i18n/messages/store";
import { getLocale } from "@/i18n/server";
import { formatDateTime, formatMoney, formatNumber, whatsappLink } from "@/lib/format";
import { appUrl } from "@/server/mail/mailer";
import { plain } from "@/server/http/json";
import { trackingService } from "@/server/services/trackingService";
import { CopyLink } from "../../dashboard/_components/Board";
import { requestIp } from "../../_server/session";
import { attempt, shopLocale } from "../../_storefront/data";
import { Notice, ShopFrame } from "../../_storefront/ShopFrame";

export const metadata: Metadata = { title: "Order", robots: { index: false } };

const FLOW = ["NEW", "CONFIRMED", "PACKED", "OUT_FOR_DELIVERY", "DELIVERED"] as const;

export default async function TrackingPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ placed?: string }>;
}) {
  const [{ token }, { placed }] = await Promise.all([params, searchParams]);
  const res = await attempt(trackingService.view(token, await requestIp()));
  if (!res.ok) {
    const locale = await getLocale();
    return <Notice locale={locale} title={res.error.status === 429 ? storeMessages[locale].rateLimited : common[locale].error} />;
  }
  const { shop, order, review } = plain(res.data);
  const locale = shopLocale(shop.language);
  const m = storeMessages[locale];
  const t = common[locale];
  const money = (minor: number, currency = order.currency) => formatMoney(minor, currency, locale);

  // The usual path as steps; a cancelled or returned order shows what actually happened.
  const steps: string[] = (FLOW as readonly string[]).includes(order.status) ? [...FLOW] : order.timeline.map((e) => e.status);
  const reached = (s: string) => order.timeline.find((e) => e.status === s)?.at ?? (s === "NEW" ? order.placedAt : null);
  const current = steps.indexOf(order.status);

  return (
    <ShopFrame shop={shop} locale={locale}>
      <div className="mx-auto flex max-w-xl flex-col gap-4">
        {placed && (
          <Alert tone="success">
            <p className="font-semibold">{m.placedTitle}</p>
            <p>{m.placedBody}</p>
          </Alert>
        )}

        <div>
          <p className="text-sm opacity-70">{fill(m.hello, { name: order.customerFirstName })}</p>
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold">
            {fill(m.orderTitle, { n: order.number })}
            <Badge tone={STATUS_TONES[order.status]}>{t[`status${order.status}`]}</Badge>
          </h1>
          <p className="text-sm opacity-70">{fill(m.placedAt, { date: formatDateTime(order.placedAt, locale) })}</p>
        </div>

        {placed && <CopyLink url={appUrl(`/t/${token}`)} label={m.trackingLink} copy={m.copy} copied={m.copied} />}

        <div className="flex flex-col gap-2 sm:flex-row">
          {review.canReview && (
            <ButtonLink href={`/r/${token}`} block>
              <Icon name="star" />
              {m.rateOrder}
            </ButtonLink>
          )}
          {shop.whatsappPhone && (
            <ButtonLink
              href={whatsappLink(shop.whatsappPhone, fill(m.waText, { n: order.number }))}
              target="_blank"
              rel="noopener noreferrer"
              tone="secondary"
              block
            >
              <Icon name="chat" />
              {m.messageShop}
            </ButtonLink>
          )}
        </div>

        <Card>
          <h2 className="mb-3 font-semibold">{m.statusTitle}</h2>
          <ol className="flex flex-col gap-3">
            {steps.map((s, i) => {
              const at = reached(s);
              const done = i <= current;
              return (
                <li key={`${s}-${i}`} className="flex items-center gap-3" aria-current={i === current ? "step" : undefined}>
                  <span
                    className={cx(
                      "flex size-7 shrink-0 items-center justify-center rounded-full border",
                      done ? "border-[var(--brand)] bg-[var(--brand)] text-[var(--brand-ink)]" : "border-stone-300 text-transparent",
                    )}
                  >
                    <Icon name="check" className="size-4" />
                  </span>
                  <span className={cx("flex-1 text-sm", done ? "font-medium" : "text-stone-500")}>
                    {t[`status${s}` as keyof typeof t]}
                  </span>
                  {done && at && <span className="text-xs tabular-nums text-stone-500">{formatDateTime(at, locale)}</span>}
                </li>
              );
            })}
          </ol>
          {order.courier && (
            <p className="mt-4 flex items-center gap-2 text-sm">
              <Icon name="truck" />
              <span className="text-stone-500">{m.courier}:</span> {order.courier.name}
            </p>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold">{m.itemsTitle}</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {order.items.map((item, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span>
                  {item.name} <span className="text-stone-500">× {item.qty}</span>
                </span>
                <span className="tabular-nums">{money(item.unitPriceMinor * item.qty)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-3 flex flex-col gap-1 border-t border-stone-200 pt-3 text-sm">
            <div className="flex justify-between">
              <dt>{m.subtotal}</dt>
              <dd className="tabular-nums">{money(order.subtotalMinor)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>{m.deliveryFee}</dt>
              <dd className="tabular-nums">{money(order.deliveryFeeMinor)}</dd>
            </div>
            <div className="flex justify-between text-base font-semibold">
              <dt>{m.total}</dt>
              <dd className="tabular-nums">{money(order.totalMinor)}</dd>
            </div>
            {order.converted && (
              <p className="text-end text-xs text-stone-500">
                {fill(m.approx, {
                  amount: money(order.converted.totalMinor, order.converted.currency),
                  rate: formatNumber(Number(order.converted.usdLbpRate), locale),
                })}
              </p>
            )}
          </dl>
          <p className="mt-2 text-xs text-stone-500">{m.payOnDelivery}</p>
        </Card>

        <ButtonLink href={`/s/${shop.slug}`} tone="ghost">
          {m.backToShop}
        </ButtonLink>
      </div>
    </ShopFrame>
  );
}
