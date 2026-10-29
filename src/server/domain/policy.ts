// What each shop role may do. The single source of truth for authorisation;
// withRoute checks it before any handler runs.
export const SHOP_ROLES = ["owner", "manager", "staff", "delivery"] as const;
export type ShopRole = (typeof SHOP_ROLES)[number];

export function isShopRole(value: unknown): value is ShopRole {
  return typeof value === "string" && (SHOP_ROLES as readonly string[]).includes(value);
}

const ALL: readonly ShopRole[] = SHOP_ROLES;
const DESK: readonly ShopRole[] = ["owner", "manager", "staff"];
const MANAGERS: readonly ShopRole[] = ["owner", "manager"];
const OWNER: readonly ShopRole[] = ["owner"];

const MATRIX = {
  "order.read": DESK,
  "order.readAssigned": ALL,
  "order.create": DESK,
  "order.transition": DESK,
  "order.assignCourier": DESK,
  "order.markDelivered": ALL,
  "product.read": DESK,
  "product.write": MANAGERS,
  "stock.adjust": MANAGERS,
  "courier.read": DESK,
  "courier.write": MANAGERS,
  "remittance.write": MANAGERS,
  "reconciliation.read": MANAGERS,
  "metrics.read": MANAGERS,
  "review.read": DESK,
  "review.moderate": MANAGERS,
  "shop.settings": OWNER,
  "staff.manage": OWNER,
  "billing.manage": OWNER,
} as const satisfies Record<string, readonly ShopRole[]>;

export type Action = keyof typeof MATRIX;
export const ACTIONS = Object.keys(MATRIX) as Action[];

export function can(role: ShopRole, action: Action): boolean {
  return (MATRIX[action] as readonly ShopRole[]).includes(role);
}
