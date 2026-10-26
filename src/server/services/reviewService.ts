import { firstName, reviewAuthorName } from "../domain/names";
import { hashToken, randomToken } from "../domain/tokens";
import { AppError, notFound, unprocessable } from "../http/errors";
import { rateLimit } from "../http/rateLimit";
import type { Actor } from "../http/withRoute";
import { appUrl, sendMail } from "../mail/mailer";
import { productRepo } from "../repositories/productRepo";
import { reviewRepo, type DashboardReview } from "../repositories/reviewRepo";
import { shopRepo } from "../repositories/shopRepo";
import { transaction, type Db } from "../repositories/tx";
import type { ReviewStatusValue, SubmitReviewsInput } from "../validation/reviews";

const INVITE_DAYS = 30;
const MINUTE = 60_000;

const linkUsed = () => new AppError(410, "REVIEW_LINK_USED", "This review link was already used.");
const linkExpired = () => new AppError(410, "REVIEW_LINK_EXPIRED", "This review link has expired.");

/**
 * Called inside the transaction that marks an order Delivered. The stored hash
 * is a placeholder until sendReviewInvite mints the token it emails; customers
 * without email reach the review page through their tracking link instead.
 */
export async function createReviewInvite(tx: Db, shopId: string, orderId: string) {
  await reviewRepo.createInvite(tx, {
    shopId,
    orderId,
    tokenHash: hashToken(randomToken()),
    expiresAt: new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000),
  });
}

/**
 * Emails the "Rate your order" link. Runs after the delivery is committed and
 * never throws: a failed send leaves emailSentAt empty for the retry job.
 */
export async function sendReviewInvite(shopId: string, orderId: string): Promise<boolean> {
  try {
    const invite = await reviewRepo.findInviteForEmail(shopId, orderId);
    if (!invite || invite.usedAt || invite.emailSentAt || !invite.order.customerEmail) return false;
    if (invite.expiresAt < new Date()) return false;
    // Only the hash is stored, so each send mints a fresh token.
    const token = randomToken();
    await reviewRepo.rotateToken(shopId, invite.id, hashToken(token));
    const link = appUrl(`/r/${token}`);
    await sendMail({
      to: invite.order.customerEmail,
      subject: `How was your order #${invite.order.number} from ${invite.shop.name}?`,
      text: `Hi ${invite.order.customerName.split(" ")[0]},\n\nYour order #${invite.order.number} was delivered. Rate what you bought (it takes a minute):\n${link}\n\nThe link works once and expires in ${INVITE_DAYS} days.\n\n${invite.shop.name}`,
    });
    await reviewRepo.markEmailSent(shopId, invite.id);
    return true;
  } catch (error) {
    console.error("review invite email failed", error);
    return false;
  }
}

/** The invite behind an emailed review token or a tracking token, if it can still be used. */
async function openInvite(token: string, ip: string) {
  rateLimit(`reviews:${ip}`, 30, 10 * MINUTE);
  const invite = await reviewRepo.findInviteByToken(token, hashToken(token));
  if (!invite) throw notFound("Review link");
  if (invite.usedAt) throw linkUsed();
  if (invite.expiresAt <= new Date()) throw linkExpired();
  return invite;
}

function toDashboard(r: DashboardReview) {
  return {
    id: r.id,
    rating: r.rating,
    comment: r.comment,
    authorName: r.authorName,
    status: r.status,
    createdAt: r.createdAt,
    hiddenAt: r.hiddenAt,
    hiddenByUserId: r.hiddenByUserId,
    product: r.product,
    order: r.orderItem.order,
  };
}

export const reviewService = {
  /** The review page: the order's items that can still be rated. */
  async forToken(token: string, ip: string) {
    const invite = await openInvite(token, ip);
    return {
      shop: invite.shop,
      order: { number: invite.order.number },
      customerFirstName: firstName(invite.order.customerName),
      expiresAt: invite.expiresAt,
      items: invite.order.items.map((i) => ({ orderItemId: i.id, name: i.nameSnapshot, qty: i.qty })),
    };
  },

  /** One submit per link: the reviews, the used mark and the product ratings in one transaction. */
  async submit(token: string, input: SubmitReviewsInput, ip: string) {
    const invite = await openInvite(token, ip);
    const items = new Map(invite.order.items.map((i) => [i.id, i]));
    const unknown = input.items.filter((i) => !items.has(i.orderItemId)).map((i) => i.orderItemId);
    if (unknown.length > 0) {
      throw unprocessable("ITEM_NOT_IN_ORDER", "Only items from this order can be reviewed.", { orderItemIds: unknown });
    }
    const authorName = reviewAuthorName(invite.order.customerName);
    const reviews = input.items.map((i) => ({
      productId: items.get(i.orderItemId)!.variant.productId,
      orderItemId: i.orderItemId,
      rating: i.rating,
      comment: i.comment,
      authorName,
    }));
    await transaction(async (tx) => {
      // Conditional on usedAt being empty: of two concurrent submits only one gets past here.
      if (!(await reviewRepo.claimInvite(tx, invite.shopId, invite.id))) throw linkUsed();
      await reviewRepo.createReviews(tx, invite.shopId, reviews);
      await reviewRepo.refreshRatings(tx, invite.shopId, [...new Set(reviews.map((r) => r.productId))]);
    });
    return { reviewed: reviews.length };
  },

  /** Published reviews of an active product, for its public page. */
  async forProduct(slug: string, productId: string) {
    const shop = await shopRepo.findBySlug(slug);
    const product = shop && !shop.suspended ? await productRepo.findById(shop.id, productId) : null;
    if (!shop || !product || product.status !== "ACTIVE") throw notFound("Product");
    const reviews = await reviewRepo.publishedForProduct(shop.id, product.id);
    return {
      product: { id: product.id, name: product.name },
      average: Number(product.ratingAvg),
      count: product.ratingCount,
      reviews: reviews.map((r) => ({ ...r, verifiedBuyer: true })),
    };
  },

  async list(actor: Actor, status: ReviewStatusValue | undefined) {
    return (await reviewRepo.listForShop(actor.shopId, status)).map(toDashboard);
  },

  /** Hide or publish again. The text is never editable; hiding records who and when. */
  moderate(actor: Actor, id: string, status: ReviewStatusValue) {
    return transaction(async (tx) => {
      const review = await reviewRepo.findById(actor.shopId, id, tx);
      if (!review) throw notFound("Review");
      const hidden = status === "HIDDEN";
      const updated = await reviewRepo.setStatus(tx, actor.shopId, id, {
        status,
        hiddenByUserId: hidden ? actor.userId : null,
        hiddenAt: hidden ? new Date() : null,
      });
      await reviewRepo.refreshRatings(tx, actor.shopId, [review.productId]);
      return toDashboard(updated);
    });
  },

  /** Cron: emails invites whose first send failed (or never ran), oldest first. */
  async retryEmails() {
    const pending = await reviewRepo.pendingEmails(new Date(Date.now() - 2 * MINUTE), 50);
    let sent = 0;
    for (const p of pending) if (await sendReviewInvite(p.shopId, p.orderId)) sent += 1;
    return { attempted: pending.length, sent };
  },
};
