"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Icon } from "@/components/Icon";
import { Alert, Button, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { fill, type Locale } from "@/i18n/locale";
import type { CommonMessages } from "@/i18n/messages/common";
import type { OrderMessages } from "@/i18n/messages/orders";
import { api, errorMessage, newIdempotencyKey } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { AddressFields, addressFrom } from "./AddressFields";

type Variant = { id: string; label: string; priceMinor: number; available: number };

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
  const [lines, setLines] = useState<{ variantId: string; qty: number }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const byId = new Map(variants.map((v) => [v.id, v]));
  const subtotal = lines.reduce((sum, l) => sum + (byId.get(l.variantId)?.priceMinor ?? 0) * l.qty, 0);

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
          items: lines,
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
    <form onSubmit={submit} className="flex flex-col gap-4 pb-6">
      <Card className="flex flex-col gap-3">
        <h2 className="font-semibold">{m.itemsTitle}</h2>
        {lines.map((l, i) => {
          const v = byId.get(l.variantId)!;
          return (
            <div key={l.variantId} className="flex items-end gap-2">
              <div className="min-w-0 flex-1 text-sm">
                <p className="truncate font-medium">{v.label}</p>
                <p className="text-xs text-stone-500">
                  {formatMoney(v.priceMinor, currency, locale)} · {fill(m.inStock, { n: v.available })}
                </p>
              </div>
              <Field label={m.qty} className="w-20">
                <Input
                  type="number"
                  min={1}
                  max={Math.min(20, v.available)}
                  value={l.qty}
                  onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, qty: Number(e.target.value) || 1 } : x)))}
                  dir="ltr"
                />
              </Field>
              <Button tone="ghost" aria-label={`${t.remove} ${v.label}`} onClick={() => setLines(lines.filter((_, j) => j !== i))}>
                <Icon name="x" />
              </Button>
            </div>
          );
        })}
        <Field label={m.addItem}>
          <Select
            value=""
            onChange={(e) => {
              if (e.target.value) setLines([...lines, { variantId: e.target.value, qty: 1 }]);
            }}
          >
            <option value="">{m.chooseProduct}</option>
            {variants
              .filter((v) => !lines.some((l) => l.variantId === v.id))
              .map((v) => (
                <option key={v.id} value={v.id} disabled={v.available < 1}>
                  {v.label} · {formatMoney(v.priceMinor, currency, locale)} · {v.available < 1 ? m.soldOut : fill(m.inStock, { n: v.available })}
                </option>
              ))}
          </Select>
        </Field>
        {lines.length > 0 && (
          <p className="flex justify-between border-t border-stone-200 pt-2 text-sm font-semibold">
            <span>{m.subtotal}</span>
            <span className="tabular-nums">{formatMoney(subtotal, currency, locale)}</span>
          </p>
        )}
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="font-semibold">{m.customer}</h2>
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
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="font-semibold">{m.address}</h2>
        <AddressFields m={m} t={t} />
        <Field label={`${m.notes} (${t.optional})`}>
          <Textarea name="notes" maxLength={500} />
        </Field>
      </Card>

      <Card className="grid gap-3 sm:grid-cols-2">
        <Field label={m.firstContactAt} hint={m.firstContactHint}>
          <Input name="firstContactAt" type="datetime-local" dir="ltr" />
        </Field>
        <Field label={`${m.deliveryFee} (${currency})`} hint={m.deliveryFeeHint}>
          <Input name="deliveryFee" inputMode="decimal" pattern={currency === "USD" ? "\\d{1,12}(\\.\\d{1,2})?" : "\\d{1,12}"} dir="ltr" />
        </Field>
      </Card>

      {error && <Alert tone="error">{error}</Alert>}
      <Button type="submit" block disabled={busy} className="min-h-12 text-base">
        {busy ? m.creating : m.createOrder}
      </Button>
    </form>
  );
}
