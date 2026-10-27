"use client";

import Link from "next/link";
import { useState } from "react";
import { Alert, Button, cx } from "@/components/ui";
import type { Locale } from "@/i18n/locale";
import type { StoreMessages } from "@/i18n/messages/store";
import { formatMoney } from "@/lib/format";
import { MAX_QTY, useCart } from "../../../../_storefront/cart";
import type { CatalogueProduct } from "../../../../_storefront/data";

type Variant = CatalogueProduct["variants"][number];
type Props = { slug: string; variants: Variant[]; currency: "USD" | "LBP"; locale: Locale; m: StoreMessages };

const uniq = (values: (string | null)[]) => [...new Set(values.filter((v): v is string => !!v))];

/** Size and colour pickers, quantity and add to cart. Sold-out options stay visible but marked. */
export function VariantPicker({ slug, variants, currency, locale, m }: Props) {
  const start = variants.find((v) => v.inStock) ?? variants[0];
  const [size, setSize] = useState(start?.size ?? null);
  const [colour, setColour] = useState(start?.colour ?? null);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const { cart, save } = useCart(slug);

  const sizes = uniq(variants.map((v) => v.size));
  const colours = uniq(variants.map((v) => v.colour));
  // shortcut: assumes every variant of a product sets the same axes (all have a size, or none do).
  const variant = variants.find((v) => v.size === size && v.colour === colour);
  const inCart = variant ? (cart[variant.id] ?? 0) : 0;
  const room = MAX_QTY - inCart;

  // Picking one axis keeps the other if that combination exists, else jumps to one that does.
  function pickSize(s: string) {
    setSize(s);
    setAdded(false);
    if (!variants.some((v) => v.size === s && v.colour === colour)) {
      const next = variants.find((v) => v.size === s && v.inStock) ?? variants.find((v) => v.size === s);
      setColour(next?.colour ?? null);
    }
  }
  function pickColour(c: string) {
    setColour(c);
    setAdded(false);
    if (!variants.some((v) => v.colour === c && v.size === size)) {
      const next = variants.find((v) => v.colour === c && v.inStock) ?? variants.find((v) => v.colour === c);
      setSize(next?.size ?? null);
    }
  }

  function add() {
    if (!variant) return;
    save({ ...cart, [variant.id]: Math.min(MAX_QTY, inCart + qty) });
    setQty(1);
    setAdded(true);
  }

  const prices = variants.map((v) => v.priceMinor);
  const price = variant ? variant.priceMinor : Math.min(...prices);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-2xl font-semibold tabular-nums">{formatMoney(price, currency, locale)}</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {sizes.length > 0 && (
          <Options
            legend={m.size}
            name="size"
            values={sizes}
            selected={size}
            onSelect={pickSize}
            soldOut={(s) => !variants.some((v) => v.size === s && (colours.length === 0 || v.colour === colour) && v.inStock)}
            soldOutLabel={m.soldOutOption}
          />
        )}
        {colours.length > 0 && (
          <Options
            legend={m.colour}
            name="colour"
            values={colours}
            selected={colour}
            onSelect={pickColour}
            soldOut={(c) => !variants.some((v) => v.colour === c && (sizes.length === 0 || v.size === size) && v.inStock)}
            soldOutLabel={m.soldOutOption}
          />
        )}
      </div>

      {variant?.inStock && room > 0 && (
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium" id="qty-label">
            {m.quantity}
          </span>
          <div role="group" aria-labelledby="qty-label" className="flex items-center rounded-[var(--radius)] border border-stone-300 bg-white text-stone-900">
            <button type="button" aria-label={m.decrease} disabled={qty <= 1} onClick={() => setQty(qty - 1)} className="size-11 text-lg disabled:opacity-40">
              −
            </button>
            <span className="w-8 text-center tabular-nums" aria-live="polite">
              {qty}
            </span>
            <button type="button" aria-label={m.increase} disabled={qty >= room} onClick={() => setQty(qty + 1)} className="size-11 text-lg disabled:opacity-40">
              +
            </button>
          </div>
        </div>
      )}

      <Button block onClick={add} disabled={!variant?.inStock || room <= 0 || qty > room}>
        {!variant ? m.notAvailable : !variant.inStock ? m.outOfStock : m.addToCart}
      </Button>
      {variant?.inStock && room <= 0 && <p className="text-sm opacity-70">{m.maxInCart}</p>}
      {added && (
        <Alert tone="success" className="flex items-center justify-between gap-2">
          {m.addedToCart}
          <Link href={`/s/${slug}/cart`} className="inline-flex min-h-11 items-center font-medium underline underline-offset-4">
            {m.viewCart}
          </Link>
        </Alert>
      )}
    </div>
  );
}

function Options(props: {
  legend: string;
  name: string;
  values: string[];
  selected: string | null;
  onSelect: (value: string) => void;
  soldOut: (value: string) => boolean;
  soldOutLabel: string;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">{props.legend}</legend>
      <div className="flex flex-wrap gap-2">
        {props.values.map((value) => {
          const out = props.soldOut(value);
          return (
            <label
              key={value}
              className={cx(
                "inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-[var(--radius)] border border-stone-300 bg-white px-3 text-sm text-stone-900",
                "has-[:checked]:border-[var(--brand)] has-[:checked]:bg-[var(--brand)] has-[:checked]:text-[var(--brand-ink)]",
                "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--brand)]",
                out && "line-through opacity-60",
              )}
            >
              <input
                type="radio"
                name={props.name}
                value={value}
                checked={props.selected === value}
                onChange={() => props.onSelect(value)}
                className="sr-only"
              />
              {value}
              {out && <span className="sr-only">, {props.soldOutLabel}</span>}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
