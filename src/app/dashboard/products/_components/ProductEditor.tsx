"use client";

import { useState } from "react";
import { Alert, Badge, Button, Card, Field, IconButton, Input, SaveButton, Select, Textarea, cx } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { fill, type Locale } from "@/i18n/locale";
import type { CatalogueMessages } from "@/i18n/messages/catalogue";
import type { CommonMessages } from "@/i18n/messages/common";
import { api } from "@/lib/api";
import { formatDateTime, toAmountText } from "@/lib/format";
import { OptionsFields, VariantFields, blankVariant, variantBody, type VariantDraft } from "./CreateProductForm";
import { FilePicker } from "./FilePicker";
import { CardHead, ExtrasFields, extrasBody, extrasOf, type Category, type Extras } from "./ProductExtras";
import { submitWith, useAction, useSave } from "./useAction";

type Currency = "USD" | "LBP";
type Variant = { id: string; optionValues: string[]; sku: string | null; priceMinor: number; available: number; reserved: number; archived: boolean };
type Product = {
  id: string;
  name: string;
  description: string | null;
  status: "ACTIVE" | "ARCHIVED";
  options: string[];
  variants: Variant[];
  images: { id: string; url: string; optionValue: string | null }[];
} & Parameters<typeof extrasOf>[0];
type Movement = { id: string; delta: number; reason: "RESERVE" | "RELEASE" | "SHIP" | "RESTOCK" | "ADJUST"; note: string | null; at: string };
type Common = { currency: Currency; locale: Locale; m: CatalogueMessages; t: CommonMessages };

