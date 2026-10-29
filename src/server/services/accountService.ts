import { notFound } from "../http/errors";
import type { Actor } from "../http/withRoute";
import { shopRepo } from "../repositories/shopRepo";

export const accountService = {
  /** Who is signed in and the shop they act for, for the dashboard header. */
  async me(actor: Actor) {
    const shop = await shopRepo.findById(actor.shopId);
    if (!shop) throw notFound("Shop");
    return {
      userId: actor.userId,
      shopId: actor.shopId,
      role: actor.role,
      courierId: actor.courierId,
      shop: {
        id: shop.id,
        name: shop.name,
        slug: shop.slug,
        logo: shop.logo,
        theme: shop.theme,
        currency: shop.currency,
        language: shop.language,
        plan: shop.plan,
      },
    };
  },
};
