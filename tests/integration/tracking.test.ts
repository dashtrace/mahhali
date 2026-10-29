import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { GET as trackingView } from "@/app/api/public/orders/[token]/route";
import { POST as track } from "@/app/api/public/shops/[slug]/track/route";
import { prisma } from "@/server/db";
import { resetRateLimits } from "@/server/http/rateLimit";
import { createReviewInvite } from "@/server/services/reviewService";
import { seedCourier, seedOrder, seedVariant } from "./fixtures";
import { call, resetDb, signUpOwner } from "./helpers";

beforeAll(resetDb);
beforeEach(resetRateLimits);

const view = (token: string, headers?: Record<string, string>) =>
  call(trackingView, `/api/public/orders/${token}`, { headers }, { token });

const lookup = (slug: string, body: unknown, ip = "10.0.0.1") =>
  call(track, `/api/public/shops/${slug}/track`, { method: "POST", body, headers: { "x-forwarded-for": ip } }, { slug });

describe("order tracking page", () => {
  it("shows the timeline, items, both currencies and the courier, but only the customer's first name", async () => {
    const owner = await signUpOwner({ usdLbpRate: "89500" });
    const { variant } = await seedVariant(owner.shop.id, { priceMinor: 2500n });
    const courier = await seedCourier(owner.shop.id, { name: "Toters" });
    const order = await seedOrder(owner.shop.id, {
      variantId: variant.id,
      qty: 2,
      status: "OUT_FOR_DELIVERY",
      courierId: courier.id,
      deliveryFeeMinor: 300n,
      customerEmail: "maya@example.com",
    });
    await prisma.orderEvent.createMany({
      data: [
        { shopId: owner.shop.id, orderId: order.id, type: "STATUS", fromValue: "NEW", toValue: "CONFIRMED", actorUserId: owner.user.id, at: new Date(Date.now() - 2000) },
        { shopId: owner.shop.id, orderId: order.id, type: "COURIER", toValue: courier.id, actorUserId: owner.user.id, at: new Date(Date.now() - 1500) },
        { shopId: owner.shop.id, orderId: order.id, type: "STATUS", fromValue: "PACKED", toValue: "OUT_FOR_DELIVERY", note: "Rider: Ali", actorUserId: owner.user.id },
      ],
    });

    const res = await view(order.publicToken);
    expect(res.status).toBe(200);
    expect(res.body.shop).toMatchObject({ name: owner.shop.name, slug: owner.shop.slug, language: "en" });
    expect(res.body.order).toMatchObject({
      number: order.number,
      status: "OUT_FOR_DELIVERY",
      timeline: [
        { status: "CONFIRMED", at: expect.any(String) },
        { status: "OUT_FOR_DELIVERY", at: expect.any(String) },
      ],
      items: [{ name: "Linen shirt / M / Sand", unitPriceMinor: 2500, qty: 2 }],
      currency: "USD",
      subtotalMinor: 5000,
      deliveryFeeMinor: 300,
      totalMinor: 5300,
      // $53.00 at 89,500 pounds per dollar
      converted: { currency: "LBP", usdLbpRate: "89500", subtotalMinor: 4475000, deliveryFeeMinor: 268500, totalMinor: 4743500 },
      courier: { name: "Toters" },
      customerFirstName: "Maya",
    });
    expect(res.body.review).toEqual({ canReview: false });

    const text = JSON.stringify(res.body);
    for (const secret of ["Haddad", "71123456", "maya@example.com", "Armenia", "Mar Mikhael", "pharmacy", "Rider", owner.user.id, order.customerId, courier.id]) {
      expect(text).not.toContain(secret);
    }
  });

  it("converts pounds to dollars and leaves out the conversion when no rate was frozen", async () => {
    const lbp = await signUpOwner({ currency: "LBP", usdLbpRate: "89500" });
    const { variant } = await seedVariant(lbp.shop.id, { priceMinor: 895000n });
    const order = await seedOrder(lbp.shop.id, { variantId: variant.id });
    expect((await view(order.publicToken)).body.order.converted).toMatchObject({ currency: "USD", totalMinor: 1000 });

    const usd = await signUpOwner();
    const { variant: v2 } = await seedVariant(usd.shop.id);
    const noRate = await seedOrder(usd.shop.id, { variantId: v2.id });
    expect((await view(noRate.publicToken)).body.order.converted).toBeNull();
  });

  it("offers a review once delivered, until the invite is used", async () => {
    const owner = await signUpOwner();
    const { variant } = await seedVariant(owner.shop.id);
    const order = await seedOrder(owner.shop.id, { variantId: variant.id, status: "DELIVERED" });
    await prisma.$transaction((tx) => createReviewInvite(tx, owner.shop.id, order.id));
    expect((await view(order.publicToken)).body.review).toEqual({ canReview: true });

    await prisma.reviewInvite.update({ where: { orderId: order.id }, data: { usedAt: new Date() } });
    expect((await view(order.publicToken)).body.review).toEqual({ canReview: false });
  });

  it("returns 404 for an unknown token and 400 for a malformed one", async () => {
    expect((await view("x".repeat(32))).status).toBe(404);
    expect((await view("not a token!")).status).toBe(400);
  });

  it("limits how often one address can open tracking pages", async () => {
    const ip = { "x-forwarded-for": "10.9.9.9" };
    for (let i = 0; i < 60; i++) expect((await view("y".repeat(32), ip)).status).toBe(404);
    const res = await view("y".repeat(32), ip);
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
  });
});

