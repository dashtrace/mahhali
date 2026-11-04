import type { Metadata } from "next";
import Link from "next/link";
import { cache, type ReactNode } from "react";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Icon } from "@/components/Icon";
import { ProductPhoto, cx } from "@/components/ui";
import { fill } from "@/i18n/locale";
import { checkoutMessages } from "@/i18n/messages/checkout";
import { common } from "@/i18n/messages/common";
import { getLocale } from "@/i18n/server";
import { formatDateTime, formatMoney, formatNumber, whatsappLink } from "@/lib/format";
import { appUrl } from "@/server/mail/mailer";
import { plain } from "@/server/http/json";
import { trackingService } from "@/server/services/trackingService";
import { requestIp } from "../../_server/session";
import { attempt, shopLocale } from "../../_storefront/data";
import { ShopFrame } from "../../_storefront/ShopFrame";
import { LinkNotice } from "../_components/LinkNotice";
import { CopyLink, CopyNumber } from "./CopyLink";

type Props = { params: Promise<{ token: string }>; searchParams: Promise<{ placed?: string }> };

const FLOW = ["NEW", "CONFIRMED", "PACKED", "OUT_FOR_DELIVERY", "DELIVERED"] as const;
// Times are rendered on the server, whose clock isn't the customer's; these shops are in Lebanon.
const SHOP_TIME_ZONE = "Asia/Beirut";

// Metadata and page share one lookup (and one hit on the rate limit) per request.
const load = cache(async (token: string) => attempt(trackingService.view(token, await requestIp())));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const res = await load((await params).token);
  if (!res.ok) return { robots: { index: false } };
  const m = checkoutMessages[shopLocale(res.data.shop.language)];
  return { title: `${fill(m.orderTitle, { n: res.data.order.number })} · ${res.data.shop.name}`, robots: { index: false } };
}

