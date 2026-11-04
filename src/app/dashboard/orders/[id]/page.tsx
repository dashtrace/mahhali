import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { fill } from "@/i18n/locale";
import { common } from "@/i18n/messages/common";
import { orderMessages } from "@/i18n/messages/orders";
import { getLocale } from "@/i18n/server";
import { convert, formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import { isEditable, isFinal } from "@/server/domain/orderStatus";
import { can } from "@/server/domain/policy";
import { AppError } from "@/server/http/errors";
import { plain } from "@/server/http/json";
import { courierService } from "@/server/services/courierService";
import { orderService } from "@/server/services/orderService";
import { pageActor } from "../../../_server/session";
import { CopyLink } from "../../_components/Board";
import { DashIcon } from "../../_components/DashIcon";
import { StatusBadge } from "../../_components/StatusBadge";
import { remittanceHref } from "../../cash/remittance";
import { ContactButtons } from "../_components/Contact";
import { DeliverForm } from "../_components/DeliverForm";
import { ItemNote, Landmark } from "../_components/ItemNote";
import { dayMonthYear, govLabel, reportedCash, statusLabel } from "../_components/labels";
import { CourierForm, EditOrderForm, StatusActions } from "../_components/OrderActions";

export const metadata = { title: "Order" };

type Messages = (typeof orderMessages)["en"];
type Common = (typeof common)["en"];

const FLOW = ["NEW", "CONFIRMED", "PACKED", "OUT_FOR_DELIVERY", "DELIVERED"];

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await pageActor("order.read", `/dashboard/orders/${id}`);
  const locale = await getLocale();
  const m = orderMessages[locale];
  const t = common[locale];

  let detail;
  try {
    detail = await orderService.get(actor, id);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }
  const o = plain(detail);
  const canCourier = can(actor.role, "order.assignCourier");
  const couriers = canCourier ? await courierService.list(actor, { active: true }) : [];
  const money = (minor: number) => formatMoney(minor, o.currency, locale);
  const other = convert(o.totalMinor, o.currency, o.usdLbpRate);
  const deliverable = o.status === "OUT_FOR_DELIVERY" && can(actor.role, "order.markDelivered");
  const closed = o.status === "CANCELLED" || o.status === "RETURNED";
  const courierName = o.courier?.name ?? m.notAssigned;

  return (
    <>
      <Link href="/dashboard" className="btn tiny mb-[18px]">
        <DashIcon name="left" size="sm" />
        {m.backToOrders}
      </Link>
      <PageHeader
        title={<span className="tabular-nums">{fill(m.orderTitle, { n: o.number })}</span>}
        subtitle={fill(m.placedLine, { name: o.customerName, date: dayMonthYear(o.createdAt, locale) })}
        actions={<StatusBadge status={o.status} label={statusLabel(t, o.status)} />}
      />

      <div className="card">
        {closed ? (
          <div className="callout mt-0">
            <DashIcon name="info" size="sm" /> {o.status === "CANCELLED" ? m.cancelledNote : m.returnedNote}
          </div>
        ) : (
          <ol className="progress-line">
            {FLOW.map((s, i) => {
              const done = i <= FLOW.indexOf(o.status);
              return (
                <li key={s} className={`progress-stop ${done ? "done" : ""}`} aria-current={s === o.status ? "step" : undefined}>
                  <span>{done ? <DashIcon name="check" size="sm" /> : i + 1}</span>
                  <strong>{statusLabel(t, s)}</strong>
                  <small>{done ? m.stepDone : m.stepPending}</small>
                </li>
              );
            })}
          </ol>
        )}
        <div className="split3">
          <div>
            <span className="eyebrow">{m.payment}</span>
            <p className="bold mb-[14px]">{m.cod}</p>
            <p className="hint tabular-nums">{money(o.codMinor)}</p>
          </div>
          <div>
            <span className="eyebrow">{m.deliveryArea}</span>
            <p className="bold">
              <bdi>
                {o.area}, {o.district}
              </bdi>
            </p>
          </div>
          <div>
            <span className="eyebrow">{m.courierTitle}</span>
            <p className="bold">
              <bdi>{courierName}</bdi>
            </p>
          </div>
        </div>
      </div>

      <div className="split items-start">
        <div className="min-w-0">
          <div className="card">
            <h2>{m.customerAddress}</h2>
            <b>
              <bdi>{o.customerName}</bdi>
            </b>
            <p className="hint">
              <bdi dir="ltr">{o.customerPhone}</bdi>
              {o.customerEmail && (
                <>
                  {" · "}
                  <bdi dir="ltr">{o.customerEmail}</bdi>
                </>
              )}
              <br />
              <bdi>{o.addressLine}</bdi>
              <br />
              <bdi>
                {o.area}, {o.district}
              </bdi>
              , {govLabel(m, o.governorate)}
            </p>
            {o.landmark && <Landmark label={m.landmark} text={o.landmark} />}
            <p className="hint mt-3 whitespace-pre-line">{o.notes || m.noAdditionalNotes}</p>
            {o.customer.orderCount > 1 && <p className="hint">{fill(m.customerOrders, { n: o.customer.orderCount })}</p>}
            <ContactButtons phone={o.customerPhone} call={t.call} whatsapp={t.whatsapp} />
            {canCourier && isEditable(o.status) && <EditOrderForm orderId={o.id} address={o} notes={o.notes} m={m} t={t} />}
          </div>

          <div id="deliver" className="card scroll-mt-20">
            <h2>{m.nextStep}</h2>
            {isFinal(o.status) ? (
              <p className="hint mb-0">{m.readOnly}</p>
            ) : (
              <>
                <p className="hint">{m.nextHint}</p>
                {can(actor.role, "order.transition") && o.status !== "OUT_FOR_DELIVERY" && (
                  <StatusActions
                    order={o}
                    allowedNext={o.allowedNext}
                    assign={canCourier ? { couriers: couriers.map((c) => ({ id: c.id, name: c.name })), canAddCourier: can(actor.role, "courier.write") } : null}
                    m={m}
                    t={t}
                  />
                )}
                {o.status === "OUT_FOR_DELIVERY" && (
                  <>
                    <div className="cash-box">
                      <div className="eyebrow">{m.cashToCollect}</div>
                      <strong className="tabular-nums">{money(o.codMinor)}</strong>
                    </div>
                    {deliverable && <DeliverForm orderId={o.id} currency={o.currency} codMinor={o.codMinor} m={m} t={t} />}
                  </>
                )}
              </>
            )}
          </div>

          {/* Choosing a courier here doesn't send the order out, so it can be set or changed at any active step. */}
          {(canCourier || o.status === "DELIVERED" || o.status === "RETURNED") && (
            <div className="card">
              <h2>{o.status === "OUT_FOR_DELIVERY" || o.status === "DELIVERED" || o.status === "RETURNED" ? m.courierCash : m.courierTitle}</h2>
              {canCourier &&
                (isFinal(o.status) ? (
                  <p className="hint">
                    <b>
                      <bdi>{courierName}</bdi>
                    </b>
                    <br />
                    {m.courierClosed}
                  </p>
                ) : (
                  <CourierForm
                    // Remount after a save so the select follows the server value
                    key={o.courierId ?? ""}
                    orderId={o.id}
                    courierId={o.courierId}
                    couriers={couriers.map((c) => ({ id: c.id, name: c.name }))}
                    canAddCourier={can(actor.role, "courier.write")}
                    m={m}
                    t={t}
                  />
                ))}
              {o.status === "DELIVERED" && (
                <div className="line-list">
                  <Line label={m.deliveredBy} value={<bdi>{o.deliveredBy?.name ?? "—"}</bdi>} />
                  <Line label={m.deliveredAt} value={o.deliveredAt ? formatDateTime(o.deliveredAt, locale) : "—"} />
                  <Line label={m.reportedCash} value={<span className="tabular-nums">{reportedCash(o.reportedUsdCents, o.reportedLbp, locale)}</span>} />
                  <div className="line-item">
                    <span className="hint">{o.remittanceLine ? m.cashSettled : m.cashNotSettled}</span>
                    {o.remittanceLine && can(actor.role, "reconciliation.read") && (
                      <Link href={remittanceHref(o.remittanceLine.remittanceId)} className="btn tiny">
                        {m.viewRemittance}
                      </Link>
                    )}
                  </div>
                </div>
              )}
              {o.status === "RETURNED" && <Line label={m.failureReason} value={o.failureReason ?? "—"} />}
            </div>
          )}
        </div>

        <div className="min-w-0">
          <div className="card">
            <h2>{m.itemsTotal}</h2>
            <div>
              {o.items.map((i) => (
                <div key={i.id} className="line-item pt-3.5">
                  <div className="min-w-0">
                    <b>
                      <bdi>{i.nameSnapshot}</bdi>
                    </b>
                    <p className="hint mt-1 mb-0 tabular-nums">
                      {fill(m.quantityN, { n: i.qty })}
                      {i.qty > 1 && <> · {fill(m.unitPrice, { price: money(i.unitPriceMinor) })}</>}
                    </p>
                    {i.note && <ItemNote label={m.itemNote} note={i.note} />}
                  </div>
                  <b className="shrink-0 tabular-nums">{money(i.unitPriceMinor * i.qty)}</b>
                </div>
              ))}
            </div>
            {o.deliveryFeeMinor > 0 && (
              <>
                <div className="between mb-1.5 text-[var(--muted)]">
                  <span>{m.subtotal}</span>
                  <span className="tabular-nums">{money(o.subtotalMinor)}</span>
                </div>
                <div className="between mb-3 text-[var(--muted)]">
                  <span>{m.deliveryFee}</span>
                  <span className="tabular-nums">{money(o.deliveryFeeMinor)}</span>
                </div>
              </>
            )}
            <div className="between">
              <b>{m.total}</b>
              <b className="tabular-nums">{money(o.totalMinor)}</b>
            </div>
            {other && (
              <p className="hint mt-1 mb-0 text-end">
                {fill(m.atRate, { amount: formatMoney(other.minor, other.currency, locale), rate: formatNumber(Number(o.usdLbpRate), locale) })}
              </p>
            )}
          </div>

          <div className="card">
            <h2>{m.history}</h2>
            <div>
              {o.events.map((e) => (
                <div key={e.id} className="line-item pt-3.5">
                  <div className="min-w-0">
                    <span>
                      <DashIcon name="check" size="sm" /> {eventText(e, m, t)}
                    </span>
                    {e.note && <p className="mt-1 break-words">{e.note}</p>}
                    <p className="hint mt-1 mb-0">
                      <bdi>{e.actorName ? fill(m.byName, { name: e.actorName }) : e.type === "STATUS" && e.toValue === "NEW" && o.source === "CATALOGUE" ? m.byCustomer : m.bySystem}</bdi>
                    </p>
                  </div>
                  <time dateTime={e.at} className="hint w-28 shrink-0 text-end">
                    {formatDateTime(e.at, locale)}
                  </time>
                </div>
              ))}
            </div>
            {o.source === "MANUAL" && (
              <p className="hint mt-3 mb-0">
                <span className="mini-badge gray">{m.manualBadge}</span> {m.firstContact}: {formatDateTime(o.firstContactAt, locale)}
              </p>
            )}
          </div>
        </div>
      </div>

      <CopyLink url={o.trackingUrl} label={m.trackingLink} hint={m.trackingHint} copy={m.copyLink} copied={m.copied} />
    </>
  );
}

function Line({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="line-item">
      <span className="hint">{label}</span>
      <b className="text-end">{value}</b>
    </div>
  );
}

function eventText(e: { type: "STATUS" | "COURIER"; fromValue: string | null; toValue: string }, m: Messages, t: Common) {
  if (e.type === "COURIER") {
    // The service records an unassignment as "Unassigned".
    return e.toValue === "Unassigned" ? m.eventCourierRemoved : fill(m.eventCourier, { name: e.toValue });
  }
  return e.fromValue ? statusLabel(t, e.toValue) : m.eventPlaced;
}
