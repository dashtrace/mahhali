import type { TestimonialStatus } from "@prisma/client";
import { db, type Db } from "./tx";

// Hero slides, categories and testimonials. Every function takes shopId and
// puts it in every where clause.

/** Locks the shop row so a count-then-insert under a per-shop limit runs one at a time. */
export async function lockShop(tx: Db, shopId: string) {
  await tx.$queryRaw`SELECT id FROM "shop" WHERE id = ${shopId} FOR NO KEY UPDATE`;
}

type SlideCta = { ctaLabel?: string | null; ctaCategoryId?: string | null; ctaCollectionId?: string | null; ctaSectionId?: string | null };
const slideFields = { id: true, imageUrl: true, mobileImageUrl: true, kicker: true, title: true, body: true, ctaLabel: true, ctaCategoryId: true, ctaCollectionId: true, ctaSectionId: true, position: true } as const;

export const slideRepo = {
  list(shopId: string, client: Db = db) {
    return client.heroSlide.findMany({ where: { shopId }, select: slideFields, orderBy: [{ position: "asc" }, { createdAt: "asc" }] });
  },

  findById(shopId: string, id: string, client: Db = db) {
    return client.heroSlide.findFirst({ where: { id, shopId }, select: slideFields });
  },

  /** Appends a slide unless the shop already has `max`; null when full. */
  async create(tx: Db, shopId: string, data: { imageUrl: string; mobileImageUrl?: string | null; kicker: string | null; title: string; body: string | null } & SlideCta, max: number) {
    await lockShop(tx, shopId);
    const existing = await tx.heroSlide.aggregate({ where: { shopId }, _count: { _all: true }, _max: { position: true } });
    if (existing._count._all >= max) return null;
    return tx.heroSlide.create({ data: { ...data, shopId, position: (existing._max.position ?? -1) + 1 }, select: slideFields });
  },

  async update(shopId: string, id: string, data: { imageUrl?: string; mobileImageUrl?: string | null; kicker?: string | null; title?: string; body?: string | null } & SlideCta, client: Db = db) {
    const { count } = await client.heroSlide.updateMany({ where: { id, shopId }, data });
    return count === 1;
  },

  /** Rewrites positions 0..n-1 in the given order. */
  async setOrder(tx: Db, shopId: string, ids: string[]) {
    for (const [position, id] of ids.entries()) await tx.heroSlide.updateMany({ where: { id, shopId }, data: { position } });
  },

  async delete(shopId: string, id: string, client: Db = db) {
    const { count } = await client.heroSlide.deleteMany({ where: { id, shopId } });
    return count === 1;
  },
};

const categoryFields = { id: true, name: true, position: true } as const;

export const categoryRepo = {
  list(shopId: string, client: Db = db) {
    return client.category.findMany({
      where: { shopId },
      orderBy: [{ position: "asc" }, { name: "asc" }],
      select: {
        ...categoryFields,
        collections: {
          where: { shopId },
          orderBy: [{ position: "asc" }, { id: "asc" }],
          select: {
            id: true, name: true, position: true,
            sections: {
              where: { shopId },
              orderBy: [{ position: "asc" }, { id: "asc" }],
              select: { id: true, name: true, position: true },
            },
          },
        },
      },
    });
  },

  findById(shopId: string, id: string, client: Db = db) {
    return client.category.findFirst({ where: { id, shopId }, select: categoryFields });
  },

  /** Appends a category unless the shop already has `max`; null when full. */
  async create(tx: Db, shopId: string, name: string, max: number) {
    await lockShop(tx, shopId);
    const existing = await tx.category.aggregate({ where: { shopId }, _count: { _all: true }, _max: { position: true } });
    if (existing._count._all >= max) return null;
    return tx.category.create({ data: { shopId, name, position: (existing._max.position ?? -1) + 1 }, select: categoryFields });
  },

  async rename(shopId: string, id: string, name: string, client: Db = db) {
    const { count } = await client.category.updateMany({ where: { id, shopId }, data: { name } });
    return count === 1;
  },

  async setOrder(tx: Db, shopId: string, ids: string[]) {
    for (const [position, id] of ids.entries()) await tx.category.updateMany({ where: { id, shopId }, data: { position } });
  },

  /** Called inside the service transaction: detach products before cascading through both child levels. */
  async delete(shopId: string, id: string, client: Db) {
    await client.product.updateMany({
      where: { shopId, categoryId: id },
      data: { categoryId: null, collectionId: null, sectionId: null },
    });
    const { count } = await client.category.deleteMany({ where: { id, shopId } });
    return count === 1;
  },
};

export const testimonialRepo = {
  create(shopId: string, data: { authorName: string; message: string }, client: Db = db) {
    return client.testimonial.create({ data: { ...data, shopId }, select: { id: true, status: true } });
  },

  list(shopId: string, status: TestimonialStatus | undefined, client: Db = db) {
    return client.testimonial.findMany({
      where: { shopId, ...(status ? { status } : {}) },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      // shortcut: newest 200 only; add paging if a shop ever gets more feedback than that.
      take: 200,
    });
  },

  pendingCount(shopId: string, client: Db = db) {
    return client.testimonial.count({ where: { shopId, status: "PENDING" } });
  },

  /** Newest approved ones, for the public storefront. */
  approved(shopId: string, take: number, client: Db = db) {
    return client.testimonial.findMany({
      where: { shopId, status: "APPROVED" },
      select: { id: true, authorName: true, message: true, createdAt: true },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      take,
    });
  },

  async setStatus(shopId: string, id: string, data: { status: TestimonialStatus; moderatedById: string }, client: Db = db) {
    const { count } = await client.testimonial.updateMany({ where: { id, shopId }, data: { ...data, moderatedAt: new Date() } });
    return count === 1 ? client.testimonial.findFirst({ where: { id, shopId } }) : null;
  },
};
