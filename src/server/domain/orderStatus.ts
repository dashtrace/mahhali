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
