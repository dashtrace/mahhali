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

/** Storefront fields of a product; undefined leaves a field as it is. */
export type ProductFields = {
  categoryId?: string | null;
  featured?: boolean;
  specs?: { label: string; value: string }[];
  customLabel?: string | null;
  customPlaceholder?: string | null;
  customRequired?: boolean;
  customMaxLength?: number;
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
    input: { name: string; description: string | null; variants: VariantInput[] } & ProductFields,
    actorUserId: string,
  ) {
    const { variants, ...fields } = input;
    const product = await tx.product.create({
      data: {
        ...fields,
        shopId,
        variants: { create: variants.map((v) => ({ ...v, shopId })) },
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
    data: { name?: string; description?: string | null; status?: "ACTIVE" | "ARCHIVED" } & ProductFields,
    client: Db = db,
  ) {
    const { count } = await client.product.updateMany({ where: { id, shopId }, data });
    return count === 1;
  },

  /** The public catalogue: active products with their live variants, by shop slug. */
  catalogue(shopId: string, client: Db = db) {
    return client.product.findMany({
      where: { shopId, status: "ACTIVE", variants: { some: { archived: false } } },
      include: { ...withVariants, variants: { ...withVariants.variants, where: { archived: false } } },
      // id breaks createdAt ties so listing pages never repeat or skip a product.
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
  },

  /** Units sold per product: order lines of every order that was not cancelled or returned. */
  async soldCounts(shopId: string, client: Db = db) {
    const rows = await client.$queryRaw<{ productId: string; sold: bigint }[]>`
      SELECT v."productId", SUM(oi.qty)::bigint AS sold
      FROM "order_item" oi
      JOIN "variant" v ON v.id = oi."variantId" AND v."shopId" = ${shopId}
      JOIN "orders" o ON o.id = oi."orderId" AND o."shopId" = ${shopId}
      WHERE oi."shopId" = ${shopId} AND o.status NOT IN ('CANCELLED', 'RETURNED')
      GROUP BY v."productId"`;
    return new Map(rows.map((r) => [r.productId, Number(r.sold)]));
  },

  async addVariant(tx: Db, shopId: string, productId: string, input: VariantInput, actorUserId: string) {
    const variant = await tx.variant.create({ data: { ...input, shopId, productId } });
    if (variant.available > 0) {
      await tx.stockMovement.create({
        data: { shopId, variantId: variant.id, delta: variant.available, reason: "ADJUST", actorUserId },
      });
    }
    return variant;
  },

  /** A variant with the size and colour of its siblings, for duplicate checks. */
  findVariant(shopId: string, id: string, client: Db = db) {
    return client.variant.findFirst({
      where: { id, shopId },
      include: { product: { select: { variants: { select: { id: true, size: true, colour: true } } } } },
    });
  },

  async updateVariant(
    shopId: string,
    id: string,
    data: { size?: string | null; colour?: string | null; sku?: string | null; priceMinor?: bigint; archived?: boolean },
    client: Db = db,
  ) {
    const { count } = await client.variant.updateMany({ where: { id, shopId }, data });
    return count === 1 ? client.variant.findFirst({ where: { id, shopId } }) : null;
  },

  /**
   * Adds delta to available stock and logs it, in the caller's transaction.
   * The conditional update cannot take stock below zero; null when it would.
   */
  async adjustStock(tx: Db, shopId: string, id: string, delta: number, note: string | null, actorUserId: string) {
    const { count } = await tx.variant.updateMany({
      where: { id, shopId, ...(delta < 0 ? { available: { gte: -delta } } : {}) },
      data: { available: { increment: delta } },
    });
    if (count === 0) return null;
    await tx.stockMovement.create({ data: { shopId, variantId: id, delta, reason: "ADJUST", note, actorUserId } });
    return tx.variant.findFirst({ where: { id, shopId } });
  },

  /** A variant's stock history, newest first. */
  movements(shopId: string, variantId: string, client: Db = db) {
    // shortcut: last 200 only; add paging if a variant ever needs more history on screen.
    return client.stockMovement.findMany({
      where: { shopId, variantId },
      orderBy: [{ at: "desc" }, { id: "desc" }],
      take: 200,
    });
  },

  async addImage(shopId: string, productId: string, input: { url: string; colour: string | null }, client: Db = db) {
    const { _max } = await client.productImage.aggregate({ where: { shopId, productId }, _max: { position: true } });
    return client.productImage.create({
      data: { shopId, productId, ...input, position: (_max.position ?? -1) + 1 },
    });
  },

  findImage(shopId: string, productId: string, id: string, client: Db = db) {
    return client.productImage.findFirst({ where: { id, productId, shopId } });
  },

  async deleteImage(shopId: string, id: string, client: Db = db) {
    const { count } = await client.productImage.deleteMany({ where: { id, shopId } });
    return count === 1;
  },
};
