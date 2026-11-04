"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type RefObject } from "react";
import { Alert } from "@/components/ui";
import { fill } from "@/i18n/locale";
import type { CatalogueMessages } from "@/i18n/messages/catalogue";
import type { CommonMessages } from "@/i18n/messages/common";
import { api, errorMessage } from "@/lib/api";
import { DashIcon } from "../../_components/DashIcon";
import { Field, Steps } from "./kit";
import { ExtrasFields, blankExtras, extrasBody, type Category, type Extras } from "./ProductExtras";
import { submitWith } from "./useAction";

type Currency = "USD" | "LBP";
export type VariantDraft = { optionValues: string[]; sku: string; price: string; stock: string };
export const blankVariant = (options: string[]): VariantDraft => ({ optionValues: options.map(() => ""), sku: "", price: "", stock: "0" });

/** The API body for one variant row. */
export const variantBody = (v: VariantDraft) => ({ optionValues: v.optionValues, sku: v.sku, price: v.price.trim(), stock: Number(v.stock) || 0 });

/** The h2, hint and info box that open the Options step. */
export function OptionsIntro({ extra, m }: { extra?: string; m: CatalogueMessages }) {
  return (
    <>
      <h2>{m.optionsTitle}</h2>
      <p className="hint">{m.optionsHint}</p>
      <div className="info-inline mb-[15px]">
        <DashIcon name="info" size="sm" /> {m.optionsInfo} {extra}
      </div>
    </>
  );
}

/** The product's option names (at most 3), each with its values in use and a remove button. */
export function OptionsFields({
  names,
  values,
  onRename,
  onAdd,
  onRemove,
  m,
}: {
  names: string[];
  /** Per option, the values its variants use; there's no separate list of possible values. */
  values: string[][];
  onRename: (i: number, name: string) => void;
  onAdd: () => void;
  onRemove: (i: number) => void;
  m: CatalogueMessages;
}) {
  return (
    <>
      {names.map((name, i) => (
        <div key={i} className="inner-card mb-3">
          <div className="split">
            <Field label={fill(m.optionN, { n: i + 1 })}>
              <input className="control" value={name} onChange={(e) => onRename(i, e.target.value)} required maxLength={40} placeholder={m.optionPlaceholder} dir="auto" />
            </Field>
            <Field label={m.valuesInUse}>
              <input className="control" readOnly tabIndex={-1} value={values[i]?.join(", ") ?? ""} placeholder={m.valuesInUseEmpty} dir="auto" />
            </Field>
          </div>
          <button type="button" className="btn tiny warn" onClick={() => onRemove(i)}>
            {m.removeOption}
          </button>
        </div>
      ))}
      {names.length < 3 && (
        <button type="button" className="btn soft" onClick={onAdd}>
          <DashIcon name="plus" size="sm" />
          {names.length ? m.addAnotherOption : m.addOption}
        </button>
      )}
    </>
  );
}

/** The SKU field with its inline explanation. Optional, as the API treats it. */
export function SkuField({ value, defaultValue, onChange, name, m }: { value?: string; defaultValue?: string; onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void; name?: string; m: CatalogueMessages }) {
  return (
    <Field
      label={
        <>
          {m.skuLabel} <DashIcon name="info" size="tiny" />
        </>
      }
      hint={m.skuHint}
    >
      <input className="control" name={name} value={value} defaultValue={defaultValue} onChange={onChange} maxLength={40} placeholder={m.skuPlaceholder} dir="ltr" />
    </Field>
  );
}

/** One value per option, then price, opening stock and SKU for one variant. */
export function VariantFields({
  value,
  onChange,
  options,
  currency,
  m,
}: {
  value: VariantDraft;
  onChange: (v: VariantDraft) => void;
  options: string[];
  currency: Currency;
  m: CatalogueMessages;
}) {
  const set = (k: Exclude<keyof VariantDraft, "optionValues">) => (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...value, [k]: e.target.value });
  return (
    <div className="split3">
      {options.map((name, i) => (
        <Field key={i} label={name || fill(m.optionN, { n: i + 1 })}>
          <input
            className="control"
            value={value.optionValues[i] ?? ""}
            onChange={(e) => onChange({ ...value, optionValues: options.map((_, j) => (j === i ? e.target.value : (value.optionValues[j] ?? ""))) })}
            maxLength={40}
            dir="auto"
          />
        </Field>
      ))}
      <Field label={fill(m.priceRequired, { currency })}>
        <input className="control" value={value.price} onChange={set("price")} required dir="ltr" inputMode="decimal" pattern={currency === "USD" ? "\\d+(\\.\\d{1,2})?" : "\\d+"} placeholder={currency === "USD" ? "60.00" : "500000"} />
      </Field>
      <Field label={m.stock}>
        <input className="control" value={value.stock} onChange={set("stock")} type="number" dir="ltr" min={0} max={100000} inputMode="numeric" placeholder="0" />
      </Field>
      <SkuField value={value.sku} onChange={set("sku")} m={m} />
    </div>
  );
}

type Step = "basics" | "options" | "photos" | "display";

