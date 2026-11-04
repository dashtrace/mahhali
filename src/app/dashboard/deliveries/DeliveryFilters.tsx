"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import { fill } from "@/i18n/locale";
import type { OrderMessages } from "@/i18n/messages/orders";
import { Field } from "../orders/_components/Field";

const STEP = 12;

/**
 * From, To (Delivered tab only) and Courier (desk roles only). Applies as soon as a value changes.
 * The inputs show the default range, but the URL only carries dates the user actually changed:
 * no dates keeps the service's own "recent activity" default.
 */
export function DeliveryFilters({
  view,
  from,
  to,
  defaultFrom,
  defaultTo,
  courierId,
  couriers,
  m,
}: {
  view: "active" | "done";
  from?: string;
  to?: string;
  defaultFrom: string;
  defaultTo: string;
  courierId?: string;
  couriers: { id: string; label: string }[];
  m: OrderMessages;
}) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [dates, setDates] = useState({ from: from ?? defaultFrom, to: to ?? defaultTo });
  const dated = view === "done";
  const invalid = dates.from !== "" && dates.to !== "" && dates.from > dates.to;

  function apply(next: { from: string; to: string }, courier = courierId) {
    setDates(next);
    clearTimeout(timer.current);
    if (next.from && next.to && next.from > next.to) return;
    const custom = next.from !== defaultFrom || next.to !== defaultTo;
    const query = new URLSearchParams({ view, ...(courier ? { courierId: courier } : {}) });
    if (custom && next.from) query.set("from", next.from);
    if (custom && next.to) query.set("to", next.to);
    // Typing a year fires a change per digit; wait for the pause.
    timer.current = setTimeout(() => router.push(`?${query}`), 400);
  }

  if (!dated && !couriers.length) return null;
  return (
    <div className="card">
      <div className="split3">
        {dated && (
          <>
            <Field label={m.fromDate}>
              <input type="date" className="control" value={dates.from} max={defaultTo} aria-invalid={invalid} onChange={(e) => apply({ ...dates, from: e.target.value })} />
            </Field>
            <Field label={m.toDate}>
              <input type="date" className="control" value={dates.to} max={defaultTo} aria-invalid={invalid} onChange={(e) => apply({ ...dates, to: e.target.value })} />
            </Field>
          </>
        )}
        {couriers.length > 0 && (
          <Field label={m.courierTitle} className={dated ? undefined : "mb-0"}>
            <select className="control" value={courierId ?? ""} onChange={(e) => apply(dates, e.target.value)}>
              <option value="">{m.allCouriers}</option>
              {couriers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
        )}
      </div>
      {dated &&
        (invalid ? (
          <p role="alert" className="hint mb-0 font-bold text-[var(--red)]">
            {m.rangeInvalid}
          </p>
        ) : (
          <p className="hint mb-0">{m.rangeHint}</p>
        ))}
    </div>
  );
}

/** The heading with "Showing X of N", then the cards a dozen at a time. They all arrive from the server (capped at 200). */
export function DeliveryList({ title, one, m, children }: { title: ReactNode; one: boolean; m: OrderMessages; children: ReactNode[] }) {
  const [limit, setLimit] = useState(STEP);
  const shown = Math.min(limit, children.length);
  return (
    <>
      <div className="between wrap mt-5 mb-3.5">
        <b>{title}</b>
        <span className="hint">{fill(m.showingOf, { x: shown, n: children.length })}</span>
      </div>
      <div className={`split3 ${one ? "deliveries-one" : ""}`}>{children.slice(0, shown)}</div>
      {shown < children.length && (
        <button type="button" className="btn mt-5" onClick={() => setLimit(limit + STEP)}>
          {fill(m.loadMoreDeliveries, { n: Math.min(STEP, children.length - shown) })}
        </button>
      )}
    </>
  );
}
