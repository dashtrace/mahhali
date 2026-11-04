import Link from "next/link";
import { redirect } from "next/navigation";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Alert, PageHeader } from "@/components/ui";
import { fill } from "@/i18n/locale";
import { common } from "@/i18n/messages/common";
import { orderMessages } from "@/i18n/messages/orders";
import { getLocale } from "@/i18n/server";
import { ORDER_STATUSES, type OrderStatus } from "@/server/domain/orderStatus";
import { can } from "@/server/domain/policy";
import { plain } from "@/server/http/json";
import { accountService } from "@/server/services/accountService";
import { courierService } from "@/server/services/courierService";
import { appUrl } from "@/server/mail/mailer";
import { orderService } from "@/server/services/orderService";
import { pageActor } from "../_server/session";
import { BoardClient, CopyLink, CourierFilter } from "./_components/Board";
import { DashIcon } from "./_components/DashIcon";
import { PAGE_SIZE } from "./orders/_components/boardPages";

export const metadata = { title: "Orders" };

const ACTIVE: OrderStatus[] = ["NEW", "CONFIRMED", "PACKED", "OUT_FOR_DELIVERY"];
const HISTORY: OrderStatus[] = ["CANCELLED", "RETURNED"];

export default async function OrdersBoardPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; status?: string; courierId?: string; q?: string; welcome?: string }>;
}) {
  const actor = await pageActor("order.read", "/dashboard");
  const sp = await searchParams;
  // Delivered orders moved to Deliveries; old links keep working.
  if (sp.status === "DELIVERED") redirect("/dashboard/deliveries?view=done");
  const locale = await getLocale();
  const m = orderMessages[locale];
  const t = common[locale];
  const selected = (ORDER_STATUSES as readonly string[]).includes(sp.status ?? "") ? (sp.status as OrderStatus) : "NEW";
  const view = sp.view === "history" || HISTORY.includes(selected) ? "history" : "active";
  const q = sp.q?.trim() || undefined;
  const courierId = sp.courierId || undefined;

  const statuses = view === "history" ? HISTORY : ACTIVE;
  const [me, lists, allCouriers, found] = await Promise.all([
    accountService.me(actor),
    Promise.all(statuses.map((status) => orderService.list(actor, { status, courierId, q, limit: PAGE_SIZE }))),
    courierService.list(actor, {}),
    // Search covers every status, as each view lists only some. shortcut: the newest 50 matches only, add paging if searches often pass that.
    q ? orderService.list(actor, { courierId, q, limit: 50 }) : null,
  ]);
  const elsewhere = found ? found.orders.filter((o) => !statuses.includes(o.status)) : [];
  const couriers = can(actor.role, "order.assignCourier") ? allCouriers.filter((c) => c.active) : null;
  const pages = Object.fromEntries(statuses.map((s, i) => [s, { orders: lists[i].orders, nextCursor: lists[i].nextCursor }]));
  const viewHref = (v: string, search = q) =>
    `/dashboard?${new URLSearchParams({ ...(v === "history" ? { view: v } : {}), ...(courierId ? { courierId } : {}), ...(search ? { q: search } : {}) })}`;

  return (
    <>
      <PageHeader
        title={m.boardTitle}
        subtitle={can(actor.role, "reconciliation.read") ? m.ordersHint : m.ordersHintNoCash}
        actions={
          can(actor.role, "order.create") && (
            <Link href="/dashboard/orders/new" className="btn primary">
              <DashIcon name="plus" size="sm" />
              {m.newOrder}
            </Link>
          )
        }
      />
      {sp.welcome && <Alert tone="success" className="mb-4">{m.welcome}</Alert>}
      <div className="between wrap mb-3">
        <nav className="segbar m-0" aria-label={m.boardTitle}>
          <Link href={viewHref("active")} aria-current={view === "active" ? "page" : undefined}>
            {m.viewInProgress}
          </Link>
          <Link href={viewHref("history")} aria-current={view === "history" ? "page" : undefined}>
            {m.viewHistory}
          </Link>
        </nav>
        <Link className="btn tiny" href="/dashboard/deliveries?view=done">
          {m.deliveredOrders}
          <DashIcon name="arrow" size="sm" />
        </Link>
      </div>
      <div className="toolbar">
        <form role="search" className="field search m-0">
          {view === "history" && <input type="hidden" name="view" value="history" />}
          {courierId && <input type="hidden" name="courierId" value={courierId} />}
          <input name="q" type="search" enterKeyHint="search" maxLength={80} defaultValue={q} placeholder={m.searchPlaceholder} aria-label={m.searchLabel} title={m.searchPlaceholder} className="control" />
        </form>
        {allCouriers.length > 0 && <CourierFilter couriers={allCouriers.map((c) => ({ id: c.id, name: c.name }))} value={courierId ?? ""} label={m.filterCourier} allLabel={m.allCouriers} />}
        {q ? (
          <span className="hint">
            <bdi>{fill(m.resultsFor, { q })}</bdi> ·{" "}
            <Link href={viewHref(view, "")} className="font-extrabold underline">
              {m.clearSearch}
            </Link>
          </span>
        ) : (
          <span className="hint">{view === "active" ? m.showingActive : m.showingClosed}</span>
        )}
      </div>
      {/* New guest orders show up without a reload. */}
      <AutoRefresh seconds={15} />
      <BoardClient
        // Remount on navigation so the phone tab and loaded pages follow the URL
        key={`${view}:${selected}:${q ?? ""}:${courierId ?? ""}`}
        view={view}
        pages={plain(pages) as never}
        counts={lists[0].counts}
        selected={selected}
        q={q}
        courierId={courierId}
        elsewhere={plain(elsewhere) as never}
        assign={couriers && { couriers: couriers.map((c) => ({ id: c.id, name: c.name })), canAddCourier: can(actor.role, "courier.write") }}
        locale={locale}
        m={m}
        t={t}
      />
      <div className="info-inline mt-4">
        <DashIcon name="info" size="sm" /> {m.boardNote}
      </div>
      {/* The owner has this in Settings; managers and staff have no other place to copy it. */}
      {!can(actor.role, "shop.settings") && (
        <div className="mt-4">
          <CopyLink url={appUrl(`/s/${me.shop.slug}`)} label={m.catalogueLink} copy={m.copyLink} copied={m.copied} />
        </div>
      )}
    </>
  );
}
