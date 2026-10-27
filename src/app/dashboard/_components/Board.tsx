"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, type DragEvent } from "react";
import { Icon } from "@/components/Icon";
import { Alert, Badge, Button, ButtonLink, Card, EmptyState, FilterChip, STATUS_TONES, cx } from "@/components/ui";
import { fill, type Locale } from "@/i18n/locale";
import type { CommonMessages } from "@/i18n/messages/common";
import type { OrderMessages } from "@/i18n/messages/orders";
import { api, errorMessage } from "@/lib/api";
import { formatDateTime, formatMoney } from "@/lib/format";
import { age } from "../orders/_components/labels";

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

const ACTIVE: Status[] = ["NEW", "CONFIRMED", "PACKED", "OUT_FOR_DELIVERY"];
const DONE: Status[] = ["DELIVERED", "CANCELLED", "RETURNED"];

type Props = {
  columns: Partial<Record<Status, BoardOrder[]>>;
  searchResults: BoardOrder[] | null;
  counts: Partial<Record<Status, number>>;
  selected: Status;
  locale: Locale;
  m: OrderMessages;
  t: CommonMessages;
};

/**
 * Phones: status chips and a big "Move to …" button on each card.
 * Wide screens: four columns with drag and drop.
 */
export function BoardClient({ columns, searchResults, counts, selected, locale, m, t }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [tab, setTab] = useState<Status>(selected);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const label = (s: Status) => t[`status${s}` as keyof CommonMessages];

  async function move(order: BoardOrder, to: Status) {
    if (!order.allowedNext.includes(to)) {
      setError(fill(m.dropNotAllowed, { status: label(order.status) }));
      return;
    }
    setBusy(order.id);
    setError(null);
    try {
      await api(`/api/orders/${order.id}/transitions`, { body: { to } });
      router.refresh();
    } catch (e) {
      setError(errorMessage(e, m.moveFailed));
    } finally {
      setBusy(null);
    }
  }

  const card = (o: BoardOrder) => <OrderCard key={o.id} order={o} busy={busy === o.id} onMove={move} locale={locale} m={m} label={label} />;

  if (searchResults) {
    return (
      <section className="flex flex-col gap-3">
        {error && <Alert tone="error">{error}</Alert>}
        {searchResults.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{searchResults.map(card)}</div> : <EmptyState title={m.noOrders} />}
      </section>
    );
  }

  const doneHref = (s: Status) => {
    const next = new URLSearchParams(params.toString());
    next.set("status", s);
    return `?${next.toString()}`;
  };
  const chipText = (s: Status) => (
    <>
      {label(s)}
      <span className="tabular-nums opacity-75">{counts[s] ?? 0}</span>
    </>
  );

  return (
    <>
      {error && <Alert tone="error" className="mb-3">{error}</Alert>}

      {/* Phones and tablets */}
      <div className="lg:hidden">
        <div role="group" aria-label={m.statusFilter} className="sl-scroll-row -mx-4 mb-3 gap-2 px-4 pb-1">
          {[...ACTIVE, ...DONE].map((s) =>
            ACTIVE.includes(s) ? (
              <FilterChip key={s} selected={tab === s} onClick={() => setTab(s)} className="snap-start">
                {chipText(s)}
              </FilterChip>
            ) : (
              <FilterChip key={s} href={doneHref(s)} selected={tab === s} className="snap-start">
                {chipText(s)}
              </FilterChip>
            ),
          )}
        </div>
        {columns[tab]?.length ? (
          <div className="grid gap-3 sm:grid-cols-2">{columns[tab].map(card)}</div>
        ) : (
          <EmptyState title={m.noOrders} body={tab === "NEW" ? m.noOrdersHint : undefined} />
        )}
      </div>

      {/* Wide screens */}
      <div className="hidden gap-3 lg:grid lg:grid-cols-4">
        {ACTIVE.map((s) => (
          <Column key={s} status={s} title={label(s)} count={counts[s] ?? 0} orders={columns[s] ?? []} onDrop={move} render={card} />
        ))}
      </div>
      <nav className="mt-4 hidden flex-wrap gap-2 lg:flex" aria-label={m.done}>
        {DONE.map((s) => (
          <FilterChip key={s} href={doneHref(s)} selected={selected === s}>
            {chipText(s)}
          </FilterChip>
        ))}
      </nav>
      {DONE.includes(selected) && (
        <section className="mt-4 hidden lg:block">
          <h2 className="sl-heading mb-3 text-lg">{label(selected)}</h2>
          {(columns[selected] ?? []).length ? (
            <div className="grid grid-cols-3 gap-3">{(columns[selected] ?? []).map(card)}</div>
          ) : (
            <EmptyState title={m.noOrders} />
          )}
        </section>
      )}
    </>
  );
}

function Column({
  status,
  title,
  count,
  orders,
  onDrop,
  render,
}: {
  status: Status;
  title: string;
  count: number;
  orders: BoardOrder[];
  onDrop: (o: BoardOrder, to: Status) => void;
  render: (o: BoardOrder) => React.ReactNode;
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
      className={cx(
        "flex min-h-64 flex-col gap-2.5 rounded-sl-lg border border-sl-border bg-sl-cat/50 p-2",
        over && "outline-2 outline-offset-2 outline-dashed outline-sl-accent",
      )}
    >
      <h2 className="flex items-center justify-between gap-2 px-1.5 pt-1 text-[13px] font-extrabold">
        {title}
        <span className="rounded-full bg-sl-panel px-2 py-0.5 text-xs tabular-nums text-sl-muted">{count}</span>
      </h2>
      {orders.map(render)}
    </section>
  );
}

