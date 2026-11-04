"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type DragEvent, type ReactNode } from "react";
import { Alert, cx } from "@/components/ui";
import { fill, type Locale } from "@/i18n/locale";
import type { CommonMessages } from "@/i18n/messages/common";
import type { OrderMessages } from "@/i18n/messages/orders";
import { api, errorMessage } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { appendOrders, mergeOrders, PAGE_SIZE } from "../orders/_components/boardPages";
import { dayMonthYear, nextActionLabel } from "../orders/_components/labels";
import { AssignCourierDialog, type AssignProps } from "../orders/_components/OrderActions";
import { DashIcon } from "./DashIcon";
import { StatusBadge } from "./StatusBadge";

type Status = "NEW" | "CONFIRMED" | "PACKED" | "OUT_FOR_DELIVERY" | "DELIVERED" | "CANCELLED" | "RETURNED";

export type BoardOrder = {
  id: string;
  number: number;
  status: Status;
  customerName: string;
  area: string;
  district: string;
  currency: "USD" | "LBP";
  totalMinor: number;
  createdAt: string;
  courier: { id: string; name: string } | null;
  items: { nameSnapshot: string; qty: number; note?: string | null }[];
  allowedNext: Status[];
};

type Page = { orders: BoardOrder[]; nextCursor: string | null };

const ACTIVE: Status[] = ["NEW", "CONFIRMED", "PACKED", "OUT_FOR_DELIVERY"];
const HISTORY: Status[] = ["CANCELLED", "RETURNED"];

type Props = {
  view: "active" | "history";
  pages: Partial<Record<Status, Page>>;
  counts: Partial<Record<Status, number>>;
  selected: Status;
  q?: string;
  assign: AssignProps;
  locale: Locale;
  m: OrderMessages;
  t: CommonMessages;
};

/**
 * Phones: status tabs and one list at a time.
 * Wide screens: four columns with drag and drop, or the history table.
 */
