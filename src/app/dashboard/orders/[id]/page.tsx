import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { Badge, Card, DefinitionList, PageHeader, STATUS_TONES, Timeline, cx } from "@/components/ui";
import { fill, type Locale } from "@/i18n/locale";
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
import { ContactButtons } from "../_components/Contact";
import { DeliverForm } from "../_components/DeliverForm";
import { ItemNote, Landmark } from "../_components/ItemNote";
import { govLabel, reportedCash, shortDateTime, statusLabel } from "../_components/labels";
import { CourierForm, EditOrderForm, StatusActions } from "../_components/OrderActions";

export const metadata = { title: "Order" };

type Messages = (typeof orderMessages)["en"];
type Common = (typeof common)["en"];
type Event = { id: string; type: "STATUS" | "COURIER"; fromValue: string | null; toValue: string; at: string };

// The forward path drawn as steps; Cancelled and Returned replace the step they stopped before.
const FLOW = ["NEW", "CONFIRMED", "PACKED", "OUT_FOR_DELIVERY", "DELIVERED"];
const FLOW_ICONS: IconName[] = ["bag", "check", "box", "truck", "home"];

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
  const units = o.items.reduce((n, i) => n + i.qty, 0);
  const steps = progress(o.status, o.events, t, locale);

  return (
    <>
      <PageHeader
        back={{ href: "/dashboard", label: m.boardTitle }}
        title={
          <span className="flex items-center gap-2">
            <span className="tabular-nums">{fill(m.orderTitle, { n: o.number })}</span>
            <Badge tone={STATUS_TONES[o.status]}>{statusLabel(t, o.status)}</Badge>
          </span>
        }
        subtitle={fill(m.placedAt, { date: formatDateTime(o.createdAt, locale) })}
      />

      <Card className="mb-4 rounded-[17px] p-4 shadow-[0_7px_20px_#00000005] sm:p-5">
        <h2 className="sr-only">{m.progress}</h2>
        <Timeline steps={steps.steps} current={steps.current} tone={steps.bad ? "bad" : undefined} label={m.progress} />
        <ul className="mt-5 grid grid-cols-2 gap-x-3 gap-y-4 border-t border-sl-border pt-4 lg:grid-cols-4">
          <Fact icon="cash" label={m.payment} value={m.cod} note={`${m.toCollect}: ${money(o.codMinor)}`} />
          <Fact icon="pin" label={m.deliveryArea} value={`${o.area}, ${o.district}`} />
          <Fact icon="truck" label={m.courierTitle} value={o.courier?.name ?? m.unassigned} />
          <Fact icon="box" label={m.itemsTitle} value={units === 1 ? m.oneItem : fill(m.items, { n: units })} note={o.source === "MANUAL" ? m.manualBadge : undefined} />
        </ul>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          {(o.status === "OUT_FOR_DELIVERY" || o.status === "DELIVERED" || o.status === "RETURNED") && (
            <Section id="deliver" title={m.deliverTitle}>
              {o.status === "DELIVERED" && (
                <DefinitionList
                  items={[
                    { label: m.deliveredBy, value: o.deliveredBy?.name ?? "—" },
                    { label: m.deliveredAt, value: o.deliveredAt ? formatDateTime(o.deliveredAt, locale) : "—" },
                    { label: m.courierTitle, value: o.courier?.name ?? m.unassigned },
                    { label: m.reportedCash, value: <span className="tabular-nums">{reportedCash(o.reportedUsdCents, o.reportedLbp, locale)}</span> },
                  ]}
                />
              )}
              {o.status === "RETURNED" && <DefinitionList items={[{ label: m.failureReason, value: o.failureReason ?? "—" }]} />}
              {o.status === "OUT_FOR_DELIVERY" && (
                <>
                  <div className="mb-3 rounded-sl bg-sl-soft px-3.5 py-3 text-sl-soft-ink">
                    <p className="text-xs font-bold uppercase tracking-[0.15em] rtl:tracking-normal">{m.toCollect}</p>
                    <p className="text-2xl font-extrabold tabular-nums">{money(o.codMinor)}</p>
                  </div>
                  {deliverable && <DeliverForm orderId={o.id} currency={o.currency} codMinor={o.codMinor} m={m} t={t} />}
                </>
              )}
            </Section>
          )}

          {can(actor.role, "order.transition") && !isFinal(o.status) && o.status !== "OUT_FOR_DELIVERY" && (
            <Section title={m.nextStep}>
              <StatusActions orderId={o.id} allowedNext={o.allowedNext} hasCourier={!!o.courierId} m={m} t={t} />
            </Section>
          )}

          <Section title={m.customer}>
            <p className="font-bold">{o.customerName}</p>
            <p className="text-sm text-sl-muted">
              <bdi dir="ltr">{o.customerPhone}</bdi>
            </p>
            {o.customerEmail && (
              <p className="text-sm text-sl-muted">
                <bdi dir="ltr">{o.customerEmail}</bdi>
              </p>
            )}
            {o.customer.orderCount > 1 && <p className="mt-1 text-xs text-sl-muted">{fill(m.customerOrders, { n: o.customer.orderCount })}</p>}
            <ContactButtons phone={o.customerPhone} call={t.call} whatsapp={t.whatsapp} className="mt-3" />
          </Section>

          <Section title={m.address}>
            <p className="font-bold">{o.addressLine}</p>
            <p className="text-sm text-sl-muted">
              <bdi>
                {o.area}, {o.district}
              </bdi>
              , {govLabel(m, o.governorate)}
            </p>
            {o.landmark && <Landmark label={m.landmark} text={o.landmark} />}
            <h3 className="mt-4 text-[13px] font-bold text-sl-muted">{m.notes}</h3>
            <p className="whitespace-pre-line text-sm">{o.notes || m.noNotes}</p>
            {canCourier && isEditable(o.status) && (
              <div className="mt-4">
                <EditOrderForm orderId={o.id} address={o} notes={o.notes} m={m} t={t} />
              </div>
            )}
          </Section>
        </div>

        <div className="flex flex-col gap-4">
          <Section title={m.itemsTitle}>
            <ul className="divide-y divide-sl-border">
              {o.items.map((i) => (
                <li key={i.id} className="flex gap-3 py-3 first:pt-0">
                  <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-sl-sm bg-sl-cat text-sl-accent">
                    <Icon name="box" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold">{i.nameSnapshot}</p>
                    <p className="text-xs text-sl-muted tabular-nums">{fill(m.unitPrice, { price: money(i.unitPriceMinor) })}</p>
                    {i.note && <ItemNote label={m.itemNote} note={i.note} />}
                  </div>
                  <div className="shrink-0 text-end">
                    <p className="text-sm font-extrabold tabular-nums">{money(i.unitPriceMinor * i.qty)}</p>
                    <p className="text-xs text-sl-muted">{fill(m.qtyN, { n: i.qty })}</p>
                  </div>
                </li>
              ))}
            </ul>
            <dl className="mt-2 flex flex-col gap-1.5 border-t border-sl-border pt-3 text-sm">
              <Row label={m.subtotal} value={money(o.subtotalMinor)} />
              <Row label={m.deliveryFee} value={money(o.deliveryFeeMinor)} />
              <Row label={m.total} value={money(o.totalMinor)} strong />
            </dl>
            {other && (
              <p className="mt-1 text-end text-xs text-sl-muted">
                {fill(m.atRate, { amount: formatMoney(other.minor, other.currency, locale), rate: formatNumber(Number(o.usdLbpRate), locale) })}
              </p>
            )}
          </Section>

          {canCourier && (
            <Section id="courier" title={m.courierTitle}>
              {isFinal(o.status) ? (
                <p className="text-sm">
                  {o.courier?.name ?? m.unassigned} <span className="block text-xs text-sl-muted">{m.courierClosed}</span>
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
              )}
            </Section>
          )}

          <Section title={m.history}>
            <ol>
              {o.events.map((e, idx) => (
                <li key={e.id} className="flex gap-3">
                  <span aria-hidden className="flex flex-col items-center">
                    <span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-sl-accent ring-4 ring-sl-soft" />
                    {idx < o.events.length - 1 && <span className="my-1 w-0.5 flex-1 bg-sl-border" />}
                  </span>
                  <div className="min-w-0 pb-4 text-sm">
                    <p className="font-bold">{eventText(e, m, t)}</p>
                    {e.note && <p className="break-words text-sl-fg">{e.note}</p>}
                    <p className="text-xs text-sl-muted">
                      <bdi>{e.actorName ?? (e.type === "STATUS" && e.toValue === "NEW" && o.source === "CATALOGUE" ? m.byCustomer : m.bySystem)}</bdi> ·{" "}
                      <time dateTime={e.at}>{formatDateTime(e.at, locale)}</time>
                    </p>
                  </div>
                </li>
              ))}
            </ol>
            {o.source === "MANUAL" && (
              <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-sl-muted">
                <Badge>{m.manualBadge}</Badge> {m.firstContact}: {formatDateTime(o.firstContactAt, locale)}
              </p>
            )}
          </Section>
        </div>
      </div>

      <CopyLink url={o.trackingUrl} label={m.trackingLink} copy={m.copyLink} copied={m.copied} />
    </>
  );
}

