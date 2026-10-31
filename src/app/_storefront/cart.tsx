"use client";

import { useEffect, useMemo } from "react";
import { IconButtonLink } from "@/components/ui";
import { fill } from "@/i18n/locale";
import { parseJson, readRaw, useRaw, writeRaw } from "./local";

/** One cart line. The same variant with two different notes is two lines. */
export type CartLine = { variantId: string; qty: number; note?: string };

/** The order API takes 1 to 20 of each variant, summed across its lines. */
export const MAX_QTY = 20;
const MAX_NOTE = 500;

const keyOf = (slug: string) => `cart:v2:${slug}`;
const legacyKeyOf = (slug: string) => `cart:${slug}`;

const normNote = (note: unknown) => (typeof note === "string" && note.trim() ? note.trim().slice(0, MAX_NOTE) : undefined);
export const sameLine = (a: CartLine, variantId: string, note?: string) => a.variantId === variantId && a.note === normNote(note);

/** Units of a variant already in the cart, over all its lines. */
export function qtyOf(lines: CartLine[], variantId: string) {
  return lines.reduce((n, l) => (l.variantId === variantId ? n + l.qty : n), 0);
}

/** How many more units of a variant fit: up to MAX_QTY and the stock `left`, minus the cart. Negative when the cart holds more than is left. */
export function roomIn(lines: CartLine[], variantId: string, left = MAX_QTY) {
  return Math.min(MAX_QTY, left) - qtyOf(lines, variantId);
}

/** Stored JSON -> valid lines: merges duplicates, drops junk, caps each variant at MAX_QTY. */
export function parseLines(raw: unknown): CartLine[] {
  let lines: CartLine[] = [];
  if (!Array.isArray(raw)) return lines;
  for (const item of raw) {
    const { variantId, qty, note } = (item ?? {}) as Record<string, unknown>;
    if (typeof variantId === "string" && Number.isInteger(qty) && (qty as number) > 0) {
      lines = withLine(lines, { variantId, qty: qty as number, note: note as string | undefined }).lines;
    }
  }
  return lines;
}

/** The pre-v2 shape, { variantId: qty }, as lines without notes. */
export function fromLegacy(raw: unknown): CartLine[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  return parseLines(Object.entries(raw).map(([variantId, qty]) => ({ variantId, qty })));
}

/** Adds to the matching line (or a new one), as far as the variant's MAX_QTY allows. */
export function withLine(lines: CartLine[], line: CartLine): { lines: CartLine[]; added: number } {
  const note = normNote(line.note);
  const added = Math.max(0, Math.min(line.qty, MAX_QTY - qtyOf(lines, line.variantId)));
  if (added === 0) return { lines, added };
  const i = lines.findIndex((l) => sameLine(l, line.variantId, note));
  if (i === -1) return { lines: [...lines, { variantId: line.variantId, qty: added, ...(note ? { note } : {}) }], added };
  return { lines: lines.map((l, j) => (j === i ? { ...l, qty: l.qty + added } : l)), added };
}

function migrate(slug: string) {
  if (readRaw(keyOf(slug)) !== null) return;
  const legacy = readRaw(legacyKeyOf(slug));
  if (legacy === null) return;
  writeRaw(keyOf(slug), JSON.stringify(fromLegacy(parseJson(legacy))));
  writeRaw(legacyKeyOf(slug), null);
}

function current(slug: string) {
  migrate(slug);
  return parseLines(parseJson(readRaw(keyOf(slug))));
}

const save = (slug: string, lines: CartLine[]) => writeRaw(keyOf(slug), JSON.stringify(lines));

/** Adds a line; returns how many units fitted (0 when the variant is already at MAX_QTY). */
export function addToCart(slug: string, line: CartLine): number {
  const next = withLine(current(slug), line);
  if (next.added > 0) save(slug, next.lines);
  return next.added;
}

/** Sets one line's quantity (0 removes it), capped so the variant stays within MAX_QTY. */
export function setQty(slug: string, variantId: string, note: string | undefined, qty: number) {
  const lines = current(slug);
  const line = lines.find((l) => sameLine(l, variantId, note));
  if (!line) return;
  const room = MAX_QTY - (qtyOf(lines, variantId) - line.qty);
  const n = Math.min(Math.floor(qty), room);
  save(slug, n > 0 ? lines.map((l) => (l === line ? { ...l, qty: n } : l)) : lines.filter((l) => l !== line));
}

export function removeLine(slug: string, variantId: string, note?: string) {
  save(slug, current(slug).filter((l) => !sameLine(l, variantId, note)));
}

export function clearCart(slug: string) {
  writeRaw(keyOf(slug), null);
}

/** The shop's cart lines, live. Empty on the server and on first render. */
export function useCart(slug: string) {
  useEffect(() => migrate(slug), [slug]);
  const raw = useRaw(keyOf(slug));
  return useMemo(() => {
    const lines = parseLines(parseJson(raw));
    return {
      lines,
      count: lines.reduce((n, l) => n + l.qty, 0),
      /** How many more units of this variant fit, given the stock left when known. */
      roomFor: (variantId: string, left?: number) => roomIn(lines, variantId, left),
    };
  }, [raw]);
}

/** Header cart button with a count badge. `countLabel` is "Cart, {n} items". */
export function CartLink({ slug, label, countLabel, className }: { slug: string; label: string; countLabel: string; className?: string }) {
  const { count } = useCart(slug);
  return <IconButtonLink href={`/s/${slug}/cart`} icon="cart" label={count > 0 ? fill(countLabel, { n: count }) : label} count={count} className={className} />;
}
