import { db, type Db } from "./tx";

export const invitationRepo = {
  listPending(shopId: string, client: Db = db) {
    return client.invitation.findMany({
      where: { shopId, status: "pending" },
      select: { id: true, email: true, role: true, expiresAt: true, createdAt: true, courier: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });
  },

  /** Creates the invite, replacing any pending one for the same email. */
  async replace(
    tx: Db,
    shopId: string,
    input: { id: string; email: string; role: string; courierId: string | null; inviterId: string; expiresAt: Date },
  ) {
    await tx.invitation.deleteMany({ where: { shopId, email: input.email, status: "pending" } });
    return tx.invitation.create({ data: { ...input, shopId } });
  },

  async revoke(shopId: string, id: string, client: Db = db) {
    const { count } = await client.invitation.deleteMany({ where: { id, shopId, status: "pending" } });
    return count === 1;
  },

  /** Public lookup by link: the id is the hash of the emailed token, which is what names the shop. */
  findById(id: string, client: Db = db) {
    return client.invitation.findUnique({ where: { id }, include: { shop: { select: { name: true, slug: true } } } });
  },

  /** Pending -> accepted exactly once; a second or concurrent use matches no row. */
  async markAccepted(tx: Db, shopId: string, id: string, now: Date) {
    const { count } = await tx.invitation.updateMany({
      where: { id, shopId, status: "pending", expiresAt: { gt: now } },
      data: { status: "accepted" },
    });
    return count === 1;
  },

  findUserByEmail(email: string, client: Db = db) {
    return client.user.findUnique({ where: { email }, select: { id: true } });
  },
};