export function BoardClient({ view, pages, counts, selected, q, assign, locale, m, t }: Props) {
  const router = useRouter();
  const statuses = view === "history" ? HISTORY : ACTIVE;
  const [tab, setTab] = useState<Status>(statuses.includes(selected) ? selected : statuses[0]);
  // Auto-refresh replaces `pages`; what Load more fetched lives here and is merged back in by id.
  const [more, setMore] = useState<Partial<Record<Status, { orders: BoardOrder[]; cursor: string | null }>>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = (s: Status) => t[`status${s}` as keyof CommonMessages];

  const fresh = new Set(statuses.flatMap((s) => pages[s]?.orders.map((o) => o.id) ?? []));
  const listOf = (s: Status) => {
    const page = pages[s]?.orders ?? [];
    const loaded = more[s]?.orders;
    return loaded ? mergeOrders(page, loaded, fresh) : page;
  };
  const cursorOf = (s: Status) => {
    const loaded = more[s];
    return loaded ? loaded.cursor : (pages[s]?.nextCursor ?? null);
  };
  // `counts` ignores the search, so while searching there is no total to show.
  const remaining = (s: Status) => (q ? null : Math.max(0, (counts[s] ?? 0) - listOf(s).length));
  const countOf = (s: Status) => (q ? `${listOf(s).length}${cursorOf(s) ? "+" : ""}` : (counts[s] ?? 0));
  const dropLoaded = (order: BoardOrder) => {
    const left = more[order.status];
    if (left) setMore({ ...more, [order.status]: { ...left, orders: left.orders.filter((o) => o.id !== order.id) } });
  };

  async function move(order: BoardOrder, to: Status) {
    if (!order.allowedNext.includes(to)) {
      setError(fill(m.dropNotAllowed, { status: label(order.status) }));
      return;
    }
    setBusy(order.id);
    setError(null);
    try {
      await api(`/api/orders/${order.id}/transitions`, { body: { to } });
      dropLoaded(order);
      router.refresh();
    } catch (e) {
      setError(errorMessage(e, m.moveFailed));
    } finally {
      setBusy(null);
    }
  }

  async function loadMore(wanted: Status[]) {
    setLoading(true);
    setError(null);
    try {
      await Promise.all(
        wanted.map(async (s) => {
          const cursor = cursorOf(s);
          if (!cursor) return;
          const params = new URLSearchParams({ status: s, cursor, limit: String(PAGE_SIZE) });
          if (q) params.set("q", q);
          const next = await api<Page>(`/api/orders?${params}`);
          const list = appendOrders(listOf(s), next.orders);
          setMore((prev) => ({ ...prev, [s]: { orders: list, cursor: next.nextCursor } }));
        }),
      );
    } catch (e) {
      setError(errorMessage(e, m.loadFailed));
    } finally {
      setLoading(false);
    }
  }

  const card = (o: BoardOrder) => <OrderCard key={o.id} order={o} busy={busy === o.id} onMove={move} onAssigned={dropLoaded} assign={assign} locale={locale} m={m} t={t} label={label} />;
  const showing = (shown: number, total: number | null) => (
    <p className="load-note">{total === null ? fill(m.showingX, { x: shown }) : fill(m.showingOf, { x: shown, n: total })}</p>
  );

  if (q && statuses.every((s) => !listOf(s).length)) return <div className="empty">{m.noMatch}</div>;

  const list = listOf(tab);
  const left = remaining(tab);
  const allRows = statuses.flatMap(listOf).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  return (
    <>
      {error && <Alert tone="error" className="mb-3">{error}</Alert>}

      {view === "active" ? (
        <div className="kanban">
          {ACTIVE.map((s) => {
            const rest = remaining(s);
            return (
              <Column key={s} status={s} title={label(s)} count={countOf(s)} onDrop={move}>
                {listOf(s).map(card)}
                {!listOf(s).length && <div className="empty">{m.noOrdersShort}</div>}
                {cursorOf(s) && (
                  <>
                    {showing(listOf(s).length, rest === null ? null : counts[s] ?? 0)}
                    <button type="button" className="btn full tiny" disabled={loading} onClick={() => loadMore([s])}>
                      {rest ? fill(m.showMoreN, { n: rest }) : m.showMore}
                    </button>
                  </>
                )}
              </Column>
            );
          })}
        </div>
      ) : (
        <div className="card history-table">
          <div className="between wrap mb-[13px]">
            <b>{m.historyTitle}</b>
            <span className="hint">{m.historyHint}</span>
          </div>
          {allRows.length ? (
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>{m.colOrder}</th>
                    <th>{m.colCustomer}</th>
                    <th>{m.colStatus}</th>
                    <th>{m.colTotal}</th>
                    <th aria-label={m.details} />
                  </tr>
                </thead>
                <tbody>
                  {allRows.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <b>#{o.number}</b>
                      </td>
                      <td>
                        <bdi>{o.customerName}</bdi>
                      </td>
                      <td>
                        <StatusBadge status={o.status} label={label(o.status)} />
                      </td>
                      <td>{formatMoney(o.totalMinor, o.currency, locale)}</td>
                      <td>
                        <Link href={`/dashboard/orders/${o.id}`} className="btn tiny">
                          {m.details}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty">{m.noOrdersShort}</div>
          )}
          {HISTORY.some(cursorOf) && (
            <div className="mt-3 flex flex-col items-center">
              {showing(allRows.length, q ? null : (counts.CANCELLED ?? 0) + (counts.RETURNED ?? 0))}
              <button type="button" className="btn" disabled={loading} onClick={() => loadMore(HISTORY)}>
                {m.showMore}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="order-mobile">
        <div className="mobile-status">
          <div className="pills" role="group" aria-label={m.statusFilter}>
            {statuses.map((s) => (
              <button key={s} type="button" className="pill" aria-pressed={tab === s} onClick={() => setTab(s)}>
                {label(s)}
                <b>{countOf(s)}</b>
              </button>
            ))}
          </div>
        </div>
        <div className="mobile-order-list">
          {list.map(card)}
          {!list.length && (
            <div className="empty">
              <strong>{m.noOrders}</strong>
              {tab === "NEW" && !q && m.noOrdersHint}
            </div>
          )}
          {cursorOf(tab) && (
            <>
              {showing(list.length, left === null ? null : counts[tab] ?? 0)}
              <button type="button" className="btn full" disabled={loading} onClick={() => loadMore([tab])}>
                {!left ? m.showMore : left === 1 ? m.showNextOne : fill(m.showNext, { n: Math.min(PAGE_SIZE, left) })}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function Column({
  status,
  title,
  count,
  onDrop,
  children,
}: {
  status: Status;
  title: string;
  count: ReactNode;
  onDrop: (o: BoardOrder, to: Status) => void;
  children: ReactNode;
}) {
  const [over, setOver] = useState(false);
  return (
    <section
      aria-label={title}
      onDragOver={(e: DragEvent) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e: DragEvent) => {
        e.preventDefault();
        setOver(false);
        const data = e.dataTransfer.getData("application/json");
        if (data) onDrop(JSON.parse(data) as BoardOrder, status);
      }}
      className={cx("kanban-col", over && "over")}
    >
      <div className="collabel">
        <b>{title}</b>
        <span className="mini-badge gray">{count}</span>
      </div>
      <div className="kanban-scroller">{children}</div>
    </section>
  );
}

function OrderCard({
  order,
  busy,
  onMove,
  onAssigned,
  assign,
  locale,
  m,
  t,
  label,
}: {
  order: BoardOrder;
  busy: boolean;
  onMove: (o: BoardOrder, to: Status) => void;
  onAssigned: (o: BoardOrder) => void;
  assign: AssignProps;
  locale: Locale;
  m: OrderMessages;
  t: CommonMessages;
  label: (s: Status) => string;
}) {
  const [assigning, setAssigning] = useState(false);
  const next = order.allowedNext.find((s) => s !== "CANCELLED" && s !== "RETURNED");
  const href = `/dashboard/orders/${order.id}`;
  const button = `btn ${order.status === "NEW" ? "primary" : "soft"}`;
  const arrow = <DashIcon name="arrow" size="tiny" />;
  const first = order.items[0];
  return (
    <article
      draggable={order.allowedNext.length > 0}
      onDragStart={(e: DragEvent) => e.dataTransfer.setData("application/json", JSON.stringify(order))}
      className={cx("order-card", busy && "busy")}
    >
      <div className="between">
        <Link href={href} className="card-link bold text-[15px] tabular-nums">
          #{order.number}
        </Link>
        <StatusBadge status={order.status} label={label(order.status)} />
      </div>
      <div className="meta mt-[5px]">
        {/* The day can differ between the server's time zone and the browser's. */}
        <span suppressHydrationWarning>{dayMonthYear(order.createdAt, locale)}</span> · <bdi>{order.area}, {order.district}</bdi>
      </div>
      <div className="who">
        <bdi>{order.customerName}</bdi>
      </div>
      <div className="meta">
        {/* bdi: a Latin product name must not reorder the Arabic count around it */}
        <bdi>{first?.nameSnapshot}</bdi> × {first?.qty}
        {order.items.length > 1 ? ` +${order.items.length - 1}` : ""}
      </div>
      {order.items.some((i) => i.note) && (
        <span className="mini-badge amber mt-1.5">
          <DashIcon name="info" size="tiny" />
          {m.hasNote}
        </span>
      )}
      <div className="between mt-3 border-t border-[var(--line)] pt-2.5">
        <span className="amount tabular-nums">{formatMoney(order.totalMinor, order.currency, locale)}</span>
        <span className="meta text-end">
          {order.courier ? (
            <>
              <DashIcon name="truck" size="tiny" /> <bdi>{order.courier.name}</bdi>
            </>
          ) : (
            m.courierNotAssigned
          )}
        </span>
      </div>
      {next === "DELIVERED" ? (
        <Link href={`${href}#deliver`} className={button}>
          {m.actViewDelivery} {arrow}
        </Link>
      ) : next === "OUT_FOR_DELIVERY" && assign ? (
        <button type="button" className={button} onClick={() => setAssigning(true)}>
          {m.assignCourier} {arrow}
        </button>
      ) : next ? (
        <button type="button" className={button} disabled={busy} onClick={() => onMove(order, next)}>
          {nextActionLabel(m, next)} {arrow}
        </button>
      ) : (
        <Link href={href} className={button}>
          {m.actViewOrder} {arrow}
        </Link>
      )}
      {assigning && assign && (
        <AssignCourierDialog order={{ ...order, courierId: order.courier?.id ?? null }} {...assign} onClose={() => setAssigning(false)} onDone={() => onAssigned(order)} m={m} t={t} />
      )}
    </article>
  );
}

export function CopyLink({ url, label, hint, copy, copied }: { url: string; label: string; hint?: string; copy: string; copied: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="card between wrap">
      <div className="min-w-0 flex-1">
        <b>{label}</b>
        {hint ? (
          <p className="hint mb-0">{hint}</p>
        ) : (
          <a href={url} className="block truncate text-sm font-bold text-[var(--blue)] underline-offset-4 hover:underline" dir="ltr">
            {url}
          </a>
        )}
      </div>
      <button
        type="button"
        className="btn tiny"
        onClick={async () => {
          await navigator.clipboard.writeText(url);
          setDone(true);
        }}
      >
        <DashIcon name={done ? "check" : "copy"} size="sm" />
        <span aria-live="polite">{done ? copied : copy}</span>
      </button>
    </div>
  );
}
