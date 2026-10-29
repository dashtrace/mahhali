// Pure order arithmetic and labels. Money is in the order currency's minor unit.

export type PricedLine = { unitPriceMinor: bigint; qty: number };

export function orderTotals(lines: PricedLine[], deliveryFeeMinor: bigint) {
  const subtotalMinor = lines.reduce((sum, l) => sum + l.unitPriceMinor * BigInt(l.qty), 0n);
  const totalMinor = subtotalMinor + deliveryFeeMinor;
  // Everything is cash on delivery in V1, so the courier collects the total.
  return { subtotalMinor, deliveryFeeMinor, totalMinor, codMinor: totalMinor };
}

/** "Linen shirt / M / Sand": what the customer bought, frozen on the order line. */
export function itemLabel(productName: string, size: string | null, colour: string | null): string {
  return [productName, size, colour].filter(Boolean).join(" / ");
}

/** "#1042", "1042" -> 1042; anything else -> null. */
export function parseOrderNumber(input: string): number | null {
  const m = /^#?\s*(\d{1,9})$/.exec(input.trim());
  return m ? Number(m[1]) : null;
}
