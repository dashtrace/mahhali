import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Badge, Card, DefinitionList, PageHeader, STATUS_TONES, cx } from "@/components/ui";
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
import { ContactButtons } from "../_components/Contact";
import { DeliverForm } from "../_components/DeliverForm";
import { govLabel, reportedCash, statusLabel } from "../_components/labels";
import { CourierForm, EditOrderForm, StatusActions } from "../_components/OrderActions";

export const metadata = { title: "Order" };

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

  return (
    <>
      <PageHeader
        back={{ href: "/dashboard", label: m.boardTitle }}
        title={
          <span className="flex items-center gap-2">
            {fill(m.orderTitle, { n: o.number })}
            <Badge tone={STATUS_TONES[o.status]}>{statusLabel(t, o.status)}</Badge>
          </span>
        }
        subtitle={fill(m.placedAt, { date: formatDateTime(o.createdAt, locale) })}
      />

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
                    { label: m.reportedCash, value: reportedCash(o.reportedUsdCents, o.reportedLbp, locale) },
                  ]}
                />
              )}
              {o.status === "RETURNED" && <DefinitionList items={[{ label: m.failureReason, value: o.failureReason ?? "—" }]} />}
              {o.status === "OUT_FOR_DELIVERY" && (
                <>
                  <p className="mb-3 text-sm">
                    {m.toCollect}: <strong className="text-lg tabular-nums">{money(o.codMinor)}</strong>
                  </p>
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
            <p className="font-medium">{o.customerName}</p>
            <p className="text-sm text-stone-600">
              <span dir="ltr">{o.customerPhone}</span>
            </p>
            {o.customerEmail && <p className="text-sm text-stone-600">{o.customerEmail}</p>}
            {o.customer.orderCount > 1 && <p className="mt-1 text-xs text-stone-500">{fill(m.customerOrders, { n: o.customer.orderCount })}</p>}
            <ContactButtons phone={o.customerPhone} call={t.call} whatsapp={t.whatsapp} className="mt-3" />
          </Section>

          <Section title={m.address}>
            <p>{o.addressLine}</p>
            <p className="text-sm text-stone-600">
              {o.area}, {o.district}, {govLabel(m, o.governorate)}
            </p>
            {o.landmark && (
              <p className="mt-2 rounded-[var(--radius)] bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <span className="font-medium">{m.landmark}:</span> {o.landmark}
              </p>
            )}
            <h3 className="mt-4 text-sm font-medium text-stone-500">{m.notes}</h3>
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
            <ul className="divide-y divide-stone-100">
              {o.items.map((i) => (
                <li key={i.id} className="flex justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0">
                    {i.nameSnapshot} <span className="text-stone-500">× {i.qty}</span>
                  </span>
                  <span className="shrink-0 tabular-nums">{money(i.unitPriceMinor * i.qty)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-2 flex flex-col gap-1 border-t border-stone-200 pt-2 text-sm">
              <Row label={m.subtotal} value={money(o.subtotalMinor)} />
              <Row label={m.deliveryFee} value={money(o.deliveryFeeMinor)} />
              <Row label={m.total} value={money(o.totalMinor)} strong />
            </dl>
            {other && (
              <p className="mt-1 text-end text-xs text-stone-500">
                {fill(m.atRate, { amount: formatMoney(other.minor, other.currency, locale), rate: formatNumber(Number(o.usdLbpRate), locale) })}
              </p>
            )}
          </Section>

          {canCourier && (
            <Section id="courier" title={m.courierTitle}>
              {isFinal(o.status) ? (
                <p className="text-sm">
                  {o.courier?.name ?? m.unassigned} <span className="block text-xs text-stone-500">{m.courierClosed}</span>
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
            <ol className="flex flex-col gap-3 border-s-2 border-stone-200 ps-4">
              {o.events.map((e) => (
                <li key={e.id} className="text-sm">
                  <p className="font-medium">{eventText(e, m, t)}</p>
                  {e.note && <p className="text-stone-700">{e.note}</p>}
                  <p className="text-xs text-stone-500">
                    {e.actorName ?? (e.type === "STATUS" && e.toValue === "NEW" && o.source === "CATALOGUE" ? m.byCustomer : m.bySystem)} ·{" "}
                    <time dateTime={e.at}>{formatDateTime(e.at, locale)}</time>
                  </p>
                </li>
              ))}
            </ol>
            {o.source === "MANUAL" && (
              <p className="mt-3 text-xs text-stone-500">
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

function Section({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <Card id={id} className={cx(id && "scroll-mt-20")}>
      <h2 className="mb-3 font-semibold">{title}</h2>
      {children}
    </Card>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cx("flex justify-between", strong && "font-semibold")}>
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

function eventText(
  e: { type: "STATUS" | "COURIER"; fromValue: string | null; toValue: string },
  m: (typeof orderMessages)["en"],
  t: (typeof common)["en"],
) {
  if (e.type === "COURIER") {
    // The service records an unassignment as "Unassigned".
    return e.toValue === "Unassigned" ? m.eventCourierRemoved : fill(m.eventCourier, { name: e.toValue });
  }
  if (!e.fromValue) return m.eventPlaced;
  return fill(m.eventStatus, { from: statusLabel(t, e.fromValue), to: statusLabel(t, e.toValue) });
}
