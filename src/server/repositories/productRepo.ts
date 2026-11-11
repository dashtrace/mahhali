import type { Prisma } from "@prisma/client";
import { db, type Db } from "./tx";

// Every function takes shopId and puts it in every where clause.
const withVariants = {
  // cuids sort by creation time, so variants keep the order the owner added them in.
  variants: { orderBy: { id: "asc" } },
  images: { orderBy: { position: "asc" } },
} satisfies Prisma.ProductInclude;

export type VariantInput = {
  optionValues: string[];
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
  /** The bulk import that created it (undo archives by this). */
  importId?: string | null;
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

  listByImport(shopId: string, importId: string, client: Db = db) {
    return client.product.findMany({
      where: { shopId, importId },
      select: { id: true, name: true, status: true },
      orderBy: { createdAt: "asc" },
    });
  },

  archiveByImport(tx: Db, shopId: string, importId: string) {
    return tx.product.updateMany({ where: { shopId, importId }, data: { status: "ARCHIVED" } });
  },

  async create(
    tx: Db,
    shopId: string,
    input: { name: string; description: string | null; options: string[]; variants: VariantInput[] } & ProductFields,
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

  findVariant(shopId: string, id: string, client: Db = db) {
    return client.variant.findFirst({ where: { id, shopId }, include: { product: { select: { options: true } } } });
  },

  async updateVariant(
    shopId: string,
    id: string,
    data: { optionValues?: string[]; sku?: string | null; priceMinor?: bigint; archived?: boolean },
    client: Db = db,
  ) {
    const { count } = await client.variant.updateMany({ where: { id, shopId }, data });
    return count === 1 ? client.variant.findFirst({ where: { id, shopId } }) : null;
  },

  /**
   * Saves a product's option names and its variants' new values, in the caller's transaction.
   * The unique index is checked row by row, so each row first takes a value no other row holds
   * (its own id); writing the final values straight away would fail when two variants swap.
   */
  async setOptions(tx: Db, shopId: string, productId: string, options: string[], variants: { id: string; optionValues: string[] }[]) {
    await tx.product.updateMany({ where: { id: productId, shopId }, data: { options } });
    for (const v of variants) await tx.variant.updateMany({ where: { id: v.id, shopId }, data: { optionValues: [v.id] } });
    for (const v of variants) await tx.variant.updateMany({ where: { id: v.id, shopId }, data: { optionValues: v.optionValues } });
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

  async addImage(shopId: string, productId: string, input: { url: string; optionValue: string | null }, client: Db = db) {
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
