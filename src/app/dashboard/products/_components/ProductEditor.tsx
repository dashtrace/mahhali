"use client";

import { useRef, useState } from "react";
import { Alert, PageHeader } from "@/components/ui";
import { fill, type Locale } from "@/i18n/locale";
import type { CatalogueMessages } from "@/i18n/messages/catalogue";
import type { CommonMessages } from "@/i18n/messages/common";
import { api } from "@/lib/api";
import { formatDateTime, toAmountText } from "@/lib/format";
import { DashIcon } from "../../_components/DashIcon";
import { OptionsFields, OptionsIntro, SkuField, VariantFields, blankVariant, variantBody, type VariantDraft } from "./CreateProductForm";
import { BackLink, Check, Dialog, Field, Steps } from "./kit";
import { ExtrasFields, extrasBody, extrasOf, type Category, type Extras } from "./ProductExtras";
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
type Step = "basics" | "options" | "photos" | "display" | "inventory";

const variantLabel = (v: Variant, m: CatalogueMessages) => v.optionValues.filter(Boolean).join(" / ") || m.noOptions;

export function ProductEditor({
  product,
  categories,
  canAdjust,
  initialStep,
  created,
  ...c
}: { product: Product; categories: Category[]; canAdjust: boolean; initialStep?: string; created: boolean } & Common) {
  const { m } = c;
  const items: [Step, string][] = [
    ["basics", m.stepBasics],
    ["options", m.stepOptions],
    ["photos", m.stepPhotos],
    ["display", m.stepDisplay],
    ...(canAdjust ? ([["inventory", m.stepInventory]] as [Step, string][]) : []),
  ];
  const [step, setStep] = useState<Step>(items.find(([k]) => k === initialStep)?.[0] ?? "basics");
  const [notice, setNotice] = useState<string | null>(null);
  const go = (next: Step, message: string | null = null) => {
    setStep(next);
    setNotice(message);
  };
  const archived = product.status === "ARCHIVED";
  const live = product.variants.filter((v) => !v.archived);
  const available = live.reduce((n, v) => n + v.available, 0);
  const reserved = live.reduce((n, v) => n + v.reserved, 0);
  const categoryName = categories.find((x) => x.id === product.categoryId)?.name;

  return (
    <>
      <BackLink href="/dashboard/products">{m.backToProducts}</BackLink>
      <PageHeader
        title={product.name}
        subtitle={[fill(m.available, { n: available }), fill(m.reserved, { n: reserved }), categoryName].filter(Boolean).join(" · ")}
        actions={
          canAdjust && (
            <button type="button" className="btn primary" onClick={() => go("inventory")}>
              <DashIcon name="box" size="sm" />
              {m.adjustStock}
            </button>
          )
        }
      />
      {archived && <Alert tone="warning" className="mb-4">{m.archivedNotice}</Alert>}
      {created && <Alert tone="success" className="mb-4">{m.createdNotice}</Alert>}

      <div className="stock-action between">
        <div className="min-w-0">
          <h2>{m.glanceTitle}</h2>
          <div className="number">{fill(m.available, { n: available })}</div>
          <p className="hint">{fill(m.glanceSub, { reserved, total: available + reserved })}</p>
        </div>
        {canAdjust && (
          <button type="button" className="btn shrink-0" onClick={() => go("inventory")}>
            {m.updateStock}
            <DashIcon name="arrow" size="sm" />
          </button>
        )}
      </div>

      <Steps items={items} current={step} onPick={(k) => go(k)} />

      <div className="card max-w-[860px]">
        {notice && (
          <p role="status" className="info-inline mb-[15px]">
            <DashIcon name="check" size="sm" /> {notice}
          </p>
        )}
        {/* Steps stay mounted, so an unsaved edit survives moving between them. */}
        <div hidden={step !== "basics"}>
          <Basics product={product} onDone={(saved) => go("options", saved ? m.basicsSaved : null)} {...c} />
        </div>
        <div hidden={step !== "options"}>
          <OptionsStep product={product} onDone={() => go("photos")} {...c} />
        </div>
        <div hidden={step !== "photos"}>
          <Photos product={product} onDone={() => go("display")} {...c} />
        </div>
        <div hidden={step !== "display"}>
          <Display product={product} categories={categories} onSaved={() => setNotice(m.appearanceSaved)} {...c} />
        </div>
        {canAdjust && (
          <div hidden={step !== "inventory"}>
            <Inventory product={product} available={available} reserved={reserved} {...c} />
          </div>
        )}
      </div>
    </>
  );
}