function OrderCard({
  order,
  busy,
  onMove,
  locale,
  m,
  label,
}: {
  order: BoardOrder;
  busy: boolean;
  onMove: (o: BoardOrder, to: Status) => void;
  locale: Locale;
  m: OrderMessages;
  label: (s: Status) => string;
}) {
  const next = order.allowedNext.find((s) => s !== "CANCELLED" && s !== "RETURNED");
  const units = order.items.reduce((n, i) => n + i.qty, 0);
  let action: React.ReactNode = null;
  if (next === "DELIVERED") {
    action = <ButtonLink href={`/dashboard/orders/${order.id}#deliver`} block>{m.markDelivered}</ButtonLink>;
  } else if (next === "OUT_FOR_DELIVERY" && !order.courier) {
    action = <ButtonLink href={`/dashboard/orders/${order.id}#courier`} tone="secondary" block>{m.assignCourier}</ButtonLink>;
  } else if (next) {
    action = (
      <Button block disabled={busy} onClick={() => onMove(order, next)}>
        {fill(m.moveTo, { status: label(next) })}
      </Button>
    );
  }
  return (
    <Card
      draggable={order.allowedNext.length > 0}
      onDragStart={(e: DragEvent) => e.dataTransfer.setData("application/json", JSON.stringify(order))}
      className={cx("flex flex-col gap-3 p-3.5", busy && "opacity-60")}
    >
      <Link href={`/dashboard/orders/${order.id}`} className="flex flex-col gap-2 rounded-sl-sm">
        <div>
          {/* flex-wrap: in a narrow board column a long badge drops under the number instead of squeezing it */}
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
            <p className="text-[15px] font-extrabold tabular-nums">#{order.number}</p>
            <Badge tone={STATUS_TONES[order.status]}>{label(order.status)}</Badge>
          </div>
          {/* Relative time drifts between server and browser render. */}
          <time dateTime={order.createdAt} title={formatDateTime(order.createdAt, locale)} className="text-xs text-sl-muted" suppressHydrationWarning>
            {age(order.createdAt, locale)}
          </time>
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{order.customerName}</p>
          <p className="flex items-center gap-1 text-xs text-sl-muted">
            <Icon name="pin" className="size-3.5 shrink-0" />
            <span className="truncate">
              {order.area}, {order.district}
            </span>
          </p>
        </div>
        <p className="truncate text-xs text-sl-muted">
          {/* bdi: a Latin product name must not reorder the Arabic count around it */}
          <bdi>
            {order.items[0]?.nameSnapshot}
            {order.items.length > 1 ? ` +${order.items.length - 1}` : ""}
          </bdi>
          {" · "}
          {units === 1 ? m.oneItem : fill(m.items, { n: units })}
        </p>
        {order.items.some((i) => i.note) && (
          <Badge tone="violet" className="self-start">
            <Icon name="info" className="size-3.5" />
            {m.hasNote}
          </Badge>
        )}
        <div className="flex items-center justify-between gap-2 border-t border-sl-border pt-2">
          <span className="text-[15px] font-extrabold tabular-nums">{formatMoney(order.totalMinor, order.currency, locale)}</span>
          <span className={cx("inline-flex min-w-0 items-center gap-1 text-xs font-semibold", order.courier ? "text-sl-fg" : "text-sl-muted")}>
            <Icon name="truck" className="size-4 shrink-0" />
            <span className="truncate">{order.courier?.name ?? m.unassigned}</span>
          </span>
        </div>
      </Link>
      {action}
    </Card>
  );
}

/** Courier filter chips; keeps the other query params. */
export function CourierFilter({ couriers, value, label, allLabel }: { couriers: { id: string; name: string }[]; value: string; label: string; allLabel: string }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const href = (id: string) => {
    const next = new URLSearchParams(params.toString());
    if (id) next.set("courierId", id);
    else next.delete("courierId");
    return `${pathname}?${next.toString()}`;
  };
  return (
    <nav aria-label={label} className="sl-scroll-row -mx-4 gap-2 px-4 pb-1">
      <FilterChip href={href("")} selected={!value} className="snap-start">
        <Icon name="truck" className="size-4" />
        {allLabel}
      </FilterChip>
      {couriers.map((c) => (
        <FilterChip key={c.id} href={href(c.id)} selected={value === c.id} className="snap-start">
          {c.name}
        </FilterChip>
      ))}
    </nav>
  );
}

export function CopyLink({ url, label, copy, copied }: { url: string; label: string; copy: string; copied: string }) {
  const [done, setDone] = useState(false);
  return (
    <Card className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-sl-muted rtl:tracking-normal">{label}</p>
        <a href={url} className="block truncate text-sm font-bold text-sl-accent underline-offset-4 hover:underline" dir="ltr">
          {url}
        </a>
      </div>
      <Button
        tone="secondary"
        onClick={async () => {
          await navigator.clipboard.writeText(url);
          setDone(true);
        }}
      >
        <Icon name={done ? "check" : "orders"} className="size-[18px]" />
        <span aria-live="polite">{done ? copied : copy}</span>
      </Button>
    </Card>
  );
}
