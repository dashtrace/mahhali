import Link from "next/link";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Alert, PageHeader } from "@/components/ui";
import { fill, type Locale } from "@/i18n/locale";
import { common } from "@/i18n/messages/common";
import { orderMessages } from "@/i18n/messages/orders";
import { getLocale } from "@/i18n/server";
import { convert, formatDateTime, formatMoney } from "@/lib/format";
import { can } from "@/server/domain/policy";
import { plain } from "@/server/http/json";
import { courierService } from "@/server/services/courierService";
import { orderService } from "@/server/services/orderService";
import { DeliveryOrdersQuery } from "@/server/validation/order";
import { pageActor } from "../../_server/session";
import { DashIcon } from "../_components/DashIcon";
import { StatusBadge } from "../_components/StatusBadge";
import { ContactButtons } from "../orders/_components/Contact";
import { DeliverForm } from "../orders/_components/DeliverForm";
import { ItemNote, Landmark } from "../orders/_components/ItemNote";
import { govLabel, reportedCash, statusLabel } from "../orders/_components/labels";
import { DeliveryFilters, DeliveryList } from "./DeliveryFilters";

export const metadata = { title: "Deliveries" };

const DAY_MS = 24 * 60 * 60 * 1000;
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
// orderRepo.forCourier stops here.
const ROW_CAP = 200;

type Sp = { view?: string; courierId?: string; from?: string; to?: string };

export default async function DeliveriesPage({ searchParams }: { searchParams: Promise<Sp> }) {
  const actor = await pageActor("order.readAssigned", "/dashboard/deliveries");
  const sp = await searchParams;
  const locale = await getLocale();
  const m = orderMessages[locale];
  const t = common[locale];
  const view = sp.view === "done" ? "done" : "active";
  const desk = can(actor.role, "order.read");
  const canCash = can(actor.role, "reconciliation.read");
  const courierId = desk ? sp.courierId || undefined : undefined;
  // Same rules as the API: a hand-typed bad range falls back to the default instead of failing the page.
  const range = DeliveryOrdersQuery.safeParse({ view, from: sp.from || undefined, to: sp.to || undefined });
  const from = range.success ? range.data.from : undefined;
  const to = range.success ? range.data.to : undefined;
  const today = isoDay(Date.now());
  const monthAgo = isoDay(Date.now() - 29 * DAY_MS);
  const dated = Boolean(from || to);
  // To deliver stays complete without dates: an old order still waiting must not drop off a courier's list.
  const dates = view === "done" && !dated ? { from: monthAgo, to: today } : { from, to };
  const [all, couriers] = await Promise.all([
    orderService.deliveryList(actor, { view, courierId, ...dates }).then(plain),
    desk && can(actor.role, "courier.read") ? courierService.list(actor, {}) : [],
  ]);
  // Returned orders live under Orders for desk roles; a courier has only this list to see them in.
  const orders = view === "done" && desk ? all.filter((o) => o.status === "DELIVERED") : all;
  // The boxes show what the list really covers, so the range reaches back to the oldest undelivered order.
  const defaultFrom = view === "active" && !dated ? orders.reduce((d, o) => (o.createdAt.slice(0, 10) < d ? o.createdAt.slice(0, 10) : d), monthAgo) : monthAgo;
  const canComplete = can(actor.role, "order.markDelivered");
  const tabHref = (v: string) => `?${new URLSearchParams({ view: v, ...(courierId ? { courierId } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}) })}`;
  const courierOptions = [...couriers]
    .sort((a, b) => Number(b.active) - Number(a.active))
    .map((c) => ({ id: c.id, label: c.active ? c.name : fill(m.courierInactive, { name: c.name }) }));

  return (
    <>
      <AutoRefresh seconds={30} />
      <PageHeader title={desk ? t.navDeliveries : m.myDeliveries} subtitle={desk ? m.deliveriesHint : undefined} />
      {actor.role === "delivery" && !actor.courierId && <Alert tone="warning" className="mb-4">{m.noCourierLink}</Alert>}
      {!range.success && <Alert tone="warning" className="mb-4">{m.rangeInvalid}</Alert>}

      <nav className="segbar" aria-label={t.navDeliveries}>
        {(["active", "done"] as const).map((v) => (
          <Link key={v} href={tabHref(v)} aria-current={view === v ? "page" : undefined}>
            {v === "active" ? m.viewActive : m.viewDone}
          </Link>
        ))}
      </nav>

      <DeliveryFilters key={view} view={view} from={from} to={to} defaultFrom={defaultFrom} defaultTo={today} courierId={courierId} couriers={courierOptions} m={m} />

      {orders.length ? (
        <DeliveryList
          key={`${view}:${courierId ?? ""}:${from ?? ""}:${to ?? ""}`}
          one={!desk}
          m={m}
          title={
            <>
              {view === "active" ? m.viewActive : desk ? m.viewDone : m.deliveredAndReturned}{" "}
              <span className="muted">· {orders.length === 1 ? m.oneOrder : fill(m.nOrders, { n: orders.length })}</span>
            </>
          }
        >
          {orders.map((o) => (
            <DeliveryCard key={o.id} o={o} desk={desk} canComplete={canComplete} locale={locale} />
          ))}
        </DeliveryList>
      ) : (
        <div className="empty mt-5">{view === "done" || courierId || dated ? m.noFilterMatch : m.noDeliveries}</div>
      )}
      {all.length >= ROW_CAP && <div className="callout">{m.deliveriesCap}</div>}

      <div className="info-inline mt-5">
        <DashIcon name="info" size="sm" />
        {!desk && <> {m.cashNotHandedOver}</>}
        {desk && (
          <>
            {" "}
            {m.closedOrdersIn}{" "}
            <Link className="font-extrabold underline" href="/dashboard?view=history">
              {m.ordersHistoryLink}
            </Link>
            .
          </>
        )}
        {canCash && (
          <>
            {" "}
            {m.cashSettlementIn}{" "}
            <Link className="font-extrabold underline" href="/dashboard/cash">
              {t.navCashFull}
            </Link>
            .
          </>
        )}
      </div>
    </>
  );
}

