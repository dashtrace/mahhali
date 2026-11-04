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
import { orderService } from "@/server/services/orderService";
import { pageActor } from "../_server/session";
import { BoardClient } from "./_components/Board";
import { DashIcon } from "./_components/DashIcon";
import { PAGE_SIZE } from "./orders/_components/boardPages";

export const metadata = { title: "Orders" };

const ACTIVE: OrderStatus[] = ["NEW", "CONFIRMED", "PACKED", "OUT_FOR_DELIVERY"];
const HISTORY: OrderStatus[] = ["CANCELLED", "RETURNED"];

export default async function OrdersBoardPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; status?: string; q?: string; welcome?: string }>;
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

  const statuses = view === "history" ? HISTORY : ACTIVE;
  const lists = await Promise.all(statuses.map((status) => orderService.list(actor, { status, q, limit: PAGE_SIZE })));
  const pages = Object.fromEntries(statuses.map((s, i) => [s, { orders: lists[i].orders, nextCursor: lists[i].nextCursor }]));
  const viewHref = (v: string, search = q) => `/dashboard?${new URLSearchParams({ ...(v === "history" ? { view: v } : {}), ...(search ? { q: search } : {}) })}`;

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
          <input name="q" type="search" enterKeyHint="search" maxLength={80} defaultValue={q} placeholder={m.searchPlaceholder} aria-label={m.searchLabel} title={m.searchPlaceholder} className="control" />
        </form>
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
        key={`${view}:${selected}:${q ?? ""}`}
        view={view}
        pages={plain(pages) as never}
        counts={lists[0].counts}
        selected={selected}
        q={q}
        locale={locale}
        m={m}
        t={t}
      />
      <div className="info-inline mt-4">
        <DashIcon name="info" size="sm" /> {m.boardNote}
      </div>
    </>
  );
}
