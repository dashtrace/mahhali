/**
 * The product an order item came from, by its name snapshot ("Product / Option").
 * shortcut: a product renamed since the order finds nothing (no photo or category shown), return productId from the tracking and review services to fix that.
 */
export function productForItem<P extends { name: string }>(products: P[], itemName: string): P | undefined {
  return products.find((p) => p.name === itemName) ?? products.find((p) => itemName.startsWith(`${p.name} / `));
}