export function ProductEditor({ product, categories, ...c }: { product: Product; categories: Category[] } & Common) {
  const { m, t } = c;
  const details = useSave(t.error);
  const archive = useAction(t.error);
  const archived = product.status === "ARCHIVED";
  const values = [...new Set(product.variants.flatMap((v) => v.optionValues).filter(Boolean))];

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      {archived && <Alert tone="warning">{m.archivedNotice}</Alert>}

      <Card>
        <form
          key={`${product.name}|${product.description}`}
          {...details.form}
          onSubmit={submitWith((f) =>
            details.save(() =>
              api(`/api/products/${product.id}`, { method: "PATCH", body: { name: f.get("name"), description: String(f.get("description") ?? "") || null } }),
            ),
          )}
          className="flex flex-col gap-4"
        >
          <CardHead title={m.details} />
          {details.error && <Alert tone="error">{details.error}</Alert>}
          <Field label={m.name}>
            <Input name="name" defaultValue={product.name} required maxLength={120} dir="auto" />
          </Field>
          <Field label={m.description} hint={t.optional}>
            <Textarea name="description" defaultValue={product.description ?? ""} maxLength={2000} dir="auto" />
          </Field>
          <SaveButton state={details} labels={t} className="self-start" />
        </form>
      </Card>

      <Photos productId={product.id} images={product.images} values={values} {...c} />

      <Options product={product} {...c} />

      <Card className="flex flex-col gap-3">
        <CardHead title={m.variants} hint={product.options.length ? m.variantsHint : m.variantsHintNone} />
        {product.variants.map((v) => (
          <VariantCard key={v.id} variant={v} options={product.options} {...c} />
        ))}
        {product.options.length > 0 && <AddVariant key={product.options.join("|")} productId={product.id} options={product.options} {...c} />}
      </Card>

      <StorefrontExtras product={product} categories={categories} {...c} />

      <div className="flex flex-col gap-2 border-t border-sl-border pt-4">
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

type OptionRow = { name: string; from: string | null };
const rowsOf = (options: string[]): OptionRow[] => options.map((name) => ({ name, from: name }));

/** Option names. Each row remembers which current option it was, so a rename keeps every value. */
function Options({ product, m, t }: { product: Product } & Common) {
  const [rows, setRows] = useState(() => rowsOf(product.options));
  // After a save (or a change in another tab) the rows start again from the saved names.
  const [saved, setSaved] = useState(JSON.stringify(product.options));
  if (saved !== JSON.stringify(product.options)) {
    setSaved(JSON.stringify(product.options));
    setRows(rowsOf(product.options));
  }
  const save = useSave(t.error, rows.map((r) => r.name.trim()));
  return (
    <Card>
      <form
        {...save.form}
        onSubmit={submitWith(() =>
          save.save(() => api(`/api/products/${product.id}/options`, { method: "PUT", body: { options: rows.map((r) => ({ ...r, name: r.name.trim() })) } })),
        )}
        className="flex flex-col gap-4"
      >
        <CardHead title={m.options} hint={`${m.optionsHint} ${m.optionsRemoveHint}`} />
        {save.error && <Alert tone="error">{save.error}</Alert>}
        <OptionsFields
          names={rows.map((r) => r.name)}
          onRename={(i, name) => setRows(rows.map((r, j) => (j === i ? { ...r, name } : r)))}
          onAdd={() => setRows([...rows, { name: "", from: null }])}
          onRemove={(i) => setRows(rows.filter((_, j) => j !== i))}
          m={m}
        />
        <SaveButton state={save} labels={t} className="self-start" />
      </form>
    </Card>
  );
}

/** Category, featured, specs and customization, saved together. */
function StorefrontExtras({ product, categories, m, t }: { product: Product; categories: Category[] } & Common) {
  const [extras, setExtras] = useState<Extras>(() => extrasOf(product));
  const save = useSave(t.error, extras);
  return (
    <form
      {...save.form}
      onSubmit={submitWith(() => save.save(() => api(`/api/products/${product.id}`, { method: "PATCH", body: extrasBody(extras) })))}
      className="flex flex-col gap-4"
    >
      <ExtrasFields value={extras} onChange={setExtras} categories={categories} m={m} />
      {save.error && <Alert tone="error">{save.error}</Alert>}
      <SaveButton state={save} labels={t} className="self-start" />
    </form>
  );
}

function VariantCard({ variant: v, options, currency, locale, m, t }: { variant: Variant; options: string[] } & Common) {
  const edit = useSave(t.error);
  const stock = useAction(t.error);
  const [history, setHistory] = useState<Movement[] | null>(null);
  const [stockDone, setStockDone] = useState(false);
  const label = v.optionValues.filter(Boolean).join(" / ") || m.noOptions;
  const loadHistory = async () => setHistory(await api<Movement[]>(`/api/variants/${v.id}/movements`));

  return (
    <section aria-label={label} className={cx("flex flex-col gap-3 rounded-sl border p-3", v.archived ? "border-dashed border-sl-control bg-sl-panel" : "border-sl-border bg-sl-bg")}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-bold">{label}</h3>
        <Badge tone={v.available > 0 ? "green" : "red"}>{fill(m.available, { n: v.available })}</Badge>
        {v.reserved > 0 && <Badge tone="amber">{fill(m.reserved, { n: v.reserved })}</Badge>}
        {v.archived && <Badge>{m.hidden}</Badge>}
      </div>

      <form
        key={JSON.stringify([options, v.optionValues, v.sku, v.priceMinor])}
        {...edit.form}
        onSubmit={submitWith((f) =>
          edit.save(() =>
            api(`/api/variants/${v.id}`, {
              method: "PATCH",
              body: { optionValues: f.getAll("value").map(String), sku: f.get("sku"), price: String(f.get("price")).trim() },
            }),
          ),
        )}
        className="flex flex-col gap-3"
      >
        {edit.error && <Alert tone="error">{edit.error}</Alert>}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {options.map((name, i) => (
            <Field key={i} label={name}>
              <Input name="value" defaultValue={v.optionValues[i] ?? ""} maxLength={40} dir="auto" />
            </Field>
          ))}
          <Field label={fill(m.price, { currency })}>
            <Input name="price" defaultValue={toAmountText(v.priceMinor, currency)} required dir="ltr" inputMode="decimal" />
          </Field>
          <Field label={m.sku}>
            <Input name="sku" defaultValue={v.sku ?? ""} maxLength={40} />
          </Field>
        </div>
        <div className="flex flex-wrap gap-2">
          <SaveButton state={edit} labels={t} tone="secondary">
            {m.saveVariant}
          </SaveButton>
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
        className="flex flex-col gap-3 border-t border-sl-border pt-3"
      >
        <h4 className="text-sm font-bold">{m.adjustStock}</h4>
        {stock.error && <Alert tone="error">{stock.error}</Alert>}
        {stockDone && <Alert tone="success">{m.stockUpdated}</Alert>}
        <div className="grid grid-cols-[7rem_1fr] gap-3">
          <Field label={m.delta}>
            <Input name="delta" type="number" dir="ltr" required min={-100000} max={100000} step={1} inputMode="numeric" />
          </Field>
          <Field label={m.note} hint={t.optional}>
            <Input name="note" maxLength={200} placeholder={m.notePlaceholder} />
          </Field>
        </div>
        <p className="-mt-1 text-xs text-sl-muted">{m.deltaHint}</p>
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
        <ul className="divide-y divide-sl-border text-sm">
          {history.length === 0 && <li className="py-2 text-sl-muted">{m.noMovements}</li>}
          {history.map((h) => (
            <li key={h.id} className="flex items-start justify-between gap-3 py-2">
              <div className="min-w-0">
                <p>{m[`reason${h.reason}`]}</p>
                {h.note && <p className="break-words text-sl-muted">{h.note}</p>}
                <p className="text-xs text-sl-muted">{formatDateTime(h.at, locale)}</p>
              </div>
              <span dir="ltr" className={cx("font-bold tabular-nums", h.delta > 0 ? "text-sl-ok" : "text-sl-danger")}>
                {h.delta > 0 ? `+${h.delta}` : h.delta}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AddVariant({ productId, options, currency, m, t }: { productId: string; options: string[] } & Common) {
  const [draft, setDraft] = useState<VariantDraft | null>(null);
  const add = useAction(t.error);

  if (!draft) {
    return (
      <Button tone="secondary" className="self-start" onClick={() => setDraft(blankVariant(options))}>
        <Icon name="plus" />
        {m.addVariant}
      </Button>
    );
  }
  return (
    <form
      onSubmit={submitWith(async () => {
        if (await add.run(() => api(`/api/products/${productId}/variants`, { body: variantBody(draft) }))) setDraft(null);
      })}
      className="flex flex-col gap-3 rounded-sl border border-dashed border-sl-control p-3"
    >
      <h3 className="font-bold">{m.addVariant}</h3>
      {add.error && <Alert tone="error">{add.error}</Alert>}
      <VariantFields value={draft} onChange={setDraft} options={options} currency={currency} m={m} />
      <div className="flex gap-2">
        <Button type="submit" disabled={add.busy}>
          {add.busy ? t.saving : t.add}
        </Button>
        <Button tone="ghost" onClick={() => setDraft(null)}>
          {t.cancel}
        </Button>
      </div>
    </form>
  );
}

function Photos({ productId, images, values, m, t }: { productId: string; images: Product["images"]; values: string[] } & Common) {
  const action = useAction(t.error);
  const [value, setValue] = useState("");

  async function upload(file: File) {
    const form = new FormData();
    form.set("file", file);
    if (value) form.set("optionValue", value);
    await action.run(() => api(`/api/products/${productId}/images`, { body: form }));
  }

  return (
    <Card className="flex flex-col gap-3">
      <CardHead title={m.photos} hint={m.photosHint} />
      {action.error && <Alert tone="error">{action.error}</Alert>}
      {images.length === 0 ? (
        <p className="text-sm text-sl-muted">{m.noPhotos}</p>
      ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {images.map((img) => (
            <li key={img.id} className="relative overflow-hidden rounded-sl-sm border border-sl-border bg-sl-cat">
              {/* eslint-disable-next-line @next/next/no-img-element -- uploaded files are served as-is */}
              <img src={img.url} alt="" className="aspect-square w-full object-cover" />
              {img.optionValue && <Badge className="absolute bottom-1 start-1">{img.optionValue}</Badge>}
              <IconButton
                label={m.deletePhoto}
                icon={<Icon name="x" className="size-4" />}
                disabled={action.busy}
                onClick={() => confirm(m.deletePhotoConfirm) && action.run(() => api(`/api/products/${productId}/images/${img.id}`, { method: "DELETE" }))}
                className="absolute end-1 top-1 rounded-full bg-sl-panel/90"
              />
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        {values.length > 0 && (
          <Field label={m.photoOption} className="sm:w-56">
            <Select value={value} onChange={(e) => setValue(e.target.value)}>
              <option value="">{m.anyOption}</option>
              {values.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <FilePicker busy={action.busy} onFile={upload}>
          {action.busy ? m.uploading : m.addPhoto}
        </FilePicker>
      </div>
    </Card>
  );
}