function Basics({ product, onDone, m, t }: { product: Product; onDone: (saved: boolean) => void } & Common) {
  const details = useSave(t.error);
  return (
    <form
      key={`${product.name}|${product.description}`}
      {...details.form}
      onSubmit={submitWith(async (f) => {
        if (!details.dirty) return onDone(false);
        const ok = await details.save(() => api(`/api/products/${product.id}`, { method: "PATCH", body: { name: f.get("name"), description: String(f.get("description") ?? "") || null } }));
        if (ok) onDone(true);
      })}
    >
      <h2>{m.basicsTitle}</h2>
      <p className="hint">{m.basicsHint}</p>
      {details.error && <Alert tone="error" className="mb-4">{details.error}</Alert>}
      <Field label={m.nameRequired}>
        <input className="control" name="name" defaultValue={product.name} required maxLength={120} placeholder={m.namePlaceholder} dir="auto" />
      </Field>
      <Field label={m.descriptionOptional}>
        <textarea className="control area" name="description" defaultValue={product.description ?? ""} maxLength={2000} placeholder={m.descriptionPlaceholder} dir="auto" />
      </Field>
      <button type="submit" className="btn primary" disabled={details.busy}>
        {details.busy ? t.saving : m.saveBasics}
        <DashIcon name="arrow" size="sm" />
      </button>
    </form>
  );
}

type OptionRow = { name: string; from: string | null };
const rowsOf = (options: string[]): OptionRow[] => options.map((name) => ({ name, from: name }));

function OptionsStep({ product, onDone, ...c }: { product: Product; onDone: () => void } & Common) {
  const { m } = c;
  const panel = useRef<HTMLDivElement>(null);
  const [unsaved, setUnsaved] = useState(false);
  return (
    <div ref={panel}>
      <OptionNames product={product} {...c} />
      <hr className="separator" />
      <h3>{m.variants}</h3>
      <p className="hint">{product.options.length ? m.variantsHint : m.variantsHintNone}</p>
      {product.variants.map((v) => (
        <VariantRow key={v.id} variant={v} options={product.options} only={product.variants.length === 1} {...c} />
      ))}
      {product.options.length > 0 && <AddVariant key={product.options.join("|")} productId={product.id} options={product.options} {...c} />}
      {unsaved && (
        <p role="status" className="callout">
          {m.unsavedChanges}
        </p>
      )}
      <div className={product.options.length > 0 ? "mt-4" : ""}>
        <button
          type="button"
          className="btn primary"
          onClick={() => {
            // Options and variants each save on their own; don't let an edit look saved by moving on.
            const dirty = !!panel.current?.querySelector('form[data-dirty="true"]');
            setUnsaved(dirty);
            if (!dirty) onDone();
          }}
        >
          {m.continue}
          <DashIcon name="arrow" size="sm" />
        </button>
      </div>
    </div>
  );
}

/** Option names. Each row remembers which current option it was, so a rename keeps every value. */
function OptionNames({ product, m, t }: { product: Product } & Common) {
  const [rows, setRows] = useState(() => rowsOf(product.options));
  // After a save (or a change in another tab) the rows start again from the saved names.
  const [saved, setSaved] = useState(JSON.stringify(product.options));
  if (saved !== JSON.stringify(product.options)) {
    setSaved(JSON.stringify(product.options));
    setRows(rowsOf(product.options));
  }
  const save = useSave(t.error, rows.map((r) => r.name.trim()));
  const inUse = (from: string | null) => {
    const i = from === null ? -1 : product.options.indexOf(from);
    return i < 0 ? [] : [...new Set(product.variants.map((v) => v.optionValues[i]).filter(Boolean))];
  };
  return (
    <form
      {...save.form}
      data-dirty={save.dirty}
      onSubmit={submitWith(() => save.save(() => api(`/api/products/${product.id}/options`, { method: "PUT", body: { options: rows.map((r) => ({ ...r, name: r.name.trim() })) } })))}
    >
      <OptionsIntro extra={m.optionsRemoveHint} m={m} />
      {save.error && <Alert tone="error" className="mb-4">{save.error}</Alert>}
      <OptionsFields
        names={rows.map((r) => r.name)}
        values={rows.map((r) => inUse(r.from))}
        onRename={(i, name) => setRows(rows.map((r, j) => (j === i ? { ...r, name } : r)))}
        onAdd={() => setRows([...rows, { name: "", from: null }])}
        onRemove={(i) => setRows(rows.filter((_, j) => j !== i))}
        m={m}
      />
      {(save.dirty || save.busy || save.saved) && (
        <button type="submit" className="btn primary ms-2 mt-2" disabled={save.busy || !save.dirty}>
          {save.busy ? t.saving : save.saved ? t.saved : m.saveOptions}
        </button>
      )}
    </form>
  );
}

