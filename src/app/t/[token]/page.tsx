import type { Metadata } from "next";
import { cache, type ReactNode } from "react";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Icon, type IconName } from "@/components/Icon";
import { Alert, Badge, ButtonLink, Card, ProductPhoto, Timeline } from "@/components/ui";
import { fill } from "@/i18n/locale";
import { checkoutMessages } from "@/i18n/messages/checkout";
import { common } from "@/i18n/messages/common";
import { getLocale } from "@/i18n/server";
import { formatDate, formatDateTime, formatMoney, formatNumber, whatsappLink } from "@/lib/format";
import { appUrl } from "@/server/mail/mailer";
import { plain } from "@/server/http/json";
import { trackingService } from "@/server/services/trackingService";
import { requestIp } from "../../_server/session";
import { attempt, shopLocale } from "../../_storefront/data";
import { ShopFrame } from "../../_storefront/ShopFrame";
import { LinkNotice } from "../_components/LinkNotice";
import { CopyLink } from "./CopyLink";

type Props = { params: Promise<{ token: string }>; searchParams: Promise<{ placed?: string }> };

const FLOW = ["NEW", "CONFIRMED", "PACKED", "OUT_FOR_DELIVERY", "DELIVERED"] as const;
const STEP_ICONS: Record<string, IconName> = { NEW: "bag", CONFIRMED: "check", PACKED: "box", OUT_FOR_DELIVERY: "truck", DELIVERED: "home" };
const noteBox = "whitespace-pre-wrap break-words rounded-[5px] border-s-[3px] border-sl-accent bg-sl-cat px-2.5 py-1.5 text-xs leading-relaxed";
const panel = "rounded-[17px] p-4 shadow-[0_7px_20px_#00000005] sm:p-5";

// Metadata and page share one lookup (and one hit on the rate limit) per request.
const load = cache(async (token: string) => attempt(trackingService.view(token, await requestIp())));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const res = await load((await params).token);
  if (!res.ok) return { robots: { index: false } };
  const m = checkoutMessages[shopLocale(res.data.shop.language)];
  return { title: `${fill(m.orderTitle, { n: res.data.order.number })} · ${res.data.shop.name}`, robots: { index: false } };
}

