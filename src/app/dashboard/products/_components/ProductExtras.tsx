"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Button, Card, Field, IconButton, Input, Select, Textarea, Toggle } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { fill } from "@/i18n/locale";
import type { CatalogueMessages } from "@/i18n/messages/catalogue";

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

/** A card title with an optional one-line explanation. */
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

export function ExtrasFields({ value: x, onChange, categories, m }: { value: Extras; onChange: (x: Extras) => void; categories: Category[]; m: CatalogueMessages }) {
  const set = (patch: Partial<Extras>) => onChange({ ...x, ...patch });
  const setSpec = (i: number, patch: Partial<Spec>) => set({ specs: x.specs.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const max = Number(x.customMaxLength) || 240;

  return (
    <>
      <Card className="flex flex-col gap-3">
        <CardHead
          title={m.organise}
          action={
            <Link href="/dashboard/products/categories" className="inline-flex min-h-11 items-center text-sm font-bold text-sl-accent hover:underline">
              {m.categoriesTitle}
            </Link>
          }
        />
        <Field label={m.category}>
          <Select value={x.categoryId} onChange={(e) => set({ categoryId: e.target.value })}>
            <option value="">{m.noCategory}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Toggle label={m.featured} hint={m.featuredHint} checked={x.featured} onChange={(e) => set({ featured: e.target.checked })} />
      </Card>

      <Card className="flex flex-col gap-3">
        <CardHead title={m.specsTitle} hint={fill(m.specsHint, { max: MAX_SPECS })} />
        {x.specs.length === 0 ? (
          <p className="text-sm text-sl-muted">{m.noSpecs}</p>
        ) : (
          <ol className="flex flex-col gap-2">
            <li aria-hidden className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)_2.75rem] gap-2 text-[13px] font-bold">
              <span>{m.specLabel}</span>
              <span>{m.specValue}</span>
            </li>
            {x.specs.map((s, i) => {
              const row = fill(m.specN, { n: i + 1 });
              const filled = !!(s.label.trim() || s.value.trim());
              return (
                <li key={i} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)_2.75rem] items-center gap-2">
                  <Input aria-label={`${row}: ${m.specLabel}`} value={s.label} onChange={(e) => setSpec(i, { label: e.target.value })} maxLength={40} required={filled} placeholder={m.specLabelPlaceholder} />
                  <Input aria-label={`${row}: ${m.specValue}`} value={s.value} onChange={(e) => setSpec(i, { value: e.target.value })} maxLength={200} required={filled} placeholder={m.specValuePlaceholder} />
                  <IconButton label={fill(m.removeSpec, { n: i + 1 })} icon="x" onClick={() => set({ specs: x.specs.filter((_, j) => j !== i) })} />
                </li>
              );
            })}
          </ol>
        )}
        <Button tone="secondary" className="self-start" disabled={x.specs.length >= MAX_SPECS} onClick={() => set({ specs: [...x.specs, { label: "", value: "" }] })}>
          <Icon name="plus" />
          {m.addSpec}
        </Button>
      </Card>

      <Card className="flex flex-col gap-3">
        <CardHead title={m.customTitle} hint={m.customHint} />
        <Toggle label={m.customEnable} checked={x.custom} onChange={(e) => set({ custom: e.target.checked })} />
        {x.custom && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={m.customLabel}>
                <Input value={x.customLabel} onChange={(e) => set({ customLabel: e.target.value })} required maxLength={80} placeholder={m.customLabelPlaceholder} />
              </Field>
              <Field label={m.customPlaceholder} hint={m.customPlaceholderHint}>
                <Input value={x.customPlaceholder} onChange={(e) => set({ customPlaceholder: e.target.value })} maxLength={120} />
              </Field>
              <Field label={m.customMaxLength}>
                <Input
                  type="number"
                  dir="ltr"
                  inputMode="numeric"
                  min={1}
                  max={500}
                  required
                  value={x.customMaxLength}
                  onChange={(e) => set({ customMaxLength: e.target.value })}
                />
              </Field>
              <Toggle label={m.customRequired} hint={m.customRequiredHint} checked={x.customRequired} onChange={(e) => set({ customRequired: e.target.checked })} className="sm:self-end" />
            </div>
            {/* What the product page will show, drawn with the same controls. */}
            <div className="rounded-sl border border-sl-border bg-sl-bg p-3">
              <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.15em] text-sl-muted rtl:tracking-normal">{m.customPreview}</p>
              <Field label={x.customLabel || m.customLabelPlaceholder} hint={`0/${max}`}>
                <Textarea disabled placeholder={x.customPlaceholder} className="min-h-16" />
              </Field>
            </div>
          </>
        )}
      </Card>
    </>
  );
}
