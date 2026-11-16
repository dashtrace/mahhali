"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, errorMessage, newIdempotencyKey } from "@/lib/api";
import type { CashMessages } from "@/i18n/messages/money";

type Props = { m: CashMessages };

export function OrderCashResolution({ orderId, m }: Props & { orderId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit() {
    setBusy(true); setError("");
    try {
      await api(`/api/reconciliation/orders/${orderId}/resolve`, { body: { reason } });
      setOpen(false); router.refresh();
    } catch (e) { setError(errorMessage(e, m.resolveFailed)); }
    finally { setBusy(false); }
  }
  return (
    <div className="mt-2">
      <button type="button" className="btn tiny" onClick={() => setOpen(!open)}>{m.acceptOrderDifference}</button>
      {open && <div className="mt-2 space-y-2">
        <label className="block text-xs font-bold" htmlFor={`order-reason-${orderId}`}>{m.reasonLabel}</label>
        <textarea id={`order-reason-${orderId}`} className="control w-full" rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
        <p className="hint">{m.acceptExplanation}</p>
        {error && <p role="alert" className="text-(--red) text-xs">{error}</p>}
        <div className="flex gap-2"><button type="button" className="btn tiny primary" disabled={busy || reason.trim().length < 5} onClick={submit}>{m.confirmAccept}</button><button type="button" className="btn tiny" onClick={() => setOpen(false)}>{m.cancelAction}</button></div>
      </div>}
    </div>
  );
}

export function RemittanceCashActions({ remittanceId, m, resolved }: Props & { remittanceId: string; resolved: boolean }) {
  const router = useRouter();
  const [action, setAction] = useState<"PAYMENT" | "ACCEPT" | null>(null);
  const [paymentKey, setPaymentKey] = useState(newIdempotencyKey);
  const [usd, setUsd] = useState("0");
  const [lbp, setLbp] = useState("0");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (!action) return;
    setBusy(true); setError("");
    try {
      await api(`/api/remittances/${remittanceId}/actions`, { body: action === "PAYMENT" ? { kind: action, requestKey: paymentKey, amountUsd: usd, amountLbp: lbp, reason } : { kind: action, reason } });
      setAction(null); setReason(""); setUsd("0"); setLbp("0"); setPaymentKey(newIdempotencyKey()); router.refresh();
    } catch (e) { setError(errorMessage(e, m.resolveFailed)); }
    finally { setBusy(false); }
  }
  if (resolved) return <p className="hint">{m.acceptedExplanation}</p>;
  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn tiny primary" onClick={() => { setAction("PAYMENT"); setError(""); }}>{m.recordExtraPayment}</button>
        <button type="button" className="btn tiny" onClick={() => { setAction("ACCEPT"); setError(""); }}>{m.acceptRemittanceDifference}</button>
      </div>
      {action && <div className="inner-card space-y-2 p-3">
        <h3 className="font-bold">{action === "PAYMENT" ? m.recordExtraPayment : m.acceptRemittanceDifference}</h3>
        {action === "PAYMENT" && <div className="grid grid-cols-2 gap-3">
          <label className="text-xs font-bold">{m.handedUsd}<input className="control mt-1" inputMode="decimal" value={usd} onChange={(e) => setUsd(e.target.value)} /></label>
          <label className="text-xs font-bold">{m.handedLbp}<input className="control mt-1" inputMode="numeric" value={lbp} onChange={(e) => setLbp(e.target.value)} /></label>
        </div>}
        <label className="block text-xs font-bold" htmlFor="cash-action-reason">{m.reasonLabel}</label>
        <textarea id="cash-action-reason" className="control w-full" rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
        <p className="hint">{action === "PAYMENT" ? m.paymentExplanation : m.acceptExplanation}</p>
        {error && <p role="alert" className="text-(--red) text-xs">{error}</p>}
        <div className="flex gap-2"><button type="button" className="btn tiny primary" disabled={busy || reason.trim().length < 5 || (action === "PAYMENT" && !(Number(usd) > 0 || Number(lbp) > 0))} onClick={submit}>{m.saveAction}</button><button type="button" className="btn tiny" onClick={() => setAction(null)}>{m.cancelAction}</button></div>
      </div>}
    </div>
  );
}
