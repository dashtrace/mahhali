import { Prisma } from "@prisma/client";
import { db, type Db } from "./tx";

const forDashboard = {
  product: { select: { id: true, name: true } },
  orderItem: { select: { order: { select: { id: true, number: true } } } },
} satisfies Prisma.ReviewInclude;

export type DashboardReview = Prisma.ReviewGetPayload<{ include: typeof forDashboard }>;

export const reviewRepo = {
  createInvite(tx: Db, input: { shopId: string; orderId: string; tokenHash: string; expiresAt: Date }) {
    return tx.reviewInvite.create({ data: input });
  },

  /** The invite with what the email needs: the customer's email and the shop's name. */
  findInviteForEmail(shopId: string, orderId: string, client: Db = db) {
    return client.reviewInvite.findFirst({
      where: { shopId, orderId },
      include: {
        order: { select: { number: true, customerName: true, customerEmail: true } },
        shop: { select: { name: true, language: true } },
      },
    });
  },

  rotateToken(shopId: string, inviteId: string, tokenHash: string, client: Db = db) {
    return client.reviewInvite.updateMany({ where: { id: inviteId, shopId, usedAt: null }, data: { tokenHash } });
  },

  markEmailSent(shopId: string, inviteId: string, client: Db = db) {
    return client.reviewInvite.updateMany({ where: { id: inviteId, shopId }, data: { emailSentAt: new Date() } });
  },

  /**
   * The invite behind a review link: the emailed token (stored as a hash) or the
   * order's tracking token. Like the tracking token, it is the scope here.
   * Only items without a review yet are returned.
   */
  findInviteByToken(token: string, tokenHash: string, client: Db = db) {
    return client.reviewInvite.findFirst({
      where: { OR: [{ tokenHash }, { order: { publicToken: token } }] },
      include: {
        shop: { select: { name: true, slug: true, logo: true, theme: true, language: true } },
        order: {
          select: {
            number: true,
            customerName: true,
            items: {
              where: { review: { is: null } },
              select: { id: true, nameSnapshot: true, qty: true, variant: { select: { productId: true } } },
              orderBy: { id: "asc" },
            },
          },
        },
      },
    });
  },

  /** Marks the invite used unless it already is; false when another submit got there first. */
  async claimInvite(tx: Db, shopId: string, inviteId: string) {
    const { count } = await tx.reviewInvite.updateMany({
      where: { id: inviteId, shopId, usedAt: null },
      data: { usedAt: new Date() },
    });
    return count === 1;
  },

  createReviews(
    tx: Db,
    shopId: string,
    reviews: { productId: string; orderItemId: string; rating: number; comment: string | null; authorName: string }[],
  ) {
    return tx.review.createMany({ data: reviews.map((r) => ({ ...r, shopId })) });
  },

  /** Recomputes ratingAvg and ratingCount from published reviews, in the caller's transaction. */
  async refreshRatings(tx: Db, shopId: string, productIds: string[]) {
    // Lock the products first (in id order) so two concurrent reviews of one product
    // run one after the other and the second count includes the first.
    await tx.$queryRaw`SELECT id FROM "product" WHERE "shopId" = ${shopId} AND id IN (${Prisma.join(productIds)})
      ORDER BY id FOR NO KEY UPDATE`;
    const stats = await tx.review.groupBy({
      by: ["productId"],
      where: { shopId, productId: { in: productIds }, status: "PUBLISHED" },
      _avg: { rating: true },
      _count: { _all: true },
    });
    for (const productId of productIds) {
      const s = stats.find((x) => x.productId === productId);
      await tx.product.updateMany({
        where: { id: productId, shopId },
        data: { ratingAvg: (s?._avg.rating ?? 0).toFixed(2), ratingCount: s?._count._all ?? 0 },
      });
    }
  },

  publishedForProduct(shopId: string, productId: string, client: Db = db) {
    return client.review.findMany({
      where: { shopId, productId, status: "PUBLISHED" },
      select: { rating: true, comment: true, authorName: true, createdAt: true },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      // shortcut: newest 100 only; add cursor pagination when a product gets more.
      take: 100,
    });
  },

  listForShop(shopId: string, status: "PUBLISHED" | "HIDDEN" | undefined, client: Db = db) {
    return client.review.findMany({
      where: { shopId, ...(status ? { status } : {}) },
      include: forDashboard,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    });
  },

  findById(shopId: string, id: string, client: Db = db) {
    return client.review.findFirst({ where: { id, shopId } });
  },

  setStatus(
    tx: Db,
    shopId: string,
    id: string,
    data: { status: "PUBLISHED" | "HIDDEN"; hiddenByUserId: string | null; hiddenAt: Date | null },
  ) {
    return tx.review.update({ where: { id, shopId }, data, include: forDashboard });
  },

  /**
   * The one cross-shop read here: the retry job covers every shop. It returns ids
   * only, and each send looks the invite up again by shopId.
   * shortcut: no attempt counter, so an address the provider always refuses is
   * retried until the invite expires; add one to ReviewInvite if that fills batches.
   */
  pendingEmails(createdBefore: Date, take: number, client: Db = db) {
    return client.reviewInvite.findMany({
      where: {
        emailSentAt: null,
        usedAt: null,
        expiresAt: { gt: new Date() },
        createdAt: { lt: createdBefore },
        order: { customerEmail: { not: null } },
      },
      select: { shopId: true, orderId: true },
      orderBy: { createdAt: "asc" },
      take,
    });
  },
};
