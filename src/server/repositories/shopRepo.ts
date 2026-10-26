import { Prisma } from "@prisma/client";
import { db, type Db } from "./tx";
import type { Currency } from "../domain/money";

export const shopRepo = {
  findById(id: string, client: Db = db) {
    return client.shop.findUnique({ where: { id } });
  },

  findBySlug(slug: string, client: Db = db) {
    return client.shop.findUnique({ where: { slug } });
  },

  async slugTaken(slug: string, client: Db = db) {
    return (await client.shop.count({ where: { slug } })) > 0;
  },

  /** Creates the shop and makes userId its owner, in the caller's transaction. */
  async createWithOwner(
    tx: Db,
    input: { id: string; name: string; slug: string; currency: Currency; usdLbpRate?: string; userId: string },
  ) {
    const shop = await tx.shop.create({
      data: {
        id: input.id,
        name: input.name,
        slug: input.slug,
        currency: input.currency,
        usdLbpRate: input.usdLbpRate ? new Prisma.Decimal(input.usdLbpRate) : null,
      },
    });
    await tx.membership.create({
      data: { id: crypto.randomUUID(), shopId: shop.id, userId: input.userId, role: "owner" },
    });
    return shop;
  },
};
