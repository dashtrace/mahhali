import { db, type Db } from "./tx";

// No-login links for adding photos to one confirmed import's products.
export const photoLinkRepo = {
  /** One link per import: a new one replaces the old, which stops working. */
  replace(shopId: string, importId: string, createdById: string, tokenHash: string, expiresAt: Date, client: Db = db) {
    return client.importPhotoLink.upsert({
      where: { importId },
      create: { shopId, importId, createdById, tokenHash, expiresAt },
      update: { createdById, tokenHash, expiresAt, createdAt: new Date() },
    });
  },

  /** By the hash of the token in the link (the link itself is the key, as for tracking and review links). */
  findByTokenHash(tokenHash: string, client: Db = db) {
    return client.importPhotoLink.findUnique({
      where: { tokenHash },
      include: { import: { select: { status: true } }, shop: { select: { id: true, name: true, suspended: true } } },
    });
  },
};
