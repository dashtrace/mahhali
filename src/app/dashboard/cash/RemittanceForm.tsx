"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, Card, Field, Input, Select, cx } from "@/components/ui";
import { fill, type Locale } from "@/i18n/locale";
import type { CashMessages } from "@/i18n/messages/money";
import { api, errorMessage } from "@/lib/api";
import { formatDate, formatMoney, toAmountText } from "@/lib/format";

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

const cents = (text: string) => Math.round(Number(text || 0) * 100);
const pounds = (text: string) => Math.round(Number(text || 0));

/** Prefilled with what the courier reported at the door, else what was due. */
function startLine(o: Unsettled): Line {
  const reported = o.reportedUsdCents !== null || o.reportedLbp !== null;
  const usd = reported ? (o.reportedUsdCents ?? 0) : o.currency === "USD" ? o.codMinor : 0;
  const lbp = reported ? (o.reportedLbp ?? 0) : o.currency === "LBP" ? o.codMinor : 0;
  return { checked: false, usd: toAmountText(usd, "USD"), lbp: String(lbp), fee: "0" };
}

/** Phone-first entry: courier -> tick orders -> adjust lines -> date and reference -> save. */
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
  const [courierId, setCourierId] = useState("");
  const [orders, setOrders] = useState<Unsettled[] | null>(null);
  const [lines, setLines] = useState<Record<string, Line>>({});
  const [receivedAt, setReceivedAt] = useState(today);
  const [reference, setReference] = useState("");
  // null: follow the ticked lines; a string once the owner types over it.
  const [handUsd, setHandUsd] = useState<string | null>(null);
  const [handLbp, setHandLbp] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
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
    setBusy(true);
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
      router.refresh();
    } catch (e) {
      setError(errorMessage(e, m.saveFailed));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mb-6">
      <h2 className="text-lg font-semibold">{m.recordTitle}</h2>
      <p className="mb-3 text-sm text-stone-600">{m.recordHint}</p>
      {done && <Alert tone="success" className="mb-3">{m.saved}</Alert>}
      {error && <Alert tone="error" className="mb-3">{error}</Alert>}
      {couriers.length === 0 ? (
        <p className="text-sm text-stone-600">{m.noCouriers}</p>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label={m.courier}>
            <Select value={courierId} onChange={(e) => load(e.target.value)}>
              <option value="">{m.pickCourier}</option>
              {couriers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>

          {orders && orders.length === 0 && <p className="text-sm text-stone-600">{m.noUnsettled}</p>}

          {orders && orders.length > 0 && (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-stone-600">{fill(m.selected, { n: picked.length })}</span>
                <Button
                  tone="ghost"
                  onClick={() => setLines((all) => Object.fromEntries(Object.entries(all).map(([id, l]) => [id, { ...l, checked: true }])))}
                >
                  {m.selectAll}
                </Button>
              </div>
              <ul className="flex flex-col gap-2">
                {orders.map((o) => {
                  const l = lines[o.id];
                  return (
                    <li key={o.id} className={cx("rounded-[var(--radius)] border", l.checked ? "border-[var(--brand)]" : "border-stone-200")}>
                      <label className="flex min-h-11 items-center gap-3 p-3">
                        <input
                          type="checkbox"
                          className="size-5 shrink-0 accent-[var(--brand)]"
                          checked={l.checked}
                          onChange={(e) => set(o.id, { checked: e.target.checked })}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">
                            {fill(m.orderNo, { n: o.number })} · {o.customerName}
                          </span>
                          {o.deliveredAt && (
                            <span className="block text-xs text-stone-500">{fill(m.deliveredOn, { date: formatDate(o.deliveredAt, locale) })}</span>
                          )}
                        </span>
                        <span className="shrink-0 text-sm font-medium tabular-nums">
                          {fill(m.dueAmount, { amount: formatMoney(o.codMinor, o.currency, locale) })}
                        </span>
                      </label>
                      {l.checked && (
                        <div className="grid grid-cols-3 gap-2 px-3 pb-3">
                          <Field label={m.collectedUsd}>
                            <Input inputMode="decimal" value={l.usd} onChange={(e) => set(o.id, { usd: e.target.value })} />
                          </Field>
                          <Field label={m.collectedLbp}>
                            <Input inputMode="numeric" value={l.lbp} onChange={(e) => set(o.id, { lbp: e.target.value })} />
                          </Field>
                          <Field label={`${m.fee} (${o.currency})`}>
                            <Input inputMode={o.currency === "USD" ? "decimal" : "numeric"} value={l.fee} onChange={(e) => set(o.id, { fee: e.target.value })} />
                          </Field>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>

              <div className="grid grid-cols-2 gap-3">
                <Field label={m.handedUsd}>
                  <Input inputMode="decimal" value={amountUsd} onChange={(e) => setHandUsd(e.target.value)} />
                </Field>
                <Field label={m.handedLbp}>
                  <Input inputMode="numeric" value={amountLbp} onChange={(e) => setHandLbp(e.target.value)} />
                </Field>
                <p className="col-span-2 -mt-1 text-xs text-stone-500">{m.handedHint}</p>
                <Field label={m.receivedAt}>
                  <Input type="date" required value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} />
                </Field>
                <Field label={m.reference} hint={m.referenceHint}>
                  <Input value={reference} maxLength={120} onChange={(e) => setReference(e.target.value)} />
                </Field>
              </div>
              <Button type="submit" block disabled={busy || picked.length === 0}>
                {m.save}
              </Button>
            </>
          )}
        </form>
      )}
    </Card>
  );
}
