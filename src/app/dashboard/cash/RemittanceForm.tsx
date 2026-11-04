"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert } from "@/components/ui";
import { fill, type Locale } from "@/i18n/locale";
import type { CashMessages } from "@/i18n/messages/money";
import { api, errorMessage } from "@/lib/api";
import { formatDate, formatMoney, toAmountText } from "@/lib/format";
import { DashIcon } from "../_components/DashIcon";
import { Dialog, Field } from "../products/_components/kit";

type Currency = "USD" | "LBP";

type Unsettled = {
  id: string;
  number: number;
  customerName: string;
  deliveredAt: string | null;
  currency: Currency;
  codMinor: number;
  reportedUsdCents: number | null;
  reportedLbp: number | null;
};

type Line = { checked: boolean; usd: string; lbp: string; fee: string };

// Half-typed text counts as nothing here; the server rejects it on save.
const cents = (text: string) => Math.round((Number(text) || 0) * 100);
const pounds = (text: string) => Math.round(Number(text) || 0);

/** Prefilled with what the courier reported at the door, else what was due. */
function startLine(o: Unsettled): Line {
  const reported = o.reportedUsdCents !== null || o.reportedLbp !== null;
  const usd = reported ? (o.reportedUsdCents ?? 0) : o.currency === "USD" ? o.codMinor : 0;
  const lbp = reported ? (o.reportedLbp ?? 0) : o.currency === "LBP" ? o.codMinor : 0;
  return { checked: false, usd: toAmountText(usd, "USD"), lbp: String(lbp), fee: "0" };
}