type Row = Awaited<ReturnType<typeof orderService.deliveryList>>[number];

function DeliveryCard({ o, desk, canComplete, locale }: { o: ReturnType<typeof plain<Row>>; desk: boolean; canComplete: boolean; locale: Locale }) {
  const m = orderMessages[locale];
  const t = common[locale];
  const other = convert(o.codMinor, o.currency, o.usdLbpRate);
  const title = fill(m.orderTitle, { n: o.number });
  const delivered = o.status === "DELIVERED";
  const returned = o.status === "RETURNED";
  return (
    <article className="card m-0 min-w-0">
      <div className="between">
        {desk ? (
          <Link href={`/dashboard/orders/${o.id}`} className="bold">
            {title} <DashIcon name="arrow" size="tiny" />
          </Link>
        ) : (
          <span className="bold">{title}</span>
        )}
        <StatusBadge status={o.status} label={statusLabel(t, o.status)} />
      </div>
      <p className="delivery-name">
        <bdi>{o.customerName}</bdi>
      </p>
      {desk ? (
        <p className="hint mb-3">
          <bdi>
            {o.area}, {o.district}
          </bdi>
          {o.items.map((i, idx) => (
            <span key={idx} className="block">
              <bdi>{i.nameSnapshot}</bdi> × {i.qty}
            </span>
          ))}
        </p>
      ) : (
        <>
          {/* The courier has no order page: everything needed at the door is on this card. */}
          <p className="hint mb-0">
            <bdi>{o.addressLine}</bdi>
            <br />
            <bdi>
              {o.area}, {o.district}
            </bdi>
            , {govLabel(m, o.governorate)}
          </p>
          {o.landmark && <Landmark label={m.landmark} text={o.landmark} />}
          {o.notes && <p className="hint mt-2 mb-0 whitespace-pre-line">{o.notes}</p>}
          <ul className="hint mt-0.5 mb-3">
            {o.items.map((i, idx) => (
              <li key={idx}>
                <bdi>{i.nameSnapshot}</bdi> × {i.qty}
                {i.note && <ItemNote label={m.itemNote} note={i.note} />}
              </li>
            ))}
          </ul>
        </>
      )}
      <ContactButtons phone={o.customerPhone} call={t.call} whatsapp={t.whatsapp} />
      <div className="cash-box">
        <div className="eyebrow">{delivered || returned ? m.codFromOrder : m.cashToCollect}</div>
        {/* Wraps only when the amount and courier name can't share a row in a narrow card. */}
        <div className="between wrap">
          <strong className="tabular-nums">{formatMoney(o.codMinor, o.currency, locale)}</strong>
          {desk && <span className="small">{o.courier?.name ?? m.notAssigned}</span>}
        </div>
        {!desk && other && <p className="hint mb-0 tabular-nums">≈ {formatMoney(other.minor, other.currency, locale)}</p>}
      </div>
      {o.canComplete && canComplete && !desk ? (
        <>
          <p className="hint mt-2.5 mb-0">{m.stageOut}</p>
          <DeliverForm orderId={o.id} currency={o.currency} codMinor={o.codMinor} m={m} t={t} />
        </>
      ) : (
        <p className="hint mt-2.5 mb-0">
          {delivered && desk ? (
            m.stageDeliveredDesk
          ) : delivered ? (
            <>
              {m.stageDelivered} · {m.reportedCash}: <span className="tabular-nums">{reportedCash(o.reportedUsdCents, o.reportedLbp, locale)}</span>
              {o.deliveredAt && (
                <>
                  <br />
                  {formatDateTime(o.deliveredAt, locale)}
                </>
              )}
            </>
          ) : returned ? (
            <>
              {m.stageReturned} · {m.failureReason}: {o.failureReason ?? "—"}
            </>
          ) : o.status === "PACKED" ? (
            m.stagePacked
          ) : (
            m.stageOut
          )}
        </p>
      )}
    </article>
  );
}
