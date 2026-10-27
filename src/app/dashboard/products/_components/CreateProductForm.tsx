"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, Card, Field, IconButton, Input, Textarea } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { fill } from "@/i18n/locale";
import type { CatalogueMessages } from "@/i18n/messages/catalogue";
import type { CommonMessages } from "@/i18n/messages/common";
import { api, errorMessage } from "@/lib/api";
import { CardHead, ExtrasFields, blankExtras, extrasBody, type Category, type Extras } from "./ProductExtras";
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
        <Input value={value.price} onChange={set("price")} required dir="ltr" inputMode="decimal" pattern={currency === "USD" ? "\\d+(\\.\\d{1,2})?" : "\\d+"} />
      </Field>
      <Field label={m.stock}>
        <Input value={value.stock} onChange={set("stock")} type="number" dir="ltr" min={0} max={100000} inputMode="numeric" />
      </Field>
      <Field label={m.sku} className="col-span-2 sm:col-span-1">
        <Input value={value.sku} onChange={set("sku")} maxLength={40} />
      </Field>
    </div>
  );
}

export function CreateProductForm({ currency, categories, m, t }: { currency: Currency; categories: Category[]; m: CatalogueMessages; t: CommonMessages }) {
  const router = useRouter();
  const [rows, setRows] = useState<VariantDraft[]>([blank]);
  const [extras, setExtras] = useState<Extras>(blankExtras);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(form: FormData) {
    setPending(true);
    setError(null);
    try {
      const product = await api<{ id: string }>("/api/products", {
        body: { name: form.get("name"), description: String(form.get("description") ?? "") || null, variants: rows.map(variantBody), ...extrasBody(extras) },
      });
      router.push(`/dashboard/products/${product.id}`);
    } catch (e) {
      setError(errorMessage(e, t.error));
      setPending(false);
    }
  }

  return (
    <form onSubmit={submitWith(submit)} className="flex max-w-3xl flex-col gap-4">
      <Card className="flex flex-col gap-4">
        <CardHead title={m.details} />
        <Field label={m.name}>
          <Input name="name" required maxLength={120} />
        </Field>
        <Field label={m.description} hint={t.optional}>
          <Textarea name="description" maxLength={2000} />
        </Field>
      </Card>
      <Card className="flex flex-col gap-4">
        <CardHead title={m.variants} hint={m.variantsHint} />
        {rows.map((row, i) => (
          <fieldset key={i} className="flex flex-col gap-2 rounded-sl border border-sl-border bg-sl-bg p-3">
            <legend className="sr-only">{fill(m.variantN, { n: i + 1 })}</legend>
            <div className="flex min-h-11 items-center justify-between gap-2">
              <span aria-hidden className="text-sm font-bold">
                {fill(m.variantN, { n: i + 1 })}
              </span>
              {rows.length > 1 && <IconButton label={m.removeVariant} icon="x" onClick={() => setRows(rows.filter((_, j) => j !== i))} />}
            </div>
            <VariantFields value={row} onChange={(v) => setRows(rows.map((r, j) => (j === i ? v : r)))} currency={currency} m={m} />
          </fieldset>
        ))}
        <Button tone="secondary" className="self-start" onClick={() => setRows([...rows, { ...blank, price: rows.at(-1)?.price ?? "" }])}>
          <Icon name="plus" />
          {m.addVariant}
        </Button>
      </Card>
      <ExtrasFields value={extras} onChange={setExtras} categories={categories} m={m} />
      {error && <Alert tone="error">{error}</Alert>}
      <Button type="submit" disabled={pending} block className="min-h-12 text-[15px]">
        {pending ? m.creating : m.createProduct}
      </Button>
    </form>
  );
}
