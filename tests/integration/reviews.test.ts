import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { POST as cronReviewEmails } from "@/app/api/cron/review-emails/route";
import { GET as trackingView } from "@/app/api/public/orders/[token]/route";
import { GET as reviewPage, POST as submitReviews } from "@/app/api/public/reviews/[token]/route";
import { GET as productReviews } from "@/app/api/public/shops/[slug]/products/[id]/reviews/route";
import { GET as listReviews } from "@/app/api/reviews/route";
import { PATCH as moderateReview } from "@/app/api/reviews/[id]/route";
import { prisma } from "@/server/db";
import { resetRateLimits } from "@/server/http/rateLimit";
import { outbox } from "@/server/mail/mailer";
import { createReviewInvite, sendReviewInvite } from "@/server/services/reviewService";
import { seedOrder, seedVariant } from "./fixtures";
import { addMember, call, resetDb, signUpOwner } from "./helpers";

beforeAll(resetDb);
beforeEach(resetRateLimits);

/** A delivered order with its review invite, as the order core leaves it. */
async function delivered(shopId: string, opts: { variantId?: string; customerEmail?: string | null } = {}) {
  const variantId = opts.variantId ?? (await seedVariant(shopId)).variant.id;
  const order = await seedOrder(shopId, { variantId, status: "DELIVERED", customerEmail: opts.customerEmail ?? null });
  await prisma.$transaction((tx) => createReviewInvite(tx, shopId, order.id));
  return order;
}

const page = (token: string) => call(reviewPage, `/api/public/reviews/${token}`, {}, { token });
const submit = (token: string, body: unknown) =>
  call(submitReviews, `/api/public/reviews/${token}`, { method: "POST", body }, { token });
const rate = (token: string, orderItemId: string, rating: number, comment?: string) =>
  submit(token, { items: [{ orderItemId, rating, comment }] });
const moderate = (cookie: string, id: string, status: string) =>
  call(moderateReview, `/api/reviews/${id}`, { method: "PATCH", cookie, body: { status } }, { id });
const productPage = (slug: string, id: string) =>
  call(productReviews, `/api/public/shops/${slug}/products/${id}/reviews`, {}, { slug, id });

function emailedToken(to: string): string {
  const mail = outbox.findLast((m) => m.to === to);
  const token = mail?.text.match(/\/r\/([A-Za-z0-9_-]+)/)?.[1];
  if (!token) throw new Error(`no review email to ${to}`);
  return token;
}