/** Timeline steps: dates from the status events, the stop point painted red for Cancelled/Returned. */
function progress(status: string, events: Event[], t: Common, locale: Locale) {
  const moves = events.filter((e) => e.type === "STATUS");
  const reachedAt = (s: string) => moves.filter((e) => e.toValue === s).pop()?.at;
  const steps = FLOW.map((s, i) => {
    const at = reachedAt(s);
    return { label: statusLabel(t, s), icon: FLOW_ICONS[i], date: at ? shortDateTime(at, locale) : undefined };
  });
  const bad = status === "CANCELLED" || status === "RETURNED";
  if (!bad) return { steps, current: FLOW.indexOf(status), bad };
  const last = moves[moves.length - 1];
  const current = Math.min(FLOW.indexOf(last?.fromValue ?? "NEW") + 1, FLOW.length - 1);
  steps[current] = { label: statusLabel(t, status), icon: "x", date: last ? shortDateTime(last.at, locale) : undefined };
  return { steps: steps.map((s, i) => (i > current ? { ...s, date: undefined } : s)), current, bad };
}

function Fact({ icon, label, value, note }: { icon: IconName; label: string; value: ReactNode; note?: ReactNode }) {
  return (
    <li className="flex min-w-0 gap-2.5">
      <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-sl-cat text-sl-accent">
        <Icon name={icon} className="size-4" />
      </span>
      <div className="min-w-0 text-sm">
        <p className="text-xs text-sl-muted">{label}</p>
        <p className="font-bold [overflow-wrap:anywhere]">{value}</p>
        {note && <p className="text-xs text-sl-muted tabular-nums">{note}</p>}
      </div>
    </li>
  );
}

function Section({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <Card id={id} className={cx(id && "scroll-mt-20")}>
      <h2 className="sl-heading mb-3 text-lg">{title}</h2>
      {children}
    </Card>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cx("flex justify-between", strong && "border-t border-sl-border pt-1.5 text-base font-extrabold")}>
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

function eventText(e: { type: "STATUS" | "COURIER"; fromValue: string | null; toValue: string }, m: Messages, t: Common) {
  if (e.type === "COURIER") {
    // The service records an unassignment as "Unassigned".
    return e.toValue === "Unassigned" ? m.eventCourierRemoved : fill(m.eventCourier, { name: e.toValue });
  }
  if (!e.fromValue) return m.eventPlaced;
  return fill(m.eventStatus, { from: statusLabel(t, e.fromValue), to: statusLabel(t, e.toValue) });
}
