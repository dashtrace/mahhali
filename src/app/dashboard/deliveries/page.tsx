import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Alert, Badge, Card, EmptyState, PageHeader, STATUS_TONES, Segmented } from "@/components/ui";
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
import { ItemNote, Landmark } from "../orders/_components/ItemNote";
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

      <div className="mb-4 flex flex-col gap-3">
        <Segmented
          label={t.navDeliveries}
          className="sm:max-w-sm"
          items={(["active", "done"] as const).map((v) => ({ label: v === "active" ? m.viewActive : m.viewDone, href: tabHref(v), current: view === v }))}
        />
        {desk && couriers.length > 0 && (
          <CourierFilter couriers={couriers.map((c) => ({ id: c.id, name: c.name }))} value={courierId ?? ""} label={m.filterCourier} allLabel={m.allCouriers} />
        )}
      </div>

      {!orders.length ? (
        <EmptyState title={view === "active" ? m.noDeliveries : m.noOrders} />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {orders.map((o) => {
            const other = convert(o.codMinor, o.currency, o.usdLbpRate);
            const units = o.items.reduce((n, i) => n + i.qty, 0);
            return (
              <li key={o.id}>
                <Card className="flex h-full flex-col gap-3 rounded-[17px] p-4">
                  <div className="flex items-center justify-between gap-2">
                    {desk ? (
                      <Link href={`/dashboard/orders/${o.id}`} className="inline-flex min-h-11 items-center gap-1 text-[17px] font-extrabold tabular-nums text-sl-accent hover:underline">
                        #{o.number}
                        <Icon name="next" className="size-4" />
                      </Link>
                    ) : (
                      <span className="text-[17px] font-extrabold tabular-nums">#{o.number}</span>
                    )}
                    <Badge tone={STATUS_TONES[o.status]}>{statusLabel(t, o.status)}</Badge>
                  </div>

                  <div>
                    <p className="font-bold">{o.customerName}</p>
                    <p className="text-sm">{o.addressLine}</p>
                    <p className="text-sm text-sl-muted">
                      <bdi>
                        {o.area}, {o.district}
                      </bdi>
                      , {govLabel(m, o.governorate)}
                    </p>
                    {o.landmark && <Landmark label={m.landmark} text={o.landmark} />}
                    {o.notes && <p className="mt-2 whitespace-pre-line text-sm text-sl-muted">{o.notes}</p>}
                  </div>

                  <div className="border-t border-sl-border pt-3">
                    <p className="mb-1 flex items-center justify-between gap-2 text-xs font-bold text-sl-muted">
                      {units === 1 ? m.oneItem : fill(m.items, { n: units })}
                      {desk && o.courier && (
                        <span className="inline-flex min-w-0 items-center gap-1">
                          <Icon name="truck" className="size-4 shrink-0" />
                          <span className="truncate">{o.courier.name}</span>
                        </span>
                      )}
                    </p>
                    <ul className="flex flex-col gap-1.5 text-sm">
                      {o.items.map((i, idx) => (
                        <li key={idx}>
                          <bdi className="font-semibold">{i.nameSnapshot}</bdi> <span className="text-sl-muted tabular-nums">× {i.qty}</span>
                          {i.note && <ItemNote label={m.itemNote} note={i.note} />}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <ContactButtons phone={o.customerPhone} call={t.call} whatsapp={t.whatsapp} />

                  {view === "active" ? (
                    <>
                      <div className="rounded-sl bg-sl-soft px-3.5 py-3 text-sl-soft-ink">
                        <p className="text-xs font-bold uppercase tracking-[0.15em] rtl:tracking-normal">{m.toCollect}</p>
                        <p className="text-2xl font-extrabold tabular-nums">{formatMoney(o.codMinor, o.currency, locale)}</p>
                        {other && <p className="text-sm tabular-nums opacity-80">≈ {formatMoney(other.minor, other.currency, locale)}</p>}
                      </div>
                      {o.canComplete && canComplete ? (
                        <DeliverForm orderId={o.id} currency={o.currency} codMinor={o.codMinor} m={m} t={t} />
                      ) : (
                        <Alert tone="note">{m.waitingPickup}</Alert>
                      )}
                    </>
                  ) : (
                    <div className="rounded-sl bg-sl-cat px-3.5 py-3 text-sm">
                      <p>
                        <span className="font-bold">{o.status === "DELIVERED" ? m.reportedCash : m.failureReason}: </span>
                        <span className="tabular-nums">
                          {o.status === "DELIVERED" ? reportedCash(o.reportedUsdCents, o.reportedLbp, locale) : (o.failureReason ?? "—")}
                        </span>
                      </p>
                      {o.deliveredAt && <p className="text-xs text-sl-muted">{formatDateTime(o.deliveredAt, locale)}</p>}
                    </div>
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
