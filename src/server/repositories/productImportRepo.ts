import type { ImportSource, Prisma } from "@prisma/client";
import { db, type Db } from "./tx";

// Bulk product imports: the preview a user reviews, then what it created.
// Every query takes shopId.
export const productImportRepo = {
  /** A user has one preview waiting at a time: asking for changes replaces it. */
  supersedePreviews(tx: Db, shopId: string, userId: string) {
    return tx.productImport.updateMany({ where: { shopId, userId, status: "PREVIEWED" }, data: { status: "SUPERSEDED" } });
  },

  create(
    tx: Db,
    data: {
      shopId: string;
      userId: string;
      source: ImportSource;
      rows: Prisma.InputJsonValue;
      report: Prisma.InputJsonValue;
      productCount: number;
      variantCount: number;
      expiresAt: Date;
    },
  ) {
    return tx.productImport.create({ data });
  },

  findById(shopId: string, id: string, client: Db = db) {
    return client.productImport.findFirst({ where: { id, shopId } });
  },

  /**
   * Marks the preview confirmed only if it is still waiting, unexpired and the
   * user's own. Postgres re-checks after a concurrent confirm commits, so a
   * preview is confirmed once.
   */
  async confirm(tx: Db, shopId: string, id: string, userId: string, now: Date) {
    const { count } = await tx.productImport.updateMany({
      where: { id, shopId, userId, status: "PREVIEWED", expiresAt: { gt: now } },
      data: { status: "CONFIRMED", confirmedAt: now },
    });
    return count === 1;
  },

  /** Marks a confirmed import undone if it was confirmed after `since`. */
  async undo(tx: Db, shopId: string, id: string, since: Date, now: Date) {
    const { count } = await tx.productImport.updateMany({
      where: { id, shopId, status: "CONFIRMED", confirmedAt: { gte: since } },
      data: { status: "UNDONE", undoneAt: now },
    });
    return count === 1;
  },

  /** Previews nobody confirmed in time, older than `before`. */
  deleteExpired(before: Date, client: Db = db) {
    return client.productImport.deleteMany({ where: { status: { in: ["PREVIEWED", "SUPERSEDED"] }, expiresAt: { lt: before } } });
  },
};
