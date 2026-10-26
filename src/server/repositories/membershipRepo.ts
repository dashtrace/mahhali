import { db, type Db } from "./tx";

export const membershipRepo = {
  /**
   * The membership a signed-in user acts through: the session's active shop if
   * set, otherwise their oldest membership.
   */
  findActive(userId: string, activeShopId: string | null | undefined, client: Db = db) {
    return client.membership.findFirst({
      where: { userId, ...(activeShopId ? { shopId: activeShopId } : {}) },
      orderBy: { createdAt: "asc" },
      include: { shop: { select: { id: true, slug: true, name: true, currency: true, suspended: true } } },
    });
  },

  create(input: { shopId: string; userId: string; role: string; courierId?: string | null }, client: Db = db) {
    return client.membership.create({ data: { id: crypto.randomUUID(), ...input } });
  },
};
