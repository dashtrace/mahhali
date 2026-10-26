// Subscription plans shown on the pricing page. Shop.plan holds the id.
export const PLANS = {
  free: { id: "free", name: "Free", priceLabel: "$0", monthlyOrderLimit: 50 },
  pro: { id: "pro", name: "Pro", priceLabel: "$19/month", monthlyOrderLimit: null },
} as const;

export type PlanId = keyof typeof PLANS;

/** Orders a shop may take per calendar month; null means unlimited. Unknown plans get the free limit. */
export function orderLimit(plan: string): number | null {
  return plan === "pro" ? PLANS.pro.monthlyOrderLimit : PLANS.free.monthlyOrderLimit;
}