/** The header's button and its dialog. Phone-first entry: courier -> tick orders -> adjust lines -> date and reference -> save. */
export function RemittanceForm({
  couriers,
  today,
  locale,
  m,
}: {
  couriers: { id: string; name: string }[];
  today: string;
  locale: Locale;
  m: CashMessages;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [courierId, setCourierId] = useState("");
  const [orders, setOrders] = useState<Unsettled[] | null>(null);
  const [lines, setLines] = useState<Record<string, Line>>({});
  const [receivedAt, setReceivedAt] = useState(today);
  const [reference, setReference] = useState("");
  // null: follow the ticked lines; a string once the owner types over it.
  const [handUsd, setHandUsd] = useState<string | null>(null);
  const [handLbp, setHandLbp] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const busy = saving || refreshing;
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function load(id: string) {
    setCourierId(id);
    setOrders(null);
    setLines({});
    setHandUsd(null);
    setHandLbp(null);
    setError(null);
    if (!id) return;
    try {
      const rows = await api<Unsettled[]>(`/api/reconciliation/unsettled?courierId=${encodeURIComponent(id)}`);
      setOrders(rows);
      setLines(Object.fromEntries(rows.map((o) => [o.id, startLine(o)])));
    } catch (e) {
      setError(errorMessage(e, m.loadFailed));
    }
  }

  const set = (id: string, patch: Partial<Line>) => setLines((all) => ({ ...all, [id]: { ...all[id], ...patch } }));
  const picked = (orders ?? []).filter((o) => lines[o.id]?.checked);

  // The courier keeps the fee out of the hand-over, in the order's currency.
  let autoUsd = 0;
  let autoLbp = 0;
  for (const o of picked) {
    const l = lines[o.id];
    autoUsd += cents(l.usd) - (o.currency === "USD" ? cents(l.fee) : 0);
    autoLbp += pounds(l.lbp) - (o.currency === "LBP" ? pounds(l.fee) : 0);
  }
  const amountUsd = handUsd ?? toAmountText(Math.max(0, autoUsd), "USD");
  const amountLbp = handLbp ?? String(Math.max(0, autoLbp));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setDone(false);
    try {
      await api("/api/remittances", {
        body: {
          courierId,
          receivedAt,
          amountUsd: amountUsd || "0",
          amountLbp: amountLbp || "0",
          reference: reference.trim() || null,
          lines: picked.map((o) => ({
            orderId: o.id,
            collectedUsd: lines[o.id].usd || "0",
            collectedLbp: lines[o.id].lbp || "0",
            fee: lines[o.id].fee || "0",
          })),
        },
      });
      setReference("");
      await load(courierId);
      setDone(true);
      startTransition(() => router.refresh());
    } catch (e) {
      setError(errorMessage(e, m.saveFailed));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="btn primary"
        onClick={() => {
          setDone(false);
          setOpen(true);
        }}
      >
        <DashIcon name="plus" size="sm" />
        {m.recordButton}
      </button>
      {open && (
        <Dialog title={m.recordTitle} closeLabel={m.close} onClose={() => setOpen(false)}>
          <p className="hint">{m.recordHint}</p>
          {done && <Alert tone="success" className="mb-3">{m.saved}</Alert>}
          {error && <Alert tone="error" className="mb-3">{error}</Alert>}
          {couriers.length === 0 ? (
            <div className="info-inline">{m.noCouriers}</div>
          ) : (
            <form onSubmit={submit}>
              <Field label={m.courier}>
                <select className="control" value={courierId} onChange={(e) => load(e.target.value)}>
                  <option value="">{m.pickCourier}</option>
                  {couriers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>

              {orders && orders.length === 0 && <div className="info-inline">{m.noUnsettled}</div>}

              {orders && orders.length > 0 && (
                <>
                  <div className="between mb-2">
                    <span className="small bold muted">{fill(m.selected, { n: picked.length })}</span>
                    <button
                      type="button"
                      className="btn tiny"
                      onClick={() => setLines((all) => Object.fromEntries(Object.entries(all).map(([id, l]) => [id, { ...l, checked: true }])))}
                    >
                      {m.selectAll}
                    </button>
                  </div>
                  <ul className="mb-[17px] flex flex-col gap-[7px]">
                    {orders.map((o) => {
                      const l = lines[o.id];
                      return (
                        <li key={o.id} className="inner-card p-0">
                          <label className="flex min-h-11 cursor-pointer items-center gap-[9px] p-[15px]">
                            <input type="checkbox" className="size-5 shrink-0" checked={l.checked} onChange={(e) => set(o.id, { checked: e.target.checked })} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-bold">
                                {fill(m.orderNo, { n: o.number })} · {o.customerName}
                              </span>
                              {o.deliveredAt && <span className="hint block">{fill(m.deliveredOn, { date: formatDate(o.deliveredAt, locale) })}</span>}
                            </span>
                            <span className="shrink-0 font-bold tabular-nums">{fill(m.dueAmount, { amount: formatMoney(o.codMinor, o.currency, locale) })}</span>
                          </label>
                          {l.checked && (
                            <div className="grid grid-cols-2 gap-x-2 px-[15px] sm:grid-cols-3">
                              <Field label={m.collectedUsd}>
                                <input className="control" inputMode="decimal" value={l.usd} onChange={(e) => set(o.id, { usd: e.target.value })} />
                              </Field>
                              <Field label={m.collectedLbp}>
                                <input className="control" inputMode="numeric" value={l.lbp} onChange={(e) => set(o.id, { lbp: e.target.value })} />
                              </Field>
                              <Field label={`${m.fee} (${o.currency})`}>
                                <input className="control" inputMode={o.currency === "USD" ? "decimal" : "numeric"} value={l.fee} onChange={(e) => set(o.id, { fee: e.target.value })} />
                              </Field>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>

                  <div className="split gap-x-3 gap-y-0 max-[780px]:grid-cols-2">
                    <Field label={m.handedUsd}>
                      <input className="control" inputMode="decimal" value={amountUsd} onChange={(e) => setHandUsd(e.target.value)} />
                    </Field>
                    <Field label={m.handedLbp}>
                      <input className="control" inputMode="numeric" value={amountLbp} onChange={(e) => setHandLbp(e.target.value)} />
                    </Field>
                  </div>
                  <div className="info-inline mb-[17px]">{m.handedHint}</div>
                  <div className="split gap-x-3 gap-y-0 max-[780px]:grid-cols-2">
                    <Field label={m.receivedAt}>
                      <input className="control" type="date" required value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} />
                    </Field>
                    <Field label={m.reference} hint={m.referenceHint}>
                      <input className="control" value={reference} maxLength={120} onChange={(e) => setReference(e.target.value)} />
                    </Field>
                  </div>
                  <div className="actions">
                    <button type="submit" className="btn primary" disabled={busy || picked.length === 0}>
                      {busy ? m.saving : m.save}
                    </button>
                    <button type="button" className="btn" onClick={() => setOpen(false)}>
                      {m.close}
                    </button>
                  </div>
                </>
              )}
            </form>
          )}
        </Dialog>
      )}
    </>
  );
}
