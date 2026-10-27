import Link from "next/link";
import { Alert, Badge, Card, EmptyState, PageHeader, STATUS_TONES, cx } from "@/components/ui";
import { fill } from "@/i18n/locale";
import { common } from "@/i18n/messages/common";
import { orderMessages } from "@/i18n/messages/orders";
import { getLocale } from "@/i18n/server";
import { convert, formatDateTime, formatMoney } from "@/lib/format";
import { can } from "@/server/domain/policy";
import { plain } from "@/server/http/json";
import { courierService } from "@/server/services/courierService";
import { orderService } from "@/server/services/orderService";
import { pageActor } from "../../_server/session";
import { CourierFilter } from "../_components/Board";
import { ContactButtons } from "../orders/_components/Contact";
import { DeliverForm } from "../orders/_components/DeliverForm";
import { govLabel, reportedCash, statusLabel } from "../orders/_components/labels";

export const metadata = { title: "Deliveries" };

export default async function DeliveriesPage({ searchParams }: { searchParams: Promise<{ view?: string; courierId?: string }> }) {
  const actor = await pageActor("order.readAssigned", "/dashboard/deliveries");
  const sp = await searchParams;
  const locale = await getLocale();
  const m = orderMessages[locale];
  const t = common[locale];
  const view = sp.view === "done" ? "done" : "active";
  const desk = can(actor.role, "order.read");
  const courierId = desk ? sp.courierId || undefined : undefined;
  const [orders, couriers] = await Promise.all([
    orderService.deliveryList(actor, { view, courierId }).then(plain),
    desk && can(actor.role, "courier.read") ? courierService.list(actor, {}) : [],
  ]);
  const canComplete = can(actor.role, "order.markDelivered");
  const tabHref = (v: string) => `?${new URLSearchParams({ view: v, ...(courierId ? { courierId } : {}) })}`;

  return (
    <>
      <PageHeader title={desk ? t.navDeliveries : m.myDeliveries} subtitle={desk ? m.deliveriesHint : undefined} />
      {actor.role === "delivery" && !actor.courierId && <Alert tone="warning" className="mb-4">{m.noCourierLink}</Alert>}

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <nav className="flex gap-2" aria-label={t.navDeliveries}>
          {(["active", "done"] as const).map((v) => (
            <Link
              key={v}
              href={tabHref(v)}
              aria-current={view === v ? "page" : undefined}
              className={cx(
                "inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium",
                view === v ? "border-[var(--brand)] bg-[var(--brand)] text-[var(--brand-ink)]" : "border-stone-300 bg-white text-stone-700",
              )}
            >
              {v === "active" ? m.viewActive : m.viewDone}
            </Link>
          ))}
        </nav>
        {desk && couriers.length > 0 && (
          <div className="sm:ms-auto">
            <CourierFilter couriers={couriers.map((c) => ({ id: c.id, name: c.name }))} value={courierId ?? ""} label={m.filterCourier} allLabel={m.allCouriers} />
          </div>
        )}
      </div>

      {!orders.length ? (
        <EmptyState title={view === "active" ? m.noDeliveries : m.noOrders} />
      ) : (
        <ul className="flex flex-col gap-3">
          {orders.map((o) => {
            const other = convert(o.codMinor, o.currency, o.usdLbpRate);
            const units = o.items.reduce((n, i) => n + i.qty, 0);
            return (
              <li key={o.id}>
                <Card className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2">
                    {desk ? (
                      <Link href={`/dashboard/orders/${o.id}`} className="inline-flex min-h-11 items-center font-semibold tabular-nums underline-offset-4 hover:underline">
                        #{o.number}
                      </Link>
                    ) : (
                      <span className="font-semibold tabular-nums">#{o.number}</span>
                    )}
                    <Badge tone={STATUS_TONES[o.status]}>{statusLabel(t, o.status)}</Badge>
                  </div>

                  <div>
                    <p className="font-medium">{o.customerName}</p>
                    <p>{o.addressLine}</p>
                    <p className="text-sm text-stone-600">
                      {o.area}, {o.district}, {govLabel(m, o.governorate)}
                    </p>
                    {o.landmark && (
                      <p className="mt-2 rounded-[var(--radius)] bg-amber-50 px-3 py-2 text-sm text-amber-900">
                        <span className="font-medium">{m.landmark}:</span> {o.landmark}
                      </p>
                    )}
                    {o.notes && <p className="mt-2 whitespace-pre-line text-sm text-stone-700">{o.notes}</p>}
                  </div>

                  <p className="text-xs text-stone-500">
                    {o.items.map((i) => `${i.nameSnapshot} × ${i.qty}`).join(" · ")} ({fill(m.items, { n: units })})
                    {desk && o.courier && ` · ${o.courier.name}`}
                  </p>

                  <ContactButtons phone={o.customerPhone} call={t.call} whatsapp={t.whatsapp} />

                  {view === "active" ? (
                    <>
                      <div className="rounded-[var(--radius)] bg-stone-100 px-3 py-2">
                        <p className="text-xs font-medium uppercase tracking-wide text-stone-500">{m.toCollect}</p>
                        <p className="text-2xl font-semibold tabular-nums">{formatMoney(o.codMinor, o.currency, locale)}</p>
                        {other && <p className="text-sm tabular-nums text-stone-600">≈ {formatMoney(other.minor, other.currency, locale)}</p>}
                      </div>
                      {o.canComplete && canComplete ? (
                        <DeliverForm orderId={o.id} currency={o.currency} codMinor={o.codMinor} m={m} t={t} />
                      ) : (
                        <p className="text-sm text-stone-600">{m.waitingPickup}</p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-stone-700">
                      {o.status === "DELIVERED"
                        ? `${m.reportedCash}: ${reportedCash(o.reportedUsdCents, o.reportedLbp, locale)}`
                        : `${m.failureReason}: ${o.failureReason ?? "—"}`}
                      {o.deliveredAt && <span className="block text-xs text-stone-500">{formatDateTime(o.deliveredAt, locale)}</span>}
                    </p>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
