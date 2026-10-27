"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, Card, Field, Input, Textarea } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { fill } from "@/i18n/locale";
import type { CatalogueMessages } from "@/i18n/messages/catalogue";
import type { CommonMessages } from "@/i18n/messages/common";
import { api, errorMessage } from "@/lib/api";
import { submitWith } from "./useAction";

type Currency = "USD" | "LBP";
export type VariantDraft = { size: string; colour: string; sku: string; price: string; stock: string };
const blank: VariantDraft = { size: "", colour: "", sku: "", price: "", stock: "0" };

/** The API body for one variant row. */
export const variantBody = (v: VariantDraft) => ({ size: v.size, colour: v.colour, sku: v.sku, price: v.price.trim(), stock: Number(v.stock) || 0 });

/** Size, colour, SKU, price and opening stock for one variant. */
export function VariantFields({ value, onChange, currency, m }: { value: VariantDraft; onChange: (v: VariantDraft) => void; currency: Currency; m: CatalogueMessages }) {
  const set = (k: keyof VariantDraft) => (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...value, [k]: e.target.value });
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      <Field label={m.size}>
        <Input value={value.size} onChange={set("size")} maxLength={40} placeholder={m.sizePlaceholder} />
      </Field>
      <Field label={m.colour}>
        <Input value={value.colour} onChange={set("colour")} maxLength={40} placeholder={m.colourPlaceholder} />
      </Field>
      <Field label={fill(m.price, { currency })}>
        <Input value={value.price} onChange={set("price")} required inputMode="decimal" pattern={currency === "USD" ? "\\d+(\\.\\d{1,2})?" : "\\d+"} />
      </Field>
      <Field label={m.stock}>
        <Input value={value.stock} onChange={set("stock")} type="number" min={0} max={100000} inputMode="numeric" />
      </Field>
      <Field label={m.sku} className="col-span-2 sm:col-span-1">
        <Input value={value.sku} onChange={set("sku")} maxLength={40} />
      </Field>
    </div>
  );
}

export function CreateProductForm({ currency, m, t }: { currency: Currency; m: CatalogueMessages; t: CommonMessages }) {
  const router = useRouter();
  const [rows, setRows] = useState<VariantDraft[]>([blank]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(form: FormData) {
    setPending(true);
    setError(null);
    try {
      const product = await api<{ id: string }>("/api/products", {
        body: { name: form.get("name"), description: String(form.get("description") ?? "") || null, variants: rows.map(variantBody) },
      });
      router.push(`/dashboard/products/${product.id}`);
    } catch (e) {
      setError(errorMessage(e, t.error));
      setPending(false);
    }
  }

  return (
    <form onSubmit={submitWith(submit)} className="flex flex-col gap-4">
      {error && <Alert tone="error">{error}</Alert>}
      <Card className="flex flex-col gap-4">
        <Field label={m.name}>
          <Input name="name" required maxLength={120} />
        </Field>
        <Field label={m.description} hint={t.optional}>
          <Textarea name="description" maxLength={2000} />
        </Field>
      </Card>
      <Card className="flex flex-col gap-4">
        <div>
          <h2 className="font-semibold">{m.variants}</h2>
          <p className="text-sm text-stone-600">{m.variantsHint}</p>
        </div>
        {rows.map((row, i) => (
          <fieldset key={i} className="flex flex-col gap-2 border-t border-stone-200 pt-3 first-of-type:border-0 first-of-type:pt-0">
            <legend className="flex w-full items-center justify-between text-sm font-medium text-stone-700">
              {fill(m.variantN, { n: i + 1 })}
              {rows.length > 1 && (
                <Button tone="ghost" aria-label={m.removeVariant} onClick={() => setRows(rows.filter((_, j) => j !== i))}>
                  <Icon name="x" />
                </Button>
              )}
            </legend>
            <VariantFields value={row} onChange={(v) => setRows(rows.map((r, j) => (j === i ? v : r)))} currency={currency} m={m} />
          </fieldset>
        ))}
        <Button tone="secondary" onClick={() => setRows([...rows, { ...blank, price: rows.at(-1)?.price ?? "" }])}>
          <Icon name="plus" />
          {m.addVariant}
        </Button>
      </Card>
      <Button type="submit" disabled={pending} block>
        {pending ? m.creating : m.createProduct}
      </Button>
    </form>
  );
}
