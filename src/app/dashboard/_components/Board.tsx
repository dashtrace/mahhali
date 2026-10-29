"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, type DragEvent } from "react";
import { Alert, Badge, Button, ButtonLink, Card, EmptyState, Select, STATUS_TONES, cx } from "@/components/ui";
import { fill, type Locale } from "@/i18n/locale";
import type { CommonMessages } from "@/i18n/messages/common";
import type { OrderMessages } from "@/i18n/messages/orders";
import { api, errorMessage } from "@/lib/api";
import { formatDateTime, formatMoney } from "@/lib/format";

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
  items: { nameSnapshot: string; qty: number }[];
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
 * Phones: status tabs and a big "Move to …" button on each card.
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

  const card = (o: BoardOrder) => <OrderCard key={o.id} order={o} busy={busy === o.id} onMove={move} locale={locale} m={m} t={t} label={label} />;

  if (searchResults) {
    return (
      <section className="flex flex-col gap-3">
        {error && <Alert tone="error">{error}</Alert>}
        {searchResults.length ? searchResults.map(card) : <EmptyState title={m.noOrders} />}
      </section>
    );
  }

  const doneHref = (s: Status) => {
    const next = new URLSearchParams(params.toString());
    next.set("status", s);
    return `?${next.toString()}`;
  };

  return (
    <>
      {error && <Alert tone="error" className="mb-3">{error}</Alert>}

      {/* Phones and tablets */}
      <div className="lg:hidden">
        <div role="tablist" className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1">
          {[...ACTIVE, ...DONE].map((s) => {
            const active = tab === s;
            const className = cx(
              "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium",
              active ? "border-[var(--brand)] bg-[var(--brand)] text-[var(--brand-ink)]" : "border-stone-300 bg-white text-stone-700",
            );
            const content = (
              <>
                {label(s)}
                <span className="tabular-nums opacity-80">{counts[s] ?? 0}</span>
              </>
            );
            return ACTIVE.includes(s) ? (
              <button key={s} role="tab" aria-selected={active} className={className} onClick={() => setTab(s)}>
                {content}
              </button>
            ) : (
              <Link key={s} role="tab" aria-selected={active} href={doneHref(s)} className={className}>
                {content}
              </Link>
            );
          })}
        </div>
        <div className="flex flex-col gap-3">
          {columns[tab]?.length ? (
            columns[tab].map(card)
          ) : (
            <EmptyState title={m.noOrders} body={tab === "NEW" ? m.noOrdersHint : undefined} />
          )}
        </div>
      </div>

      {/* Wide screens */}
      <div className="hidden gap-3 lg:grid lg:grid-cols-4">
        {ACTIVE.map((s) => (
          <Column key={s} status={s} title={label(s)} count={counts[s] ?? 0} orders={columns[s] ?? []} onDrop={move} render={card} />
        ))}
      </div>
      <nav className="mt-4 hidden flex-wrap gap-2 lg:flex" aria-label={m.done}>
        {DONE.map((s) => (
          <Link key={s} href={doneHref(s)} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-stone-300 bg-white px-4 text-sm">
            {label(s)} <span className="tabular-nums text-stone-500">{counts[s] ?? 0}</span>
          </Link>
        ))}
      </nav>
      {DONE.includes(selected) && (
        <section className="mt-4 hidden flex-col gap-3 lg:flex">
          <h2 className="font-semibold">{label(selected)}</h2>
          {(columns[selected] ?? []).length ? (columns[selected] ?? []).map(card) : <EmptyState title={m.noOrders} />}
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
      className={cx("flex min-h-64 flex-col gap-3 rounded-[var(--radius)] bg-stone-100 p-2", over && "ring-2 ring-[var(--brand)]")}
    >
      <h2 className="flex items-center justify-between px-1 pt-1 text-sm font-semibold text-stone-700">
        {title} <span className="tabular-nums text-stone-500">{count}</span>
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
  t: CommonMessages;
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
      className={cx("flex flex-col gap-3 p-3", busy && "opacity-60")}
    >
      <Link href={`/dashboard/orders/${order.id}`} className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold tabular-nums">#{order.number}</span>
          <Badge tone={STATUS_TONES[order.status]}>{label(order.status)}</Badge>
        </div>
        <span className="truncate text-sm font-medium">{order.customerName}</span>
        <span className="truncate text-xs text-stone-500">
          {order.area}, {order.district}
        </span>
        <span className="truncate text-xs text-stone-600">
          {order.items[0]?.nameSnapshot}
          {order.items.length > 1 ? ` +${order.items.length - 1}` : ""} · {fill(m.items, { n: units })}
        </span>
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold tabular-nums">{formatMoney(order.totalMinor, order.currency, locale)}</span>
          <span className="truncate text-xs text-stone-500">{order.courier?.name ?? m.unassigned}</span>
        </div>
        <time className="text-xs text-stone-400" dateTime={order.createdAt}>
          {formatDateTime(order.createdAt, locale)}
        </time>
      </Link>
      {action}
    </Card>
  );
}

export function CourierFilter({ couriers, value, label, allLabel }: { couriers: { id: string; name: string }[]; value: string; label: string; allLabel: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <Select
      aria-label={label}
      value={value}
      className="sm:w-56"
      onChange={(e) => {
        const next = new URLSearchParams(params.toString());
        if (e.target.value) next.set("courierId", e.target.value);
        else next.delete("courierId");
        router.push(`${pathname}?${next.toString()}`);
      }}
    >
      <option value="">{allLabel}</option>
      {couriers.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </Select>
  );
}

export function CopyLink({ url, label, copy, copied }: { url: string; label: string; copy: string; copied: string }) {
  const [done, setDone] = useState(false);
  return (
    <Card className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-stone-500">{label}</p>
        <a href={url} className="block truncate text-sm text-[var(--brand)] underline-offset-4 hover:underline" dir="ltr">
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
        {done ? copied : copy}
      </Button>
    </Card>
  );
}
