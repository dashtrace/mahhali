"use client";

import { useState } from "react";
import { Alert, Badge, Button, Card, Field, Input, Select, Textarea, cx } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { fill, type Locale } from "@/i18n/locale";
import type { CatalogueMessages } from "@/i18n/messages/catalogue";
import type { CommonMessages } from "@/i18n/messages/common";
import { api } from "@/lib/api";
import { formatDateTime, toAmountText } from "@/lib/format";
import { VariantFields, variantBody, type VariantDraft } from "./CreateProductForm";
import { submitWith, useAction } from "./useAction";

type Currency = "USD" | "LBP";
type Variant = { id: string; size: string | null; colour: string | null; sku: string | null; priceMinor: number; available: number; reserved: number; archived: boolean };
type Product = {
  id: string;
  name: string;
  description: string | null;
  status: "ACTIVE" | "ARCHIVED";
  variants: Variant[];
  images: { id: string; url: string; colour: string | null }[];
};
type Movement = { id: string; delta: number; reason: "RESERVE" | "RELEASE" | "SHIP" | "RESTOCK" | "ADJUST"; note: string | null; at: string };
type Common = { currency: Currency; locale: Locale; m: CatalogueMessages; t: CommonMessages };

export function ProductEditor({ product, ...c }: { product: Product } & Common) {
  const { m, t } = c;
  const details = useAction(t.error);
  const archive = useAction(t.error);
  const archived = product.status === "ARCHIVED";
  const colours = [...new Set(product.variants.map((v) => v.colour).filter((x): x is string => !!x))];

  return (
    <div className="flex flex-col gap-4">
      {archived && <Alert tone="warning">{m.archivedNotice}</Alert>}

      <Card>
        <h2 className="mb-3 font-semibold">{m.details}</h2>
        <form
          key={`${product.name}|${product.description}`}
          onSubmit={submitWith((f) =>
            details.run(() =>
              api(`/api/products/${product.id}`, { method: "PATCH", body: { name: f.get("name"), description: String(f.get("description") ?? "") || null } }),
            ),
          )}
          className="flex flex-col gap-4"
        >
          {details.error && <Alert tone="error">{details.error}</Alert>}
          <Field label={m.name}>
            <Input name="name" defaultValue={product.name} required maxLength={120} />
          </Field>
          <Field label={m.description} hint={t.optional}>
            <Textarea name="description" defaultValue={product.description ?? ""} maxLength={2000} />
          </Field>
          <Button type="submit" disabled={details.busy} className="self-start">
            {details.busy ? t.saving : t.save}
          </Button>
        </form>
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">{m.variants}</h2>
        {product.variants.map((v) => (
          <VariantCard key={v.id} variant={v} {...c} />
        ))}
        <AddVariant productId={product.id} {...c} />
      </section>

      <Photos productId={product.id} images={product.images} colours={colours} {...c} />

      <div className="flex flex-col gap-2">
        {archive.error && <Alert tone="error">{archive.error}</Alert>}
        {archived ? (
          <Button tone="secondary" disabled={archive.busy} onClick={() => archive.run(() => api(`/api/products/${product.id}`, { method: "PATCH", body: { status: "ACTIVE" } }))}>
            {m.restoreProduct}
          </Button>
        ) : (
          <Button
            tone="danger"
            disabled={archive.busy}
            onClick={() => confirm(m.archiveConfirm) && archive.run(() => api(`/api/products/${product.id}`, { method: "DELETE" }))}
          >
            {m.archiveProduct}
          </Button>
        )}
      </div>
    </div>
  );
}

