import { db, type Db } from "./tx";

export const trackingRepo = {
  /**
   * The customer's tracking view. The unguessable public token is the scope here:
   * the customer has no shop context, and every related row is read through the order.
   */
  findByPublicToken(publicToken: string, client: Db = db) {
    return client.order.findUnique({
      where: { publicToken },
      include: {
        shop: { select: { name: true, slug: true, logo: true, theme: true, language: true, whatsappPhone: true } },
        items: {
          select: {
            nameSnapshot: true,
            unitPriceMinor: true,
            qty: true,
            note: true,
            variant: { select: { product: { select: { images: { select: { url: true }, orderBy: { position: "asc" }, take: 1 } } } } },
          },
          orderBy: { id: "asc" },
        },
        events: { where: { type: "STATUS" }, select: { toValue: true, at: true }, orderBy: { at: "asc" } },
        courier: { select: { name: true } },
        reviewInvite: { select: { usedAt: true, expiresAt: true } },
      },
    });
  },

  /** The tracking token, only when the order number and phone both match. */
  async findTokenByNumberAndPhone(shopId: string, number: number, phone: string, client: Db = db) {
    const order = await client.order.findFirst({
      where: { shopId, number, customerPhone: phone },
      select: { publicToken: true },
    });
    return order?.publicToken ?? null;
  },
};