export default async function TrackingPage({ params, searchParams }: Props) {
  const [{ token }, { placed }] = await Promise.all([params, searchParams]);
  const res = await load(token);
  if (!res.ok) {
    const locale = await getLocale();
    const m = checkoutMessages[locale];
    return <LinkNotice locale={locale} title={res.error.status === 429 ? m.rateLimited : m.error} />;
  }
  const { shop, order, review } = plain(res.data);
  const locale = shopLocale(shop.language);
  const m = checkoutMessages[locale];
  const money = (minor: number, currency = order.currency) => formatMoney(minor, currency, locale);

  const at = (s: string) => order.timeline.find((e) => e.status === s)?.at ?? (s === "NEW" ? order.placedAt : null);
  const bad = order.status === "CANCELLED" || order.status === "RETURNED";
  // The usual path as steps; a cancelled or returned order shows the steps it reached, then where it stopped.
  const keys: (typeof order.status)[] = bad ? [...FLOW.filter((s) => at(s)), order.status] : [...FLOW];
  const steps = keys.map((s) => {
    const when = at(s);
    return { label: m[`step${s}`], date: when ? formatDate(when, locale) : m.pending, icon: STEP_ICONS[s] ?? "x" };
  });
  const lastUpdate = order.timeline.at(-1)?.at ?? order.placedAt;
  const units = order.items.reduce((n, i) => n + i.qty, 0);
  const showConfirmation = !!placed && !bad;
  const Heading = showConfirmation ? "h2" : "h1";

  return (
    <ShopFrame shop={shop} locale={locale}>
      {/* Live status until the order is final; 2 refreshes a minute stay well under the tracking rate limit. */}
      {!bad && order.status !== "DELIVERED" && <AutoRefresh seconds={30} />}
      <div className="mx-auto flex max-w-xl flex-col gap-4 py-2">
        {showConfirmation && (
          <>
            <section className="rounded-[17px] bg-sl-hero p-5 text-center text-sl-hero-ink">
              <span aria-hidden className="mx-auto grid size-14 place-items-center rounded-full bg-sl-accent text-sl-accent-ink">
                <Icon name="check" className="size-7" />
              </span>
              <h1 className="sl-heading mt-3 text-[26px] leading-tight">{fill(m.placedTitle, { name: order.customerFirstName })}</h1>
              <p className="mt-1.5 text-sm leading-normal">{fill(m.placedLead, { n: order.number })}</p>
            </section>
            <CopyLink url={appUrl(`/t/${token}`)} label={m.trackingLink} hint={m.keepLink} copy={m.copyLink} copied={m.copied} />
          </>
        )}

        <Card className={panel} aria-labelledby="order-title" role="region">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <Heading id="order-title" className="sl-heading text-lg leading-tight">
                {fill(m.orderTitle, { n: order.number })}
              </Heading>
              <p className="mt-0.5 text-xs text-sl-muted">{fill(m.placedOn, { date: formatDate(order.placedAt, locale) })}</p>
            </div>
            {bad ? (
              <Badge tone="red">
                <Icon name="x" className="size-3.5" />
                {m[`step${order.status}`]}
              </Badge>
            ) : (
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-sl-soft px-2.5 py-1.5 text-xs font-bold text-sl-soft-ink">
                <Icon name={STEP_ICONS[order.status]} className="size-3.5" />
                {m[`step${order.status}`]}
              </span>
            )}
          </div>

          <div className="my-5">
            <Timeline steps={steps} current={keys.indexOf(order.status)} label={m.progress} tone={bad ? "bad" : undefined} />
          </div>

          {bad && (
            <Alert tone="warning" className="mb-4">
              <p className="font-bold">{order.status === "CANCELLED" ? m.cancelledTitle : m.returnedTitle}</p>
              <p>{order.status === "CANCELLED" ? m.cancelledBody : m.returnedBody}</p>
            </Alert>
          )}

          <ul className="grid grid-cols-2 gap-x-2 gap-y-3 border-t border-sl-border pt-3">
            <Summary icon="cash" label={m.paymentMethod} value={m.cod} />
            <Summary
              icon="card"
              label={order.status === "DELIVERED" ? m.paidAmount : m.codAmount}
              value={bad ? m.nothingToPay : <bdi>{money(order.totalMinor)}</bdi>}
            />
            <Summary icon="truck" label={m.courier} value={order.courier?.name ?? m.courierPending} />
            <Summary icon="calendar" label={m.lastUpdate} value={formatDateTime(lastUpdate, locale)} />
          </ul>
        </Card>

        {review.canReview && (
          <Card className={`${panel} flex flex-col items-start gap-3 sm:flex-row sm:items-center`}>
            <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-full bg-sl-cat text-sl-star">
              <Icon name="star" solid className="size-6" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-bold">{m.deliveredTitle}</p>
              <p className="text-sm leading-normal text-sl-muted">{m.deliveredBody}</p>
            </div>
            <ButtonLink href={`/r/${token}`} className="shrink-0">
              {m.rateOrder}
            </ButtonLink>
          </Card>
        )}

        <Card className={panel} aria-labelledby="items-title" role="region">
          <h2 id="items-title" className="sl-heading text-[17px] leading-tight">
            {fill(m.itemsTitle, { n: units })}
          </h2>
          <ul className="mt-1 divide-y divide-sl-border">
            {order.items.map((item, i) => (
              <li key={i} className="flex items-center gap-3 py-3">
                <span className="size-[57px] shrink-0 overflow-hidden rounded-[9px]">
                  <ProductPhoto src={item.imageUrl} name={item.name} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold leading-snug">{item.name}</p>
                  {item.note && <p className={`${noteBox} mt-1.5`}>{item.note}</p>}
                </div>
                <div className="shrink-0 text-end">
                  <p className="text-sm font-extrabold tabular-nums">{money(item.unitPriceMinor * item.qty)}</p>
                  <p className="text-xs text-sl-muted">{fill(m.qty, { n: item.qty })}</p>
                </div>
              </li>
            ))}
          </ul>
          <details className="group border-t border-sl-border">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 text-sm font-bold text-sl-accent [&::-webkit-details-marker]:hidden">
              {m.breakdown}
              <Icon name="chevron" className="size-4 transition group-open:rotate-180" />
            </summary>
            <dl className="flex flex-col gap-1.5 pb-1 text-sm">
              <Row label={m.subtotal} value={money(order.subtotalMinor)} />
              <Row label={m.deliveryFee} value={order.deliveryFeeMinor === 0 ? m.free : money(order.deliveryFeeMinor)} />
              <Row label={m.codTotal} value={money(order.totalMinor)} strong />
            </dl>
            {order.converted && (
              <p className="pb-1 text-end text-xs text-sl-muted">
                {fill(m.approx, {
                  amount: money(order.converted.totalMinor, order.converted.currency),
                  rate: formatNumber(Number(order.converted.usdLbpRate), locale),
                })}
              </p>
            )}
          </details>
        </Card>

        <div className="flex flex-col gap-2 sm:flex-row">
          {shop.whatsappPhone && (
            <ButtonLink
              href={whatsappLink(shop.whatsappPhone, fill(m.waText, { n: order.number }))}
              target="_blank"
              rel="noopener noreferrer"
              tone="secondary"
              block
            >
              <Icon name="whatsapp" className="size-5 text-sl-whatsapp" />
              {m.messageShop}
              <span className="sr-only">({common[locale].opensNewTab})</span>
            </ButtonLink>
          )}
          <ButtonLink href={`/s/${shop.slug}`} tone="ghost" block>
            {m.backToShop}
          </ButtonLink>
        </div>
      </div>
    </ShopFrame>
  );
}

function Summary({ icon, label, value }: { icon: IconName; label: string; value: ReactNode }) {
  return (
    <li className="flex min-w-0 gap-2">
      <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-sl-cat text-sl-accent">
        <Icon name={icon} className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-sl-muted">{label}</p>
        <p className="text-balance break-words text-sm font-bold">{value}</p>
      </div>
    </li>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 ${strong ? "mt-1 border-t border-sl-border pt-2 font-extrabold" : ""}`}>
      <dt className={strong ? undefined : "text-sl-muted"}>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
