import { db, type Db } from "./tx";

const withUserAndCourier = {
  user: { select: { id: true, name: true, email: true } },
  courier: { select: { id: true, name: true } },
} as const;

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

  list(shopId: string, client: Db = db) {
    return client.membership.findMany({ where: { shopId }, include: withUserAndCourier, orderBy: { createdAt: "asc" } });
  },

  findById(shopId: string, id: string, client: Db = db) {
    return client.membership.findFirst({ where: { id, shopId }, include: withUserAndCourier });
  },

  async update(shopId: string, id: string, data: { role: string; courierId: string | null }, client: Db = db) {
    const { count } = await client.membership.updateMany({ where: { id, shopId }, data });
    return count === 1;
  },

  /** Removes access; sessions parked on this shop fall back to the user's other shops. */
  async remove(tx: Db, shopId: string, id: string, userId: string) {
    const { count } = await tx.membership.deleteMany({ where: { id, shopId, userId } });
    await tx.session.updateMany({ where: { userId, activeShopId: shopId }, data: { activeShopId: null } });
    return count === 1;
  },

  async isMember(shopId: string, email: string, client: Db = db) {
    return (await client.membership.count({ where: { shopId, user: { email } } })) > 0;
  },

  async courierExists(shopId: string, courierId: string, client: Db = db) {
    return (await client.courier.count({ where: { id: courierId, shopId } })) > 0;
  },

  /** Every shop the user belongs to. Keyed by user, not shop: it is the user's own list. */
  listForUser(userId: string, client: Db = db) {
    return client.membership.findMany({
      where: { userId },
      include: { shop: { select: { id: true, name: true, slug: true, logo: true, suspended: true } } },
      orderBy: { createdAt: "asc" },
    });
  },

  /** Points one session of userId at shopId, so withRoute resolves that membership. */
  setActiveShop(userId: string, sessionToken: string, shopId: string, client: Db = db) {
    return client.session.updateMany({ where: { token: sessionToken, userId }, data: { activeShopId: shopId } });
  },
};