/** One variant; a product's only variant sits flat in the step, with no card or heading of its own. */
function VariantRow({ variant: v, options, only, currency, m, t }: { variant: Variant; options: string[]; only: boolean } & Common) {
  const edit = useSave(t.error);
  // Hiding the only variant would empty the product; Archive on the Display step does that properly.
  const canHide = !only || v.archived;
  return (
    <section aria-label={variantLabel(v, m)} className={only ? "" : `inner-card mb-3 ${v.archived ? "border-dashed" : ""}`}>
      {!only && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h3 className="m-0">{variantLabel(v, m)}</h3>
          {v.reserved > 0 && <span className="mini-badge amber">{fill(m.reserved, { n: v.reserved })}</span>}
          {v.archived && <span className="mini-badge gray">{m.hidden}</span>}
        </div>
      )}
      <form
        key={JSON.stringify([options, v.optionValues, v.sku, v.priceMinor])}
        {...edit.form}
        data-dirty={edit.dirty}
        onSubmit={submitWith((f) =>
          edit.save(() =>
            api(`/api/variants/${v.id}`, {
              method: "PATCH",
              body: { optionValues: f.getAll("value").map(String), sku: f.get("sku"), price: String(f.get("price")).trim() },
            }),
          ),
        )}
      >
        {edit.error && <Alert tone="error" className="mb-3">{edit.error}</Alert>}
        <div className="split3">
          {options.map((name, i) => (
            <Field key={i} label={name}>
              <input className="control" name="value" defaultValue={v.optionValues[i] ?? ""} maxLength={40} dir="auto" />
            </Field>
          ))}
          <Field label={fill(m.priceRequired, { currency })}>
            <input className="control" name="price" defaultValue={toAmountText(v.priceMinor, currency)} required dir="ltr" inputMode="decimal" />
          </Field>
          {/* Read-only: stock changes go through the Inventory step, so each one keeps its reason and history. */}
          <Field label={m.stock}>
            <input className="control" readOnly tabIndex={-1} value={v.available} dir="ltr" />
          </Field>
          <SkuField name="sku" defaultValue={v.sku ?? ""} m={m} />
        </div>
        {(canHide || edit.dirty || edit.busy || edit.saved) && (
          <div className={`actions ${only ? "mb-4" : ""}`}>
            {(edit.dirty || edit.busy || edit.saved) && (
              <button type="submit" className="btn" disabled={edit.busy || !edit.dirty}>
                {edit.busy ? t.saving : edit.saved ? t.saved : m.saveVariant}
              </button>
            )}
            {canHide && (
              <button type="button" className="btn tiny" disabled={edit.busy} onClick={() => edit.run(() => api(`/api/variants/${v.id}`, { method: "PATCH", body: { archived: !v.archived } }))}>
                {v.archived ? m.showVariant : m.hideVariant}
              </button>
            )}
          </div>
        )}
      </form>
    </section>
  );
}

function AddVariant({ productId, options, currency, m, t }: { productId: string; options: string[] } & Common) {
  const [draft, setDraft] = useState<VariantDraft | null>(null);
  const add = useAction(t.error);

  if (!draft) {
    return (
      <button type="button" className="btn soft" onClick={() => setDraft(blankVariant(options))}>
        <DashIcon name="plus" size="sm" />
        {m.addVariant}
      </button>
    );
  }
  return (
    <form
      data-dirty="true"
      onSubmit={submitWith(async () => {
        if (await add.run(() => api(`/api/products/${productId}/variants`, { body: variantBody(draft) }))) setDraft(null);
      })}
      className="inner-card border-dashed"
    >
      <h3>{m.addVariant}</h3>
      {add.error && <Alert tone="error" className="mb-3">{add.error}</Alert>}
      <VariantFields value={draft} onChange={setDraft} options={options} currency={currency} m={m} />
      <div className="actions">
        <button type="submit" className="btn primary" disabled={add.busy}>
          {add.busy ? t.saving : t.add}
        </button>
        <button type="button" className="btn" onClick={() => setDraft(null)}>
          {t.cancel}
        </button>
      </div>
    </form>
  );
}

