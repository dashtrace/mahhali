import type { Prisma } from "@prisma/client";
import { db, type Db } from "./tx";

// Every function takes shopId and puts it in every where clause.
const withVariants = {
  variants: { orderBy: [{ size: "asc" }, { colour: "asc" }] },
  images: { orderBy: { position: "asc" } },
} satisfies Prisma.ProductInclude;

export type VariantInput = {
  size: string | null;
  colour: string | null;
  sku: string | null;
  priceMinor: bigint;
  available: number;
};

export const productRepo = {
  list(shopId: string, opts: { includeArchived?: boolean } = {}, client: Db = db) {
    return client.product.findMany({
      where: { shopId, ...(opts.includeArchived ? {} : { status: "ACTIVE" }) },
      include: withVariants,
      orderBy: { createdAt: "desc" },
    });
  },

  findById(shopId: string, id: string, client: Db = db) {
    return client.product.findFirst({ where: { id, shopId }, include: withVariants });
  },

  async create(
    tx: Db,
    shopId: string,
    input: { name: string; description: string | null; variants: VariantInput[] },
    actorUserId: string,
  ) {
    const product = await tx.product.create({
      data: {
        shopId,
        name: input.name,
        description: input.description,
        variants: { create: input.variants.map((v) => ({ ...v, shopId })) },
      },
      include: { variants: true },
    });
    const stocked = product.variants.filter((v) => v.available > 0);
    if (stocked.length > 0) {
      await tx.stockMovement.createMany({
        data: stocked.map((v) => ({
          shopId,
          variantId: v.id,
          delta: v.available,
          reason: "ADJUST" as const,
          actorUserId,
        })),
      });
    }
    return product;
  },

  async update(
    shopId: string,
    id: string,
    data: { name?: string; description?: string | null; status?: "ACTIVE" | "ARCHIVED" },
    client: Db = db,
  ) {
    const { count } = await client.product.updateMany({ where: { id, shopId }, data });
    return count === 1;
  },

  /** The public catalogue: active products with their variants, by shop slug. */
  catalogue(shopId: string, client: Db = db) {
    return client.product.findMany({
      where: { shopId, status: "ACTIVE" },
      include: withVariants,
      orderBy: { createdAt: "desc" },
    });
  },
};
