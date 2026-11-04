"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { fill } from "@/i18n/locale";
import type { CatalogueMessages } from "@/i18n/messages/catalogue";
import { DashIcon } from "../../_components/DashIcon";
import { Check, Field } from "./kit";

// The storefront side of a product: category, featured flag, specification rows
// and the customer note ("customization"). Shared by the create form and the editor.

type Spec = { label: string; value: string };
export type Extras = {
  categoryId: string;
  featured: boolean;
  specs: Spec[];
  custom: boolean;
  customLabel: string;
  customPlaceholder: string;
  customRequired: boolean;
  customMaxLength: string;
};
export type Category = { id: string; name: string };

const MAX_SPECS = 12;

export const blankExtras: Extras = {
  categoryId: "",
  featured: false,
  specs: [],
  custom: false,
  customLabel: "",
  customPlaceholder: "",
  customRequired: false,
  customMaxLength: "240",
};

/** The editor's starting values from a product row (specs arrive as untyped JSON). */
export function extrasOf(p: {
  categoryId: string | null;
  featured: boolean;
  specs: unknown;
  customLabel: string | null;
  customPlaceholder: string | null;
  customRequired: boolean;
  customMaxLength: number;
}): Extras {
  return {
    categoryId: p.categoryId ?? "",
    featured: p.featured,
    specs: Array.isArray(p.specs) ? (p.specs as Spec[]) : [],
    custom: p.customLabel !== null,
    customLabel: p.customLabel ?? "",
    customPlaceholder: p.customPlaceholder ?? "",
    customRequired: p.customRequired,
    customMaxLength: String(p.customMaxLength),
  };
}

/** The API fields; a null customLabel turns customization off. Empty spec rows are dropped. */
export function extrasBody(x: Extras) {
  return {
    categoryId: x.categoryId || null,
    featured: x.featured,
    specs: x.specs.map((s) => ({ label: s.label.trim(), value: s.value.trim() })).filter((s) => s.label || s.value),
    customLabel: x.custom ? x.customLabel.trim() || null : null,
    customPlaceholder: x.custom ? x.customPlaceholder.trim() || null : null,
    customRequired: x.custom && x.customRequired,
    customMaxLength: Number(x.customMaxLength) || 240,
  };
}

/** A card title with an optional one-line explanation. Also used by the settings forms. */
export function CardHead({ title, hint, action }: { title: ReactNode; hint?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="sl-heading text-lg leading-tight">{title}</h2>
        {hint && <p className="mt-0.5 text-sm leading-normal text-sl-muted">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

/** The Display step: `visibility` is the editor's show-in-shop line; a product not yet created is always active. */
export function ExtrasFields({ value: x, onChange, categories, visibility, m }: { value: Extras; onChange: (x: Extras) => void; categories: Category[]; visibility?: ReactNode; m: CatalogueMessages }) {
  const set = (patch: Partial<Extras>) => onChange({ ...x, ...patch });
  const setSpec = (i: number, patch: Partial<Spec>) => set({ specs: x.specs.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const max = Number(x.customMaxLength) || 240;

  return (
    <>
      <h2>{m.displayTitle}</h2>
      <Field
        label={m.category}
        hint={
          <Link href="/dashboard/products/categories" className="font-bold text-sl-accent hover:underline">
            {m.manageCategories}
          </Link>
        }
      >
        <select className="control" value={x.categoryId} onChange={(e) => set({ categoryId: e.target.value })}>
          <option value="">{m.noCategory}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      {visibility}
      <Check label={m.featureOn} hint={m.featuredHint} checked={x.featured} onChange={(e) => set({ featured: e.target.checked })} />

      <h3>{m.specsTitle}</h3>
      <p className="hint">{fill(m.specsHint, { max: MAX_SPECS })}</p>
      {x.specs.map((s, i) => {
        const filled = !!(s.label.trim() || s.value.trim());
        return (
          <div key={i} className="flex items-start gap-2">
            <div className="split min-w-0 flex-1">
              <Field label={m.specLabel}>
                <input className="control" value={s.label} onChange={(e) => setSpec(i, { label: e.target.value })} maxLength={40} required={filled} placeholder={m.specLabelPlaceholder} dir="auto" />
              </Field>
              <Field label={m.specValue}>
                <input className="control" value={s.value} onChange={(e) => setSpec(i, { value: e.target.value })} maxLength={200} required={filled} placeholder={m.specValuePlaceholder} dir="auto" />
              </Field>
            </div>
            <button type="button" className="btn tiny mt-[30px] shrink-0" aria-label={fill(m.removeSpec, { n: i + 1 })} onClick={() => set({ specs: x.specs.filter((_, j) => j !== i) })}>
              <DashIcon name="x" size="sm" />
            </button>
          </div>
        );
      })}
      <button type="button" className="btn tiny" disabled={x.specs.length >= MAX_SPECS} onClick={() => set({ specs: [...x.specs, { label: "", value: "" }] })}>
        <DashIcon name="plus" size="sm" />
        {m.addSpec}
      </button>
      <hr className="separator" />

      <label className="flex items-center gap-[9px]">
        <input type="checkbox" className="size-4 shrink-0" checked={x.custom} onChange={(e) => set({ custom: e.target.checked })} />
        {m.customEnable}
      </label>
      <p className="hint">{m.customHint}</p>
      {x.custom && (
        <div className="inner-card">
          <div className="split">
            <Field label={m.customLabel}>
              <input className="control" value={x.customLabel} onChange={(e) => set({ customLabel: e.target.value })} required maxLength={80} placeholder={m.customLabelPlaceholder} dir="auto" />
            </Field>
            <Field label={m.customPlaceholder} hint={m.customPlaceholderHint}>
              <input className="control" value={x.customPlaceholder} onChange={(e) => set({ customPlaceholder: e.target.value })} maxLength={120} dir="auto" />
            </Field>
            <Field label={m.customMaxLength}>
              <input className="control" type="number" dir="ltr" inputMode="numeric" min={1} max={500} required value={x.customMaxLength} onChange={(e) => set({ customMaxLength: e.target.value })} />
            </Field>
            <Check label={m.customRequired} hint={m.customRequiredHint} checked={x.customRequired} onChange={(e) => set({ customRequired: e.target.checked })} />
          </div>
          {/* What the product page will show, drawn with the same controls. */}
          <p className="eyebrow mb-2">{m.customPreview}</p>
          <Field label={x.customLabel || m.customLabelPlaceholder} hint={`0/${max}`} className="mb-0">
            <textarea className="control area" disabled placeholder={x.customPlaceholder} />
          </Field>
        </div>
      )}
      <hr className="separator" />
    </>
  );
}