function Photos({ product, onDone, m, t }: { product: Product; onDone: () => void } & Common) {
  const action = useAction(t.error);
  const [value, setValue] = useState("");
  const values = [...new Set(product.variants.flatMap((v) => v.optionValues).filter(Boolean))];
  const images = product.images;

  async function upload(file: File) {
    const form = new FormData();
    form.set("file", file);
    if (value) form.set("optionValue", value);
    await action.run(() => api(`/api/products/${product.id}/images`, { body: form }));
  }

  return (
    <>
      <h2>{m.photosTitle}</h2>
      <p className="hint">{m.photosIntro}</p>
      {action.error && <Alert tone="error" className="mb-4">{action.error}</Alert>}
      {images.length === 0 ? (
        <p className="empty mb-5">{m.noPhotos}</p>
      ) : (
        <div className="mb-5 flex flex-wrap items-center gap-[9px]">
          {images.map((img) => (
            <div key={img.id} className="thumb">
              {/* eslint-disable-next-line @next/next/no-img-element -- uploaded files are served as-is */}
              <img src={img.url} alt="" />
              {img.optionValue && <span className="mini-badge absolute start-1 bottom-1">{img.optionValue}</span>}
              <button
                type="button"
                className="btn tiny absolute end-1 top-1 px-2"
                aria-label={m.deletePhoto}
                disabled={action.busy}
                onClick={() => confirm(m.deletePhotoConfirm) && action.run(() => api(`/api/products/${product.id}/images/${img.id}`, { method: "DELETE" }))}
              >
                <DashIcon name="x" size="tiny" />
              </button>
            </div>
          ))}
          <div className="min-w-40 flex-1">
            <b>{m.currentPhotos}</b>
            <p className="hint mb-0">{fill(m.currentPhotosN, { n: images.length })}</p>
          </div>
        </div>
      )}
      {values.length > 0 && (
        <Field label={m.photoOption}>
          <select className="control" value={value} onChange={(e) => setValue(e.target.value)}>
            <option value="">{m.anyOption}</option>
            {values.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field label={action.busy ? m.uploading : m.uploadPhoto}>
        <input
          className="control"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={action.busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) upload(file);
          }}
        />
      </Field>
      <button type="button" className="btn primary" onClick={onDone}>
        {m.continue}
        <DashIcon name="arrow" size="sm" />
      </button>
    </>
  );
}

/** Category, featured, specs and customization saved together; archive and restore underneath. */
function Display({ product, categories, onSaved, m, t }: { product: Product; categories: Category[]; onSaved: () => void } & Common) {
  const [extras, setExtras] = useState<Extras>(() => extrasOf(product));
  const save = useSave(t.error, extras);
  const archive = useAction(t.error);
  const [confirming, setConfirming] = useState(false);
  const archived = product.status === "ARCHIVED";
  const toggle = async () => {
    const ok = await archive.run(() => (archived ? api(`/api/products/${product.id}`, { method: "PATCH", body: { status: "ACTIVE" } }) : api(`/api/products/${product.id}`, { method: "DELETE" })));
    if (ok) setConfirming(false);
  };

  return (
    <>
      <form
        {...save.form}
        onSubmit={submitWith(async () => {
          if (!save.dirty || (await save.save(() => api(`/api/products/${product.id}`, { method: "PATCH", body: extrasBody(extras) })))) onSaved();
        })}
      >
        <ExtrasFields
          value={extras}
          onChange={setExtras}
          categories={categories}
          visibility={<Check label={m.showInShop} hint={m.showInShopHint} checked={!archived} onChange={() => setConfirming(true)} />}
          m={m}
        />
        {save.error && <Alert tone="error" className="mb-4">{save.error}</Alert>}
        <button type="submit" className="btn primary" disabled={save.busy}>
          {save.busy ? t.saving : m.saveAppearance}
        </button>
      </form>

      <div className="callout">
        <b>{m.archiveProduct}</b>
        <br />
        {m.archiveCopy}
      </div>
      {archive.error && <Alert tone="error" className="mb-3">{archive.error}</Alert>}
      <button type="button" className="btn warn" disabled={archive.busy} onClick={() => setConfirming(true)}>
        <DashIcon name="archive" size="sm" />
        {archived ? m.restoreProduct : m.archiveHide}
      </button>
      {confirming && (
        <Dialog title={fill(archived ? m.restoreTitle : m.archiveTitle, { name: product.name })} closeLabel={t.close} onClose={() => setConfirming(false)}>
          <p className="hint">{archived ? m.restoreConfirm : m.archiveConfirm}</p>
          {archive.error && <Alert tone="error" className="mb-3">{archive.error}</Alert>}
          <div className="actions">
            <button type="button" className={`btn ${archived ? "primary" : "warn"}`} disabled={archive.busy} onClick={toggle}>
              {archived ? m.restoreProduct : m.archiveYes}
            </button>
            <button type="button" className="btn" onClick={() => setConfirming(false)}>
              {t.cancel}
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}

function Inventory({ product, available, reserved, ...c }: { product: Product; available: number; reserved: number } & Common) {
  const { m } = c;
  return (
    <>
      <h2 className="flex items-center gap-2">
        <DashIcon name="box" />
        {m.stockTitle}
      </h2>
      <p className="hint">{m.stockIntro}</p>
      <div className="split3">
        <div className="stat">
          <div className="eyebrow">{m.statAvailable}</div>
          <div className="number green">{available}</div>
        </div>
        <div className="stat">
          <div className="eyebrow">{m.statReserved}</div>
          <div className="number">{reserved}</div>
        </div>
        <div className="stat">
          <div className="eyebrow">{m.statTotal}</div>
          <div className="number">{available + reserved}</div>
        </div>
      </div>
      {product.variants.map((v) => (
        <StockCard key={v.id} variant={v} single={product.variants.length === 1} {...c} />
      ))}
    </>
  );
}

function StockCard({ variant: v, single, locale, m, t }: { variant: Variant; single: boolean } & Common) {
  const stock = useAction(t.error);
  const [history, setHistory] = useState<Movement[] | null>(null);
  const [done, setDone] = useState(false);
  const label = variantLabel(v, m);
  const loadHistory = async () => setHistory(await api<Movement[]>(`/api/variants/${v.id}/movements`));
  const details = useRef<HTMLDetailsElement>(null);

  return (
    <section aria-label={label} className="mt-4">
      <form
        className="inner-card"
        onSubmit={submitWith(async (f, form) => {
          setDone(false);
          // The API stores one free-text note, so the chosen reason leads it.
          const note = [String(f.get("reason") ?? ""), String(f.get("note") ?? "").trim()].filter(Boolean).join(": ");
          const ok = await stock.run(() => api(`/api/variants/${v.id}/stock-adjustments`, { body: { delta: Number(f.get("delta")), note: note || null } }));
          setDone(ok);
          if (!ok) return;
          form.reset();
          if (history) await loadHistory().catch(() => {});
        })}
      >
        <h3>{single ? m.adjustStock : `${m.adjustStock} · ${label}`}</h3>
        {!single && (
          <p className="hint">
            {fill(m.available, { n: v.available })} · {fill(m.reserved, { n: v.reserved })}
            {v.archived && ` · ${m.hidden}`}
          </p>
        )}
        {stock.error && <Alert tone="error" className="mb-3">{stock.error}</Alert>}
        {done && <Alert tone="success" className="mb-3">{m.stockUpdated}</Alert>}
        <div className="split">
          <Field label={m.delta} hint={m.deltaHint}>
            <input
              className="control"
              name="delta"
              type="number"
              dir="ltr"
              required
              min={-100000}
              max={100000}
              step={1}
              inputMode="numeric"
              placeholder="+10 / -3"
              onChange={(e) => e.target.setCustomValidity(e.target.value !== "" && Number(e.target.value) === 0 ? m.deltaNonZero : "")}
            />
          </Field>
          <Field label={m.reason}>
            <select className="control" name="reason" defaultValue={m.reasonShipment}>
              <option value={m.reasonShipment}>{m.reasonShipment}</option>
              <option value={m.reasonRecount}>{m.reasonRecount}</option>
              <option value={m.reasonDamaged}>{m.reasonDamaged}</option>
              <option value="">{m.reasonOther}</option>
            </select>
          </Field>
        </div>
        <Field label={m.noteOptional}>
          {/* The API's limit is 200, and the longest reason plus its separator takes the rest. */}
          <input className="control" name="note" maxLength={175} placeholder={m.notePlaceholder} dir="auto" />
        </Field>
        <button type="submit" className="btn primary" disabled={stock.busy}>
          {m.apply}
        </button>
      </form>

      <details
        ref={details}
        className="mt-5"
        onToggle={() => {
          if (details.current?.open && !history) loadHistory().catch(() => setHistory([]));
        }}
      >
        <summary className="bold cursor-pointer">{m.history}</summary>
        {history && (
          <div className="line-list mt-2">
            {history.length === 0 && <div className="line-item hint">{m.noMovements}</div>}
            {history.map((h) => (
              <div key={h.id} className="line-item">
                <div className="min-w-0">
                  <div>{m[`reason${h.reason}`]}</div>
                  {h.note && <div className="hint break-words">{h.note}</div>}
                  <div className="hint">{formatDateTime(h.at, locale)}</div>
                </div>
                <span dir="ltr" className={`bold tabular-nums ${h.delta > 0 ? "text-sl-ok" : "text-sl-danger"}`}>
                  {h.delta > 0 ? `+${h.delta}` : h.delta}
                </span>
              </div>
            ))}
          </div>
        )}
      </details>
    </section>
  );
}
