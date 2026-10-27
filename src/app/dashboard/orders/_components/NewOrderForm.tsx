"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { Alert, Button, Card, Field, IconButton, Input, QtyStepper, Select, Textarea } from "@/components/ui";
import { fill, type Locale } from "@/i18n/locale";
import type { CommonMessages } from "@/i18n/messages/common";
import type { OrderMessages } from "@/i18n/messages/orders";
import { api, errorMessage, newIdempotencyKey } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { AddressFields, addressFrom } from "./AddressFields";

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
    <form onSubmit={submit} className="flex max-w-2xl flex-col gap-4 pb-6">
      <Box title={m.itemsTitle}>
        {lines.length > 0 && (
          <ul className="flex flex-col gap-2.5">
            {lines.map((l, i) => {
              const v = byId.get(l.variantId)!;
              return (
                <li key={l.variantId} className="flex flex-col gap-3 rounded-sl border border-sl-border bg-sl-bg p-3">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="font-bold">{v.label}</p>
                      <p className="text-xs text-sl-muted">
                        <span className="tabular-nums">{money(v.priceMinor)}</span> · {fill(m.inStock, { n: v.available })}
                      </p>
                    </div>
                    <IconButton label={`${t.remove} ${v.label}`} icon="x" onClick={() => setLines(lines.filter((_, j) => j !== i))} />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <QtyStepper value={l.qty} onChange={(qty) => update(i, { qty })} max={Math.max(1, Math.min(20, v.available))} locale={locale} label={v.label} shape="square" />
                    <span className="font-extrabold tabular-nums">{money(v.priceMinor * l.qty)}</span>
                  </div>
                  {v.custom && (
                    <Field label={v.custom.required ? v.custom.label : `${v.custom.label} (${t.optional})`} hint={fill(m.noteHint, { n: v.custom.maxLength })}>
                      <Textarea
                        value={l.note}
                        onChange={(e) => update(i, { note: e.target.value })}
                        required={v.custom.required}
                        maxLength={v.custom.maxLength}
                        placeholder={v.custom.placeholder ?? undefined}
                        className="min-h-16"
                      />
                    </Field>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <Field label={m.addItem}>
          <Select
            value=""
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
          </Select>
        </Field>
        {lines.length > 0 && (
          <p className="flex justify-between border-t border-sl-border pt-3 text-base font-extrabold">
            <span>{m.subtotal}</span>
            <span className="tabular-nums">{money(subtotal)}</span>
          </p>
        )}
      </Box>

      <Box title={m.customer}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={m.customerName}>
            <Input name="name" required maxLength={80} autoComplete="off" />
          </Field>
          <Field label={m.phone} hint={m.phoneHint}>
            <Input name="phone" type="tel" required inputMode="tel" dir="ltr" autoComplete="off" />
          </Field>
          <Field label={`${m.email} (${t.optional})`} className="sm:col-span-2">
            <Input name="email" type="email" maxLength={200} dir="ltr" autoComplete="off" />
          </Field>
        </div>
      </Box>

      <Box title={m.address}>
        <AddressFields m={m} t={t} />
        <Field label={`${m.notes} (${t.optional})`}>
          <Textarea name="notes" maxLength={500} />
        </Field>
      </Box>

      <Box>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={m.firstContactAt} hint={m.firstContactHint}>
            <Input name="firstContactAt" type="datetime-local" dir="ltr" />
          </Field>
          <Field label={`${m.deliveryFee} (${currency})`} hint={m.deliveryFeeHint}>
            <Input name="deliveryFee" inputMode="decimal" pattern={currency === "USD" ? "\\d{1,12}(\\.\\d{1,2})?" : "\\d{1,12}"} dir="ltr" />
          </Field>
        </div>
      </Box>

      <div className="flex flex-col gap-3">
        {error && <Alert tone="error">{error}</Alert>}
        <Button type="submit" block disabled={busy} className="min-h-12 text-[15px]">
          {busy ? m.creating : m.createOrder}
        </Button>
      </div>
    </form>
  );
}

function Box({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <Card className="flex flex-col gap-3 rounded-[17px] p-5">
      {title && <h2 className="sl-heading text-lg">{title}</h2>}
      {children}
    </Card>
  );
}
