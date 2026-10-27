"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { Icon } from "@/components/Icon";
import { Button, Field, Input, cx } from "@/components/ui";
import { fill, type Locale } from "@/i18n/locale";
import { storeMessages } from "@/i18n/messages/store";
import { parsePriceRange, shopHref } from "../_components/browse";

/**
 * The "Price: …" toggle and its inline min/max form. Applying keeps the search,
 * category and collection, and goes back to page 1.
 */
export function PriceFilter({
  slug,
  currency,
  locale,
  keep,
  min,
  max,
  summary,
}: {
  slug: string;
  currency: "USD" | "LBP";
  locale: Locale;
  /** The other filters to carry over (q, cat, sort). */
  keep: Record<string, string | undefined>;
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
    router.push(shopHref(slug, { ...keep, min: lo, max: hi }));
  }

  function reset() {
    setError(null);
    setOpen(false);
    router.push(shopHref(slug, keep));
  }

  return (
    <div className="mb-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen(!open)}
          className={cx(
            "inline-flex min-h-11 items-center gap-2 rounded-sl border bg-sl-panel px-3.5 text-[13px] font-bold text-sl-fg",
            active ? "border-sl-accent shadow-[inset_0_0_0_1px_var(--sl-accent)]" : "border-sl-border",
          )}
        >
          <Icon name="sliders" className="size-4" />
          <bdi>{fill(m.priceToggle, { summary })}</bdi>
          <Icon name="chevron" className={cx("size-4 transition-transform", open && "rotate-180")} />
        </button>
        {active && (
          <span className="inline-flex flex-wrap items-center gap-2 text-xs text-sl-muted">
            {m.priceActive}
            <Link href={shopHref(slug, keep)} aria-label={m.clearPriceLabel} className="inline-flex min-h-11 items-center gap-1 px-1 text-[13px] font-bold text-sl-accent">
              {m.clearPrice}
              <Icon name="x" className="size-3.5" />
            </Link>
          </span>
        )}
      </div>

      {open && (
        <form
          id={panelId}
          onSubmit={apply}
          noValidate
          aria-labelledby={`${panelId}-title`}
          className="mt-2 rounded-2xl border border-sl-border bg-sl-panel px-3.5 py-3.5 shadow-[0_10px_24px_#0000000d]"
        >
          <h2 id={`${panelId}-title`} className="mb-1 text-sm font-extrabold">
            {m.priceTitle}
          </h2>
          <p className="mb-3 text-xs leading-normal text-sl-muted">{m.priceHelp}</p>
          <div className="grid grid-cols-2 gap-2.5">
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
                  className="bg-sl-bg"
                />
              </Field>
            ))}
          </div>
          {error && (
            <p role="alert" className="mt-2 text-xs font-semibold text-sl-danger">
              {error}
            </p>
          )}
          <div className="mt-3 flex justify-end gap-2">
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