describe("track by order number and phone", () => {
  let owner: Awaited<ReturnType<typeof signUpOwner>>;
  let order: Awaited<ReturnType<typeof seedOrder>>;

  beforeAll(async () => {
    owner = await signUpOwner();
    const { variant } = await seedVariant(owner.shop.id);
    order = await seedOrder(owner.shop.id, { variantId: variant.id, customerPhone: "+96171123456" });
  });

  it("returns the tracking token when both match, with the phone typed the local way", async () => {
    const res = await lookup(owner.shop.slug, { number: order.number, phone: "71 123 456" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ token: order.publicToken });
  });

  it("gives the same 404 for a wrong phone, a wrong number or another shop", async () => {
    const other = await signUpOwner();
    const wrongPhone = await lookup(owner.shop.slug, { number: order.number, phone: "+9613999888" });
    const wrongNumber = await lookup(owner.shop.slug, { number: order.number + 50, phone: "+96171123456" });
    const wrongShop = await lookup(other.shop.slug, { number: order.number, phone: "+96171123456" });
    const noShop = await lookup("no-such-shop", { number: order.number, phone: "+96171123456" });
    for (const res of [wrongPhone, wrongNumber, wrongShop, noShop]) {
      expect(res.status).toBe(404);
      expect(res.body).toEqual(wrongPhone.body);
    }
  });

  it("refuses an invalid phone", async () => {
    expect((await lookup(owner.shop.slug, { number: order.number, phone: "12" })).status).toBe(400);
  });

  it("limits guesses per order across addresses", async () => {
    for (let i = 0; i < 5; i++) {
      expect((await lookup(owner.shop.slug, { number: order.number, phone: `+9617100000${i}` }, `10.1.0.${i}`)).status).toBe(404);
    }
    const res = await lookup(owner.shop.slug, { number: order.number, phone: "+96171123456" }, "10.1.0.99");
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe("RATE_LIMITED");
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
  });

  it("limits guesses per address across orders", async () => {
    for (let i = 0; i < 10; i++) {
      expect((await lookup(owner.shop.slug, { number: 5000 + i, phone: "+96171123456" }, "10.2.0.1")).status).toBe(404);
    }
    expect((await lookup(owner.shop.slug, { number: order.number, phone: "+96171123456" }, "10.2.0.1")).status).toBe(429);
  });
});
