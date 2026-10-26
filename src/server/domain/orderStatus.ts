// The order board's rules: which moves are allowed and what each does to stock.
export const ORDER_STATUSES = [
  "NEW",
  "CONFIRMED",
  "PACKED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
  "RETURNED",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const STATUS_LABELS: Record<OrderStatus, string> = {
  NEW: "New",
  CONFIRMED: "Confirmed",
  PACKED: "Packed",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  RETURNED: "Returned",
};

/** Address and notes can change until the parcel leaves the shop. */
export function isEditable(status: OrderStatus): boolean {
  return status === "NEW" || status === "CONFIRMED" || status === "PACKED";
}

const NEXT: Record<OrderStatus, readonly OrderStatus[]> = {
  NEW: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PACKED", "CANCELLED"],
  PACKED: ["OUT_FOR_DELIVERY", "CANCELLED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "RETURNED"],
  DELIVERED: [],
  CANCELLED: [],
  RETURNED: [],
};

export function allowedNext(from: OrderStatus): readonly OrderStatus[] {
  return NEXT[from];
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return NEXT[from].includes(to);
}

export function isFinal(status: OrderStatus): boolean {
  return NEXT[status].length === 0;
}

/**
 * What a transition does to the variant counters, per unit ordered.
 * Placing the order already moved stock from available to reserved.
 */
export type StockEffect =
  | { reason: "SHIP"; available: 0; reserved: -1 }
  | { reason: "RELEASE"; available: 1; reserved: -1 }
  | { reason: "RESTOCK"; available: 1; reserved: 0 };

export function stockEffect(to: OrderStatus): StockEffect | null {
  switch (to) {
    case "OUT_FOR_DELIVERY":
      return { reason: "SHIP", available: 0, reserved: -1 };
    case "CANCELLED":
      return { reason: "RELEASE", available: 1, reserved: -1 };
    case "RETURNED":
      return { reason: "RESTOCK", available: 1, reserved: 0 };
    default:
      return null;
  }
}

/**
 * The StockMovement delta for an effect: units back into available stock are
 * positive, units leaving the shop with the courier are negative.
 */
export function movementDelta(effect: StockEffect, qty: number): number {
  return (effect.available !== 0 ? effect.available : effect.reserved) * qty;
}
