"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Alert, Button, Field, Input, Textarea } from "@/components/ui";
import { Icon } from "@/components/Icon";
import type { CommonMessages } from "@/i18n/messages/common";
import type { OrderMessages } from "@/i18n/messages/orders";
import { api, errorMessage } from "@/lib/api";
import { toAmountText } from "@/lib/format";

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
      <div className="grid grid-cols-2 gap-2">
        <Button className="min-h-14 text-base" onClick={() => setMode("delivered")}>
          <Icon name="check" />
          {m.delivered}
        </Button>
        <Button tone="secondary" className="min-h-14 text-base" onClick={() => setMode("failed")}>
          <Icon name="x" />
          {m.failed}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      {error && <Alert tone="error">{error}</Alert>}
      {mode === "delivered" ? (
        <div className="grid grid-cols-2 gap-2">
          <Field label={m.collectedUsd}>
            <Input value={usd} onChange={(e) => setUsd(e.target.value)} inputMode="decimal" dir="ltr" placeholder="0.00" autoFocus={currency === "USD"} />
          </Field>
          <Field label={m.collectedLbp}>
            <Input value={lbp} onChange={(e) => setLbp(e.target.value)} inputMode="numeric" dir="ltr" placeholder="0" autoFocus={currency === "LBP"} />
          </Field>
        </div>
      ) : (
        <Field label={m.failReason}>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} required maxLength={300} placeholder={m.failPlaceholder} autoFocus />
        </Field>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" tone="secondary" onClick={() => setMode(null)} disabled={busy}>
          {t.cancel}
        </Button>
        <Button type="submit" tone={mode === "failed" ? "danger" : "primary"} disabled={busy}>
          {busy ? t.saving : mode === "delivered" ? m.confirmDelivered : m.confirmFailed}
        </Button>
      </div>
    </form>
  );
}