/** The first `{n}` of a message in bold, with its `#` when it has one. */
function boldNumber(text: string, n: number) {
  const [before, after] = text.split(/#?\{n\}/);
  return (
    <>
      {before}
      <b>
        <bdi>
          {text.includes("#{n}") && "#"}
          {n}
        </bdi>
      </b>
      {after}
    </>
  );
}

/**
 * `?placed=1` is the confirmation page checkout lands on (also the delivered
 * confirmation); without it, the tracking result. A cancelled or returned order
 * only ever gets the tracking result, so nothing there can read as a success.
 */
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
  const status = order.status;
  const money = (minor: number, currency = order.currency) => <bdi>{formatMoney(minor, currency, locale)}</bdi>;
  const dateTime = (at: string) => formatDateTime(at, locale, SHOP_TIME_ZONE);

  const at = (s: string) => order.timeline.find((e) => e.status === s)?.at ?? (s === "NEW" ? order.placedAt : null);
  const bad = status === "CANCELLED" || status === "RETURNED";
  const delivered = status === "DELIVERED";
  // The usual path as steps; a cancelled or returned order shows the steps it reached, then where it stopped.
  const keys: (typeof status)[] = bad ? [...FLOW.filter((s) => at(s)), status] : [...FLOW];
  const current = keys.indexOf(status);
  const steps = keys.map((key, i) => {
    const when = at(key);
    return { key, label: m[`step${key}`], time: when ? dateTime(when) : i > current ? m.pending : null, state: i < current ? "done" : i === current ? "current" : "upcoming" };
  });
  const lastUpdate = order.timeline.at(-1)?.at ?? order.placedAt;
  const units = order.items.reduce((n, i) => n + i.qty, 0);
  const statusGlyph = bad ? "✕" : delivered ? "✓" : "●";
  const stepGlyph = (state: string, i: number) => (state === "done" || delivered ? "✓" : bad && state === "current" ? "✕" : i + 1);

  const meta = (
    <dl className="sl-order-meta">
      <Meta label={m.paymentMethod} value={m.cod} />
      <Meta
        label={delivered ? m.paidAmount : m.codAmount}
        value={
          bad ? (
            m.nothingToPay
          ) : delivered ? (
            <>
              {m.paid} · {money(order.totalMinor)}
            </>
          ) : (
            money(order.totalMinor)
          )
        }
      />
      {order.courier ? (
        <Meta label={m.courier} value={delivered ? fill(m.courierDelivered, { name: order.courier.name }) : order.courier.name} />
      ) : (
        !bad && !delivered && <Meta label={m.courier} value={m.courierPending} />
      )}
      <Meta label={m.lastUpdate} value={dateTime(lastUpdate)} />
      <Meta label={m.placedOnLabel} value={dateTime(order.placedAt)} />
    </dl>
  );

  const callout = review.canReview && (
    <div className="sl-review-callout sl-on-surface">
      <div className="sl-review-icon" aria-hidden>
        ★
      </div>
      <div className="min-w-0 flex-1">
        <strong>{m.deliveredTitle}</strong>
        <p>{m.deliveredBody}</p>
      </div>
      <Link href={`/r/${token}`} className="sl-review-cta">
        {m.rateOrder}
        <Icon name="arrowOut" className="sl-arrow-out" />
      </Link>
    </div>
  );

  const items = (
    <div className="sl-order-items">
      {order.items.map((item, i) => (
        <div key={i} className="sl-order-item">
          <span className="sl-order-thumb">
            <ProductPhoto src={item.imageUrl} name={item.name} />
          </span>
          <div className="min-w-0">
            <h3>
              <bdi>{item.name}</bdi>
            </h3>
            <small>{fill(m.qty, { n: item.qty })}</small>
            {item.note && <p className="sl-order-item-note">{item.note}</p>}
          </div>
          <b>{money(item.unitPriceMinor * item.qty)}</b>
        </div>
      ))}
    </div>
  );

  const breakdown = (
    <details className="sl-order-breakdown">
      <summary>{m.breakdown}</summary>
      <div className="sl-totals-row">
        <span>{m.subtotal}</span>
        <strong>{money(order.subtotalMinor)}</strong>
      </div>
      <div className="sl-totals-row">
        <span>{m.deliveryFee}</span>
        <strong>{order.deliveryFeeMinor === 0 ? m.free : money(order.deliveryFeeMinor)}</strong>
      </div>
      <div className="sl-totals-row sl-totals-final">
        <span>{m.codTotal}</span>
        <strong>{money(order.totalMinor)}</strong>
      </div>
      {order.converted && (
        <p className="sl-summary-note text-end">
          {fill(m.approx, {
            amount: formatMoney(order.converted.totalMinor, order.converted.currency, locale),
            rate: formatNumber(Number(order.converted.usdLbpRate), locale),
          })}
        </p>
      )}
    </details>
  );

  const whatsapp = (label: string) =>
    shop.whatsappPhone && (
      <a href={whatsappLink(shop.whatsappPhone, fill(m.waText, { n: order.number }))} target="_blank" rel="noopener noreferrer" className="sl-order-whatsapp">
        <Icon name="whatsapp" className="size-[17px] shrink-0" />
        {label}
        <span className="sr-only">({common[locale].opensNewTab})</span>
      </a>
    );

  // Live status until the order is final; 2 refreshes a minute stay well under the tracking rate limit.
  const refresh = !bad && !delivered && <AutoRefresh seconds={30} />;

  if (placed && !bad) {
    return (
      <ShopFrame shop={shop} locale={locale} page="sl-order-page">
        {refresh}
        <section className="sl-order-success sl-on-surface">
          <div className="sl-order-check" aria-hidden>
            ✓
          </div>
          <p className="sl-page-eyebrow">{delivered ? m.deliveredEyebrow : m.confirmationEyebrow}</p>
          <h1 className="sl-order-title">{fill(m.placedTitle, { name: order.customerFirstName })}</h1>
          <p className="sl-order-intro">{boldNumber(delivered ? m.deliveredLead : status === "NEW" ? m.placedLead : m.placedLeadLater, order.number)}</p>
        </section>

        <CopyLink url={appUrl(`/t/${token}`)} label={m.trackingLink} hint={m.keepLink} copy={m.copyLink} copied={m.copied} />

        <section className="sl-order-panel" aria-labelledby="order-title">
          <div className="sl-order-head">
            <h2 id="order-title">{fill(m.orderTitle, { n: order.number })}</h2>
            <span className="sl-order-pill sl-on-surface">
              <span aria-hidden>{statusGlyph}</span> {m[`step${status}`]}
            </span>
          </div>
          <ol className="sl-progress" aria-label={m.progress} style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
            {steps.map((s, i) => (
              <li key={s.key} data-state={s.state} aria-current={s.state === "current" ? "step" : undefined}>
                <span aria-hidden>{stepGlyph(s.state, i)}</span>
                <b>{s.label}</b>
                {s.time && <small>{s.time}</small>}
              </li>
            ))}
          </ol>
          {meta}
        </section>

        {callout}

        <section className="sl-order-panel" aria-labelledby="items-title">
          <h2 id="items-title">{fill(m.itemsTitle, { n: units })}</h2>
          {items}
          {breakdown}
        </section>

        <div className="sl-order-actions">
          <Link href={`/t/${token}`} className="sl-order-primary">
            {m.trackTitle}
            <Icon name="arrowOut" className="sl-arrow-out" />
          </Link>
          <CopyNumber value={String(order.number)} copy={m.copyOrderNumber} copied={m.copied} />
          <Link href={`/s/${shop.slug}`}>{m.backToShop}</Link>
          {whatsapp(m.whatsappShop)}
        </div>

        {(status === "NEW" || review.canReview) && (
          <p className="sl-order-note">
            <b>{delivered ? m.afterTitle : m.nextTitle}</b> {delivered ? m.afterBody : m.nextBody}
          </p>
        )}
      </ShopFrame>
    );
  }

  return (
    <ShopFrame shop={shop} locale={locale} page="sl-track-page">
      {refresh}
      <section className="sl-result">
        <div className="sl-result-head">
          <div>
            <p className="sl-page-eyebrow">{fill(m.orderEyebrow, { n: order.number })}</p>
            {status === "CANCELLED" || status === "RETURNED" ? (
              <h1>{status === "CANCELLED" ? m.cancelledTitle : m.returnedTitle}</h1>
            ) : (
              <>
                <h1>{m[`result${status}`]}</h1>
                <p>{delivered ? fill(m.resultLeadDelivered, { shop: shop.name }) : status === "NEW" ? m.resultLeadNew : m.resultLead}</p>
              </>
            )}
          </div>
          <span className={cx("sl-result-status", bad ? "sl-result-status-bad" : "sl-on-surface")}>
            <span aria-hidden>{statusGlyph}</span>
            {m[`step${status}`]}
          </span>
        </div>

        {bad && <p className="sl-order-alert">{status === "CANCELLED" ? m.cancelledBody : m.returnedBody}</p>}

        <ol className="sl-timeline" aria-label={m.progress}>
          {steps.map((s) => (
            <li key={s.key} data-state={s.state} data-bad={(bad && s.state === "current") || undefined} aria-current={s.state === "current" ? "step" : undefined}>
              <span aria-hidden>{s.state === "done" || delivered ? "✓" : bad && s.state === "current" ? "✕" : s.state === "current" ? "●" : ""}</span>
              <div>
                <strong>{s.label}</strong>
                <p>
                  {s.state === "upcoming" ? m[`wait${s.key as "CONFIRMED"}`] : m[`stage${s.key}`]} {s.time && <b>{s.time}</b>}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <div className="sl-result-meta">{meta}</div>
        {callout}

        <div className="sl-result-items">
          <h2>{fill(m.itemsTitle, { n: units })}</h2>
          {items}
          {breakdown}
        </div>

        <div className="sl-result-foot">
          {refresh && <span>{m.liveNote}</span>}
          <Link href={`/s/${shop.slug}`}>
            {m.backToShop}
            <Icon name="arrowOut" className="sl-arrow-out" />
          </Link>
        </div>

        {(delivered || shop.whatsappPhone) && (
          <div className="sl-order-actions">
            {delivered && (
              <Link href={`/t/${token}?placed=1`} className="sl-order-primary">
                {m.viewConfirmation}
                <Icon name="arrowOut" className="sl-arrow-out" />
              </Link>
            )}
            {whatsapp(m.messageShop)}
          </div>
        )}
      </section>
    </ShopFrame>
  );
}

function Meta({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
