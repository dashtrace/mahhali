import { db, type Db } from "./tx";

export const billingRepo = {
  /** Checkout finished: the shop is on Pro. Repeated webhooks set the same values. */
  async upgrade(shopId: string, stripe: { customerId: string; subscriptionId: string }, client: Db = db) {
    const { count } = await client.shop.updateMany({
      where: { id: shopId },
      data: { plan: "pro", stripeCustomerId: stripe.customerId, stripeSubscriptionId: stripe.subscriptionId },
    });
    return count === 1;
  },

  /** Only the shop's current subscription can downgrade it, not an older cancelled one. */
  async downgrade(shopId: string, subscriptionId: string, client: Db = db) {
    const { count } = await client.shop.updateMany({
      where: { id: shopId, stripeSubscriptionId: subscriptionId },
      data: { plan: "free", stripeSubscriptionId: null },
    });
    return count === 1;
  },
};
