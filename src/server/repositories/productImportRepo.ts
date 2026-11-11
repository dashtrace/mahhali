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
};
