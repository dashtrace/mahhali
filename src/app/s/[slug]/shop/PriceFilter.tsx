"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { Icon } from "@/components/Icon";
import { Button, Field, Input } from "@/components/ui";
import { fill, type Locale } from "@/i18n/locale";
import { storeMessages } from "@/i18n/messages/store";
import { filterHref, parsePriceRange, type BrowseFilters } from "../_components/browse";

/**
 * The "Price: …" toggle and its inline min/max form. Applying keeps the search,
 * category and collection, and goes back to page 1.
 */
export function PriceFilter({
  slug,
  currency,
  locale,
  filters,
  min,
  max,
  summary,
}: {
  slug: string;
  currency: "USD" | "LBP";
  locale: Locale;
  /** The filters in the URL; the price bounds are replaced, the rest carried over. */
  filters: BrowseFilters;
  /** The current bounds as typed in the URL, "" when unset. */
  min: string;
  max: string;
  summary: string;
}) {
  const m = storeMessages[locale];
  const router = useRouter();
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = !!(min || max);
  const symbol = currency === "USD" ? "$" : "LBP";

  function apply(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const lo = String(f.get("min") ?? "").trim();
    const hi = String(f.get("max") ?? "").trim();
    // A number box reads "" for text it cannot parse; that is an error, not "no bound".
    const unreadable = ["min", "max"].some((n) => (form.elements.namedItem(n) as HTMLInputElement).validity.badInput);
    if (unreadable || !parsePriceRange(lo, hi, currency)) {
      setError(currency === "USD" ? m.priceError : m.priceErrorWhole);
      return;
    }
    setError(null);
    setOpen(false);
    router.push(filterHref(slug, filters, { min: lo, max: hi }));
  }

  function reset() {
    setError(null);
    setOpen(false);
    router.push(filterHref(slug, filters, { min: undefined, max: undefined }));
  }

  return (
    <div className="sl-price">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(!open)} data-active={active || undefined} className="sl-price-trigger">
          <span aria-hidden>☷</span>
          <bdi>{fill(m.priceToggle, { summary })}</bdi>
          <span aria-hidden className="sl-price-chevron">
            ⌄
          </span>
        </button>
        {active && (
          <span className="inline-flex flex-wrap items-center gap-2 text-xs text-sl-muted">
            {m.priceActive}
            <Link href={filterHref(slug, filters, { min: undefined, max: undefined })} aria-label={m.clearPriceLabel} className="inline-flex min-h-11 items-center gap-1 px-1 text-[13px] font-bold text-sl-accent">
              {m.clearPrice}
              <Icon name="x" className="size-3.5" />
            </Link>
          </span>
        )}
      </div>

      {open && (
        <form id={panelId} onSubmit={apply} noValidate aria-labelledby={`${panelId}-title`} className="sl-price-panel">
          <h2 id={`${panelId}-title`}>{m.priceTitle}</h2>
          <p>{m.priceHelp}</p>
          <div className="sl-price-inputs">
            {(["min", "max"] as const).map((k) => (
              <Field key={k} label={fill(k === "min" ? m.priceMin : m.priceMax, { cur: symbol })}>
                <Input
                  name={k}
                  type="number"
                  min={0}
                  step={currency === "USD" ? 0.01 : 1}
                  inputMode={currency === "USD" ? "decimal" : "numeric"}
                  dir="ltr"
                  defaultValue={k === "min" ? min : max}
                  placeholder={k === "min" ? m.noMin : m.noMax}
                  aria-invalid={!!error}
                />
              </Field>
            ))}
          </div>
          {error && (
            <p role="alert" className="sl-price-error">
              {error}
            </p>
          )}
          <div className="sl-price-actions">
            <Button tone="secondary" onClick={reset}>
              {m.priceReset}
            </Button>
            <Button type="submit">{m.priceApply}</Button>
          </div>
        </form>
      )}
    </div>
  );
}