function VariantCard({ variant: v, currency, locale, m, t }: { variant: Variant } & Common) {
  const edit = useAction(t.error);
  const stock = useAction(t.error);
  const [history, setHistory] = useState<Movement[] | null>(null);
  const [stockDone, setStockDone] = useState(false);
  const label = [v.size, v.colour].filter(Boolean).join(" / ") || m.noOptions;
  const loadHistory = async () => setHistory(await api<Movement[]>(`/api/variants/${v.id}/movements`));

  return (
    <Card className={cx("flex flex-col gap-3", v.archived && "bg-stone-50")}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-medium">{label}</h3>
        <Badge tone={v.available > 0 ? "green" : "red"}>{fill(m.available, { n: v.available })}</Badge>
        {v.reserved > 0 && <Badge tone="amber">{fill(m.reserved, { n: v.reserved })}</Badge>}
        {v.archived && <Badge>{m.hidden}</Badge>}
      </div>

      <form
        key={`${v.size}|${v.colour}|${v.sku}|${v.priceMinor}`}
        onSubmit={submitWith((f) =>
          edit.run(() =>
            api(`/api/variants/${v.id}`, {
              method: "PATCH",
              body: { size: f.get("size"), colour: f.get("colour"), sku: f.get("sku"), price: String(f.get("price")).trim() },
            }),
          ),
        )}
        className="flex flex-col gap-3"
      >
        {edit.error && <Alert tone="error">{edit.error}</Alert>}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label={m.size}>
            <Input name="size" defaultValue={v.size ?? ""} maxLength={40} />
          </Field>
          <Field label={m.colour}>
            <Input name="colour" defaultValue={v.colour ?? ""} maxLength={40} />
          </Field>
          <Field label={fill(m.price, { currency })}>
            <Input name="price" defaultValue={toAmountText(v.priceMinor, currency)} required inputMode="decimal" />
          </Field>
          <Field label={m.sku}>
            <Input name="sku" defaultValue={v.sku ?? ""} maxLength={40} />
          </Field>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" tone="secondary" disabled={edit.busy}>
            {edit.busy ? t.saving : m.saveVariant}
          </Button>
          <Button tone="ghost" disabled={edit.busy} onClick={() => edit.run(() => api(`/api/variants/${v.id}`, { method: "PATCH", body: { archived: !v.archived } }))}>
            {v.archived ? m.showVariant : m.hideVariant}
          </Button>
        </div>
      </form>

      <form
        onSubmit={submitWith(async (f, form) => {
          setStockDone(false);
          const ok = await stock.run(() =>
            api(`/api/variants/${v.id}/stock-adjustments`, { body: { delta: Number(f.get("delta")), note: String(f.get("note") ?? "") || null } }),
          );
          setStockDone(ok);
          if (!ok) return;
          form.reset();
          if (history) await loadHistory().catch(() => {});
        })}
        className="flex flex-col gap-3 border-t border-stone-200 pt-3"
      >
        <h4 className="text-sm font-medium">{m.adjustStock}</h4>
        {stock.error && <Alert tone="error">{stock.error}</Alert>}
        {stockDone && <Alert tone="success">{m.stockUpdated}</Alert>}
        <div className="grid grid-cols-[7rem_1fr] gap-3">
          <Field label={m.delta}>
            <Input name="delta" type="number" required min={-100000} max={100000} step={1} inputMode="numeric" />
          </Field>
          <Field label={m.note} hint={t.optional}>
            <Input name="note" maxLength={200} placeholder={m.notePlaceholder} />
          </Field>
        </div>
        <p className="-mt-1 text-xs text-stone-500">{m.deltaHint}</p>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" tone="secondary" disabled={stock.busy}>
            {m.apply}
          </Button>
          <Button tone="ghost" aria-expanded={!!history} onClick={() => (history ? setHistory(null) : loadHistory().catch(() => setHistory([])))}>
            {history ? m.hideHistory : m.history}
          </Button>
        </div>
      </form>

      {history && (
        <ul className="divide-y divide-stone-100 text-sm">
          {history.length === 0 && <li className="py-2 text-stone-500">{m.noMovements}</li>}
          {history.map((h) => (
            <li key={h.id} className="flex items-start justify-between gap-3 py-2">
              <div className="min-w-0">
                <p>{m[`reason${h.reason}`]}</p>
                {h.note && <p className="break-words text-stone-500">{h.note}</p>}
                <p className="text-xs text-stone-500">{formatDateTime(h.at, locale)}</p>
              </div>
              <span dir="ltr" className={cx("font-medium tabular-nums", h.delta > 0 ? "text-emerald-700" : "text-red-700")}>
                {h.delta > 0 ? `+${h.delta}` : h.delta}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function AddVariant({ productId, currency, m, t }: { productId: string } & Common) {
  const blank: VariantDraft = { size: "", colour: "", sku: "", price: "", stock: "0" };
  const [draft, setDraft] = useState<VariantDraft | null>(null);
  const add = useAction(t.error);

  if (!draft) {
    return (
      <Button tone="secondary" onClick={() => setDraft(blank)}>
        <Icon name="plus" />
        {m.addVariant}
      </Button>
    );
  }
  return (
    <Card>
      <form
        onSubmit={submitWith(async () => {
          if (await add.run(() => api(`/api/products/${productId}/variants`, { body: variantBody(draft) }))) setDraft(null);
        })}
        className="flex flex-col gap-3"
      >
        <h3 className="font-medium">{m.addVariant}</h3>
        {add.error && <Alert tone="error">{add.error}</Alert>}
        <VariantFields value={draft} onChange={setDraft} currency={currency} m={m} />
        <div className="flex gap-2">
          <Button type="submit" disabled={add.busy}>
            {add.busy ? t.saving : t.add}
          </Button>
          <Button tone="ghost" onClick={() => setDraft(null)}>
            {t.cancel}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function Photos({ productId, images, colours, m, t }: { productId: string; images: Product["images"]; colours: string[] } & Common) {
  const action = useAction(t.error);
  const [colour, setColour] = useState("");

  async function upload(file: File | undefined) {
    if (!file) return;
    const form = new FormData();
    form.set("file", file);
    if (colour) form.set("colour", colour);
    await action.run(() => api(`/api/products/${productId}/images`, { body: form }));
  }

  return (
    <Card className="flex flex-col gap-3">
      <div>
        <h2 className="font-semibold">{m.photos}</h2>
        <p className="text-sm text-stone-600">{m.photosHint}</p>
      </div>
      {action.error && <Alert tone="error">{action.error}</Alert>}
      {images.length === 0 ? (
        <p className="text-sm text-stone-500">{m.noPhotos}</p>
      ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {images.map((img) => (
            <li key={img.id} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- uploaded files are served as-is */}
              <img src={img.url} alt="" className="aspect-square w-full rounded-[var(--radius)] object-cover" />
              {img.colour && <Badge className="absolute bottom-1 start-1">{img.colour}</Badge>}
              <button
                type="button"
                aria-label={m.deletePhoto}
                disabled={action.busy}
                onClick={() => confirm(m.deletePhotoConfirm) && action.run(() => api(`/api/products/${productId}/images/${img.id}`, { method: "DELETE" }))}
                className="absolute end-0 top-0 flex size-11 items-center justify-center"
              >
                <span className="flex size-7 items-center justify-center rounded-full bg-white/90 text-stone-800 shadow">
                  <Icon name="x" className="size-4" />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        {colours.length > 0 && (
          <Field label={m.photoColour} className="sm:w-56">
            <Select value={colour} onChange={(e) => setColour(e.target.value)}>
              <option value="">{m.anyColour}</option>
              {colours.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <label
          className={cx(
            "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-[var(--radius)] border border-stone-300 bg-white px-4 text-sm font-medium hover:bg-stone-50",
            "focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--brand)]",
            action.busy && "pointer-events-none opacity-50",
          )}
        >
          <Icon name="plus" />
          {action.busy ? m.uploading : m.addPhoto}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            disabled={action.busy}
            onChange={(e) => {
              upload(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
      </div>
    </Card>
  );
}