describe("verified reviews", () => {
  it("reviews through the emailed link, once", async () => {
    const owner = await signUpOwner();
    const order = await delivered(owner.shop.id, { customerEmail: "maya@example.com" });
    expect(await sendReviewInvite(owner.shop.id, order.id)).toBe(true);
    const token = emailedToken("maya@example.com");
    const item = order.items[0];

    const opened = await page(token);
    expect(opened.status).toBe(200);
    expect(opened.body).toMatchObject({
      shop: { name: owner.shop.name, slug: owner.shop.slug },
      order: { number: order.number },
      customerFirstName: "Maya",
      items: [{ orderItemId: item.id, name: "Linen shirt / M / Sand", qty: 1 }],
    });

    const res = await rate(token, item.id, 4, "  Lovely fabric ");
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ reviewed: 1 });
    const review = await prisma.review.findUniqueOrThrow({ where: { orderItemId: item.id } });
    expect(review).toMatchObject({ rating: 4, comment: "Lovely fabric", authorName: "Maya H.", status: "PUBLISHED", shopId: owner.shop.id });

    const again = await rate(token, item.id, 1);
    expect(again.status).toBe(410);
    expect(again.body.error.code).toBe("REVIEW_LINK_USED");
    expect((await page(token)).status).toBe(410);
    expect(await prisma.review.count({ where: { shopId: owner.shop.id } })).toBe(1);
  });

  it("reviews from the tracking link when the customer gave no email", async () => {
    const owner = await signUpOwner();
    const order = await delivered(owner.shop.id);
    expect(await sendReviewInvite(owner.shop.id, order.id)).toBe(false);

    expect((await page(order.publicToken)).status).toBe(200);
    expect((await rate(order.publicToken, order.items[0].id, 5)).status).toBe(201);
    const tracking = await call(trackingView, `/api/public/orders/${order.publicToken}`, {}, { token: order.publicToken });
    expect(tracking.body.review).toEqual({ canReview: false });
  });

  it("lets only one of several simultaneous submits through", async () => {
    const owner = await signUpOwner();
    const order = await delivered(owner.shop.id);
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) => rate(order.publicToken, order.items[0].id, i + 1)),
    );
    expect(results.map((r) => r.status).sort()).toEqual([201, 410, 410, 410, 410]);
    expect(await prisma.review.count({ where: { orderItemId: order.items[0].id } })).toBe(1);
    const product = await prisma.product.findFirstOrThrow({ where: { shopId: owner.shop.id } });
    expect(product.ratingCount).toBe(1);
  });

  it("counts concurrent reviews of one product from different orders", async () => {
    const owner = await signUpOwner();
    const { product, variant } = await seedVariant(owner.shop.id, { available: 10 });
    const orders = [];
    for (let i = 0; i < 4; i++) orders.push(await delivered(owner.shop.id, { variantId: variant.id }));
    await Promise.all(orders.map((o, i) => rate(o.publicToken, o.items[0].id, i + 2)));
    const after = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(after.ratingCount).toBe(4);
    expect(after.ratingAvg.toString()).toBe("3.5");
  });

  it("refuses items of another order and leaves the link usable", async () => {
    const owner = await signUpOwner();
    const other = await signUpOwner();
    const mine = await delivered(owner.shop.id);
    const sameShop = await delivered(owner.shop.id);
    const otherShop = await delivered(other.shop.id);

    for (const foreign of [sameShop.items[0].id, otherShop.items[0].id]) {
      const res = await rate(mine.publicToken, foreign, 5);
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe("ITEM_NOT_IN_ORDER");
    }
    expect(await prisma.review.count({ where: { shopId: { in: [owner.shop.id, other.shop.id] } } })).toBe(0);
    expect((await page(mine.publicToken)).status).toBe(200);
  });

  it("refuses expired links, unknown links and bad ratings", async () => {
    const owner = await signUpOwner();
    const order = await delivered(owner.shop.id);
    const item = order.items[0].id;
    expect((await rate(order.publicToken, item, 6)).status).toBe(400);
    expect((await rate(order.publicToken, item, 4, "x".repeat(1001))).status).toBe(400);
    expect((await submit(order.publicToken, { items: [{ orderItemId: item, rating: 4 }, { orderItemId: item, rating: 5 }] })).status).toBe(400);

    await prisma.reviewInvite.update({ where: { orderId: order.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const expired = await rate(order.publicToken, item, 4);
    expect(expired.status).toBe(410);
    expect(expired.body.error.code).toBe("REVIEW_LINK_EXPIRED");

    expect((await page("z".repeat(32))).status).toBe(404);
    // An order that is not delivered has no invite yet.
    const { variant } = await seedVariant(owner.shop.id, { name: "Scarf" });
    const open = await seedOrder(owner.shop.id, { variantId: variant.id, status: "OUT_FOR_DELIVERY" });
    expect((await page(open.publicToken)).status).toBe(404);
  });

  it("keeps the product rating right through reviews, hiding and publishing again", async () => {
    const owner = await signUpOwner();
    const { product, variant } = await seedVariant(owner.shop.id);
    const a = await delivered(owner.shop.id, { variantId: variant.id });
    const b = await seedOrder(owner.shop.id, { variantId: variant.id, status: "DELIVERED", customerName: "Rami Khoury" });
    await prisma.$transaction((tx) => createReviewInvite(tx, owner.shop.id, b.id));
    await rate(a.publicToken, a.items[0].id, 5, "Perfect");
    await rate(b.publicToken, b.items[0].id, 2, "Too small");

    let pub = await productPage(owner.shop.slug, product.id);
    expect(pub.status).toBe(200);
    expect(pub.body).toMatchObject({ product: { id: product.id, name: "Linen shirt" }, average: 3.5, count: 2 });
    expect(pub.body.reviews[0]).toEqual({ rating: 2, comment: "Too small", authorName: "Rami K.", createdAt: expect.any(String), verifiedBuyer: true });

    const bad = await prisma.review.findUniqueOrThrow({ where: { orderItemId: b.items[0].id } });
    const hidden = await moderate(owner.cookie, bad.id, "HIDDEN");
    expect(hidden.status).toBe(200);
    expect(hidden.body).toMatchObject({ status: "HIDDEN", hiddenByUserId: owner.user.id, hiddenAt: expect.any(String), comment: "Too small" });
    pub = await productPage(owner.shop.slug, product.id);
    expect(pub.body).toMatchObject({ average: 5, count: 1 });
    expect(pub.body.reviews).toHaveLength(1);

    const all = await call(listReviews, "/api/reviews", { cookie: owner.cookie });
    expect(all.body).toHaveLength(2);
    expect(all.body[0]).toMatchObject({ id: bad.id, status: "HIDDEN", product: { id: product.id, name: "Linen shirt" }, order: { number: b.number } });
    const onlyHidden = await call(listReviews, "/api/reviews?status=HIDDEN", { cookie: owner.cookie });
    expect(onlyHidden.body.map((r: { id: string }) => r.id)).toEqual([bad.id]);
    expect((await call(listReviews, "/api/reviews?status=GONE", { cookie: owner.cookie })).status).toBe(400);

    const back = await moderate(owner.cookie, bad.id, "PUBLISHED");
    expect(back.body).toMatchObject({ status: "PUBLISHED", hiddenByUserId: null, hiddenAt: null });
    const stored = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect([stored.ratingAvg.toString(), stored.ratingCount]).toEqual(["3.5", 2]);
  });

  it("lets staff read reviews but only owners and managers hide them", async () => {
    const owner = await signUpOwner();
    const order = await delivered(owner.shop.id);
    await rate(order.publicToken, order.items[0].id, 3);
    const review = await prisma.review.findFirstOrThrow({ where: { shopId: owner.shop.id } });
    const staff = await addMember(owner.shop.id, "staff");
    const delivery = await addMember(owner.shop.id, "delivery");
    const manager = await addMember(owner.shop.id, "manager");

    expect((await call(listReviews, "/api/reviews", { cookie: staff.cookie })).status).toBe(200);
    expect((await moderate(staff.cookie, review.id, "HIDDEN")).status).toBe(403);
    expect((await call(listReviews, "/api/reviews", { cookie: delivery.cookie })).status).toBe(403);
    expect((await moderate(delivery.cookie, review.id, "HIDDEN")).status).toBe(403);
    expect((await moderate(manager.cookie, review.id, "HIDDEN")).status).toBe(200);
    expect((await call(listReviews, "/api/reviews")).status).toBe(401);
  });

  it("serves no reviews of archived products", async () => {
    const owner = await signUpOwner();
    const { product } = await seedVariant(owner.shop.id);
    await prisma.product.update({ where: { id: product.id }, data: { status: "ARCHIVED" } });
    expect((await productPage(owner.shop.slug, product.id)).status).toBe(404);
  });
});

// Shop A must never read or hide shop B's reviews.
describe("review isolation", () => {
  let shopA: Awaited<ReturnType<typeof signUpOwner>>;
  let shopB: Awaited<ReturnType<typeof signUpOwner>>;
  let reviewB: string;
  let productB: string;
  const actorsA: Record<string, string> = {};

  beforeAll(async () => {
    shopA = await signUpOwner();
    shopB = await signUpOwner();
    actorsA.owner = shopA.cookie;
    actorsA.manager = (await addMember(shopA.shop.id, "manager")).cookie;
    actorsA.staff = (await addMember(shopA.shop.id, "staff")).cookie;
    actorsA.delivery = (await addMember(shopA.shop.id, "delivery")).cookie;
    const order = await delivered(shopB.shop.id);
    await rate(order.publicToken, order.items[0].id, 1, "B's secret review");
    const review = await prisma.review.findFirstOrThrow({ where: { shopId: shopB.shop.id } });
    reviewB = review.id;
    productB = review.productId;
  });

  for (const role of ["owner", "manager", "staff", "delivery"]) {
    it(`${role} of shop A cannot hide shop B's review`, async () => {
      const res = await moderate(actorsA[role], reviewB, "HIDDEN");
      expect(res.status).toBe(["owner", "manager"].includes(role) ? 404 : 403);
    });
  }

  it("shop A's list never includes shop B's reviews", async () => {
    const res = await call(listReviews, "/api/reviews", { cookie: shopA.cookie });
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain("secret");
  });

  it("shop B's product reviews are not served under shop A's link", async () => {
    expect((await productPage(shopA.shop.slug, productB)).status).toBe(404);
    expect((await productPage(shopB.shop.slug, productB)).body.count).toBe(1);
  });

  it("shop B's review is still published", async () => {
    const review = await prisma.review.findUniqueOrThrow({ where: { id: reviewB } });
    expect([review.status, review.hiddenAt]).toEqual(["PUBLISHED", null]);
  });
});

describe("review email retry job", () => {
  const cron = (secret?: string) =>
    call(cronReviewEmails, "/api/cron/review-emails", { method: "POST", headers: secret ? { "x-cron-secret": secret } : {} });

  beforeAll(() => {
    process.env.CRON_SECRET = "test-cron-secret";
  });

  it("requires the cron secret", async () => {
    expect((await cron()).status).toBe(401);
    expect((await cron("wrong")).status).toBe(401);
  });

  it("emails invites that were never sent, and only those", async () => {
    await prisma.reviewInvite.updateMany({ data: { emailSentAt: new Date() } }); // earlier tests' invites
    const owner = await signUpOwner();
    const old = new Date(Date.now() - 5 * 60_000);
    const pending = await delivered(owner.shop.id, { customerEmail: "late@example.com" });
    await delivered(owner.shop.id, { customerEmail: "fresh@example.com" }); // created just now: the first send may still be running
    const noEmail = await delivered(owner.shop.id);
    const used = await delivered(owner.shop.id, { customerEmail: "used@example.com" });
    await prisma.reviewInvite.updateMany({ where: { orderId: { in: [pending.id, noEmail.id, used.id] } }, data: { createdAt: old } });
    await prisma.reviewInvite.update({ where: { orderId: used.id }, data: { usedAt: new Date() } });

    const res = await cron("test-cron-secret");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ attempted: 1, sent: 1 });
    expect(outbox.some((m) => m.to === "fresh@example.com" || m.to === "used@example.com")).toBe(false);
    const token = emailedToken("late@example.com");
    expect((await page(token)).status).toBe(200);
    expect((await prisma.reviewInvite.findUniqueOrThrow({ where: { orderId: pending.id } })).emailSentAt).not.toBeNull();

    expect((await cron("test-cron-secret")).body).toEqual({ attempted: 0, sent: 0 });
  });
});
