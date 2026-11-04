"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui";
import type { CommonMessages } from "@/i18n/messages/common";
import type { OrderMessages } from "@/i18n/messages/orders";
import { api, errorMessage } from "@/lib/api";
import { toAmountText } from "@/lib/format";
import { DashIcon } from "../../_components/DashIcon";
import { Field } from "./Field";

/**
 * Delivered (with the cash collected, in dollars and pounds) or Failed (with a
 * reason). Used by the delivery phone screen and the order page.
 */
export function DeliverForm({
  orderId,
  currency,
  codMinor,
  m,
  t,
}: {
  orderId: string;
  currency: "USD" | "LBP";
  codMinor: number;
  m: OrderMessages;
  t: CommonMessages;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"delivered" | "failed" | null>(null);
  // Prefilled with the amount due, in the currency the order was priced in.
  const [usd, setUsd] = useState(currency === "USD" ? toAmountText(codMinor, "USD") : "");
  const [lbp, setLbp] = useState(currency === "LBP" ? toAmountText(codMinor, "LBP") : "");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "delivered") {
        await api(`/api/delivery/orders/${orderId}/delivered`, {
          body: { collectedUsd: usd.trim() || undefined, collectedLbp: lbp.trim() || undefined },
        });
      } else {
        await api(`/api/delivery/orders/${orderId}/failed`, { body: { reason } });
      }
      router.refresh();
    } catch (err) {
      setError(errorMessage(err, m.actionFailed));
      setBusy(false);
    }
  }

  if (!mode) {
    return (
      <div className="split mt-3">
        <button type="button" className="btn primary full min-h-12" onClick={() => setMode("delivered")}>
          <DashIcon name="check" size="sm" />
          {m.delivered}
        </button>
        <button type="button" className="btn warn full min-h-12" onClick={() => setMode("failed")}>
          <DashIcon name="x" size="sm" />
          {m.failed}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-3">
      {error && <Alert tone="error" className="mb-3">{error}</Alert>}
      {mode === "delivered" ? (
        <div className="split">
          <Field label={m.collectedUsd}>
            <input value={usd} onChange={(e) => setUsd(e.target.value)} inputMode="decimal" dir="ltr" placeholder="0.00" autoFocus={currency === "USD"} className="control" />
          </Field>
          <Field label={m.collectedLbp}>
            <input value={lbp} onChange={(e) => setLbp(e.target.value)} inputMode="numeric" dir="ltr" placeholder="0" autoFocus={currency === "LBP"} className="control" />
          </Field>
        </div>
      ) : (
        <Field label={m.failReason}>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} required maxLength={300} placeholder={m.failPlaceholder} autoFocus className="control area" />
        </Field>
      )}
      <div className="split">
        <button type="button" className="btn full" onClick={() => setMode(null)} disabled={busy}>
          {t.cancel}
        </button>
        <button type="submit" className={`btn full ${mode === "failed" ? "warn" : "primary"}`} disabled={busy}>
          {busy ? t.saving : mode === "delivered" ? m.confirmDelivered : m.confirmFailed}
        </button>
      </div>
    </form>
  );
}