export function CreateProductForm({ currency, categories, m, t }: { currency: Currency; categories: Category[]; m: CatalogueMessages; t: CommonMessages }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("basics");
  const [options, setOptions] = useState<string[]>([]);
  const [rows, setRows] = useState<VariantDraft[]>([blankVariant([])]);
  // Adding or removing an option adds or removes that value in every row, so rows stay in step.
  const values = (f: (v: string[]) => string[]) => setRows(rows.map((r) => ({ ...r, optionValues: f(r.optionValues) })));
  const [extras, setExtras] = useState<Extras>(blankExtras);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Every step stays mounted, so its values and its browser validation survive moving between steps.
  const basics = useRef<HTMLFormElement>(null);
  const optionsForm = useRef<HTMLFormElement>(null);
  const display = useRef<HTMLFormElement>(null);

  async function create() {
    const steps: [Step, RefObject<HTMLFormElement | null>][] = [["basics", basics], ["options", optionsForm], ["display", display]];
    for (const [key, ref] of steps) {
      if (ref.current?.checkValidity()) continue;
      setStep(key);
      requestAnimationFrame(() => ref.current?.reportValidity());
      return;
    }
    const form = new FormData(basics.current!);
    setPending(true);
    setError(null);
    try {
      const product = await api<{ id: string }>("/api/products", {
        body: {
          name: form.get("name"),
          description: String(form.get("description") ?? "") || null,
          options: options.map((o) => o.trim()),
          variants: rows.map(variantBody),
          ...extrasBody(extras),
        },
      });
      router.push(`/dashboard/products/${product.id}?step=photos&created=1`);
    } catch (e) {
      setError(errorMessage(e, t.error));
      setPending(false);
    }
  }

  const createButton = (
    <button type="submit" className="btn primary" disabled={pending}>
      {pending ? m.creating : m.createAndPhotos}
      <DashIcon name="arrow" size="sm" />
    </button>
  );

  return (
    <>
      <Steps
        items={[
          ["basics", m.stepBasics],
          ["options", m.stepOptions],
          ["photos", m.stepPhotos],
          ["display", m.stepDisplay],
        ]}
        current={step}
        onPick={setStep}
      />
      <div className="card max-w-[860px]">
        {error && <Alert tone="error" className="mb-4">{error}</Alert>}

        <form ref={basics} hidden={step !== "basics"} onSubmit={submitWith(() => setStep("options"))}>
          <h2>{m.basicsTitle}</h2>
          <p className="hint">{m.basicsHint}</p>
          <Field label={m.nameRequired}>
            <input className="control" name="name" required maxLength={120} placeholder={m.namePlaceholder} dir="auto" />
          </Field>
          <Field label={m.descriptionOptional}>
            <textarea className="control area" name="description" maxLength={2000} placeholder={m.descriptionPlaceholder} dir="auto" />
          </Field>
          <button type="submit" className="btn primary">
            {m.continueToOptions}
            <DashIcon name="arrow" size="sm" />
          </button>
        </form>

        <form ref={optionsForm} hidden={step !== "options"} onSubmit={submitWith(create)}>
          <OptionsIntro m={m} />
          <OptionsFields
            names={options}
            values={options.map((_, i) => [...new Set(rows.map((r) => r.optionValues[i]?.trim()).filter(Boolean))])}
            onRename={(i, name) => setOptions(options.map((o, j) => (j === i ? name : o)))}
            onAdd={() => {
              setOptions([...options, ""]);
              values((v) => [...v, ""]);
            }}
            onRemove={(i) => {
              setOptions(options.filter((_, j) => j !== i));
              values((v) => v.filter((_, j) => j !== i));
            }}
            m={m}
          />
          <hr className="separator" />
          <h3>{m.variants}</h3>
          <p className="hint">{options.length ? m.variantsHint : m.variantsHintNone}</p>
          {rows.map((row, i) => (
            <fieldset key={i} className="inner-card mb-3">
              <legend className="sr-only">{fill(m.variantN, { n: i + 1 })}</legend>
              {rows.length > 1 && (
                <div className="between mb-3">
                  <b aria-hidden>{fill(m.variantN, { n: i + 1 })}</b>
                  <button type="button" className="btn tiny warn" onClick={() => setRows(rows.filter((_, j) => j !== i))}>
                    {m.removeVariant}
                  </button>
                </div>
              )}
              <VariantFields value={row} onChange={(v) => setRows(rows.map((r, j) => (j === i ? v : r)))} options={options} currency={currency} m={m} />
            </fieldset>
          ))}
          {/* Without options a second variant would be the same as the first. */}
          {options.length > 0 && (
            <button type="button" className="btn soft mb-4" onClick={() => setRows([...rows, { ...blankVariant(options), price: rows.at(-1)?.price ?? "" }])}>
              <DashIcon name="plus" size="sm" />
              {m.addVariant}
            </button>
          )}
          <p className="hint">{m.createExplain}</p>
          {createButton}
        </form>

        <form hidden={step !== "photos"} onSubmit={submitWith(create)}>
          <h2>{m.photosTitle}</h2>
          <p className="hint">{m.photosIntro}</p>
          <div className="info-inline mb-[15px]">
            <DashIcon name="info" size="sm" /> {m.photosAfterCreate}
          </div>
          {createButton}
        </form>

        <form ref={display} hidden={step !== "display"} onSubmit={submitWith(create)}>
          <ExtrasFields value={extras} onChange={setExtras} categories={categories} m={m} />
          <p className="hint">{m.createExplain}</p>
          {createButton}
        </form>
      </div>
    </>
  );
}
