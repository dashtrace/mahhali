"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Alert, IconButton, QtyStepper } from "@/components/ui";
import { fill, type Locale } from "@/i18n/locale";
import type { CommonMessages } from "@/i18n/messages/common";
import type { OrderMessages } from "@/i18n/messages/orders";
import { api, errorMessage, newIdempotencyKey } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { AddressFields, addressFrom } from "./AddressFields";
import { Field } from "./Field";

type Variant = {
  id: string;
  label: string;
  priceMinor: number;
  available: number;
  custom: { label: string; placeholder: string | null; required: boolean; maxLength: number } | null;
};

/** An order that came in by DM: staff pick the items and type the customer's details. */
export function NewOrderForm({
  variants,
  currency,
  locale,
  m,
  t,
}: {
  variants: Variant[];
  currency: "USD" | "LBP";
  locale: Locale;
  m: OrderMessages;
  t: CommonMessages;
}) {
  const router = useRouter();
  // One key per filled-in form, so a double tap or a retry never creates two orders.
  const [key] = useState(newIdempotencyKey);
  const [lines, setLines] = useState<{ variantId: string; qty: number; note: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const byId = new Map(variants.map((v) => [v.id, v]));
  const subtotal = lines.reduce((sum, l) => sum + (byId.get(l.variantId)?.priceMinor ?? 0) * l.qty, 0);
  const money = (minor: number) => formatMoney(minor, currency, locale);
  const update = (i: number, patch: Partial<(typeof lines)[number]>) => setLines(lines.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!lines.length) return setError(m.needItem);
    const form = new FormData(e.currentTarget);
    const get = (k: string) => String(form.get(k) ?? "").trim();
    setBusy(true);
    setError(null);
    try {
      const order = await api<{ id: string }>("/api/orders", {
        headers: { "Idempotency-Key": key },
        body: {
          items: lines.map((l) => ({ variantId: l.variantId, qty: l.qty, note: l.note.trim() || null })),
          customer: { name: get("name"), phone: get("phone"), email: get("email") || null },
          address: addressFrom(form),
          notes: get("notes") || null,
          // datetime-local has no zone: read it as the browser's local time.
          firstContactAt: get("firstContactAt") ? new Date(get("firstContactAt")).toISOString() : undefined,
          deliveryFee: get("deliveryFee") || undefined,
        },
      });
      router.push(`/dashboard/orders/${order.id}`);
    } catch (err) {
      setError(errorMessage(err, t.error));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card order-list-view">
      <div className="split">
        <Field label={m.customerName}>
          <input name="name" required maxLength={80} autoComplete="off" placeholder={m.namePlaceholder} className="control" />
        </Field>
        <Field label={m.phone}>
          <input name="phone" type="tel" required inputMode="tel" dir="ltr" autoComplete="off" placeholder={m.phonePlaceholder} className="control rtl:text-right" />
        </Field>
      </div>

      <AddressFields landmark={false} m={m} t={t} />

      <Field label={m.products}>
        <select
          value=""
          className="control"
          onChange={(e) => {
            if (e.target.value) setLines([...lines, { variantId: e.target.value, qty: 1, note: "" }]);
          }}
        >
          <option value="">{m.chooseProduct}</option>
          {variants
            .filter((v) => !lines.some((l) => l.variantId === v.id))
            .map((v) => (
              <option key={v.id} value={v.id} disabled={v.available < 1}>
                {v.label} · {money(v.priceMinor)} · {v.available < 1 ? m.soldOut : fill(m.inStock, { n: v.available })}
              </option>
            ))}
        </select>
      </Field>
      {lines.length > 0 && (
        <div className="mb-[17px] flex flex-col gap-2.5">
          {lines.map((l, i) => {
            const v = byId.get(l.variantId)!;
            return (
              <div key={l.variantId} className="inner-card">
                <div className="between items-start">
                  <div className="min-w-0">
                    <b>{v.label}</b>
                    <p className="hint mb-0">
                      <span className="tabular-nums">{money(v.priceMinor)}</span> · {fill(m.inStock, { n: v.available })}
                    </p>
                  </div>
                  <IconButton label={`${t.remove} ${v.label}`} icon="x" onClick={() => setLines(lines.filter((_, j) => j !== i))} />
                </div>
                <div className="between mt-3">
                  <QtyStepper value={l.qty} onChange={(qty) => update(i, { qty })} max={Math.max(1, Math.min(20, v.available))} locale={locale} label={v.label} shape="square" />
                  <b className="tabular-nums">{money(v.priceMinor * l.qty)}</b>
                </div>
                {v.custom && (
                  <Field label={v.custom.required ? v.custom.label : `${v.custom.label} (${t.optional})`} hint={fill(m.noteHint, { n: v.custom.maxLength })} className="mt-3 mb-0">
                    <textarea
                      value={l.note}
                      onChange={(e) => update(i, { note: e.target.value })}
                      required={v.custom.required}
                      maxLength={v.custom.maxLength}
                      placeholder={v.custom.placeholder ?? undefined}
                      className="control area min-h-16"
                    />
                  </Field>
                )}
              </div>
            );
          })}
          <div className="between">
            <b>{m.subtotal}</b>
            <b className="tabular-nums">{money(subtotal)}</b>
          </div>
        </div>
      )}

      {/* Everything here is optional. Closed fields still submit. */}
      <details className="mb-[17px]">
        <summary className="bold cursor-pointer text-xs">{m.moreDetails}</summary>
        <div className="mt-3">
          <Field label={`${m.email} (${t.optional})`}>
            <input name="email" type="email" maxLength={200} dir="ltr" autoComplete="off" className="control rtl:text-right" />
          </Field>
          <Field label={`${m.landmark} (${t.optional})`}>
            <input name="landmark" maxLength={200} className="control" />
          </Field>
          <Field label={`${m.notes} (${t.optional})`}>
            <textarea name="notes" maxLength={500} className="control area" />
          </Field>
          <div className="split">
            <Field label={m.firstContactAt} hint={m.firstContactHint}>
              <input name="firstContactAt" type="datetime-local" dir="ltr" className="control" />
            </Field>
            <Field label={`${m.deliveryFee} (${currency})`} hint={m.deliveryFeeHint}>
              <input name="deliveryFee" inputMode="decimal" pattern={currency === "USD" ? "\\d{1,12}(\\.\\d{1,2})?" : "\\d{1,12}"} dir="ltr" className="control" />
            </Field>
          </div>
        </div>
      </details>

      {error && <Alert tone="error" className="mb-3">{error}</Alert>}
      <button type="submit" className="btn primary" disabled={busy}>
        {busy ? m.creating : m.createOrder}
      </button>
    </form>
  );
}
