import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { POST as createManual } from "@/app/api/orders/route";
import { prisma } from "@/server/db";
import { outbox } from "@/server/mail/mailer";
import { seedVariant } from "./fixtures";
import { addMember, call, resetDb, signUpOwner } from "./helpers";
import { orderBody, placeOrder } from "./orderHelpers";

beforeAll(resetDb);

describe("placing a guest order", () => {
  let owner: Awaited<ReturnType<typeof signUpOwner>>;

  beforeEach(async () => {
    owner = await signUpOwner({ currency: "USD", usdLbpRate: "89500" });
    await prisma.shop.update({ where: { id: owner.shop.id }, data: { deliveryFeeMinor: 300n } });
  });

  it("reserves the stock, numbers the order from 1001 and records everything in one go", async () => {
    const { variant } = await seedVariant(owner.shop.id, { priceMinor: 2450n, available: 3 });
    const res = await placeOrder(owner.shop.slug, orderBody([{ variantId: variant.id, qty: 2 }]));

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ number: 1001, status: "NEW", currency: "USD", totalMinor: 2 * 2450 + 300 });
    expect(res.body.token).toMatch(/^[A-Za-z0-9_-]{32}$/);

    const v = await prisma.variant.findUniqueOrThrow({ where: { id: variant.id } });
    expect([v.available, v.reserved]).toEqual([1, 2]);

    const order = await prisma.order.findFirstOrThrow({
      where: { shopId: owner.shop.id },
      include: { items: true, events: true, stockMovements: true, customer: true },
    });
    expect(order).toMatchObject({
      customerPhone: "+96171123456",
      subtotalMinor: 4900n,
      deliveryFeeMinor: 300n,
      codMinor: 5200n,
      source: "CATALOGUE",
    });
    expect(order.usdLbpRate?.toString()).toBe("89500");
    expect(order.items[0]).toMatchObject({ nameSnapshot: "Linen shirt / M / Sand", unitPriceMinor: 2450n, qty: 2 });
    expect(order.events.map((e) => e.toValue)).toEqual(["NEW"]);
    expect(order.stockMovements).toMatchObject([{ variantId: variant.id, delta: -2, reason: "RESERVE" }]);
  });

  it("recognises a repeat buyer by phone and keeps their latest name", async () => {
    const { variant } = await seedVariant(owner.shop.id);
    await placeOrder(owner.shop.slug, orderBody([{ variantId: variant.id }]));
    const second = await placeOrder(
      owner.shop.slug,
      orderBody([{ variantId: variant.id }], { customer: { name: "Maya H.", phone: "+961 71 123 456" } }),
    );
    expect(second.body.number).toBe(1002);
    const customers = await prisma.customer.findMany({ where: { shopId: owner.shop.id }, include: { orders: true } });
    expect(customers).toHaveLength(1);
    expect(customers[0].name).toBe("Maya H.");
    expect(customers[0].orders).toHaveLength(2);
  });

  it("refuses an order the shop cannot fill and leaves no trace, not even a used number", async () => {
    const { variant: plenty } = await seedVariant(owner.shop.id, { name: "Bag", available: 5 });
    const { variant: last } = await seedVariant(owner.shop.id, { name: "Ring", available: 1 });

    const res = await placeOrder(owner.shop.slug, orderBody([{ variantId: plenty.id }, { variantId: last.id, qty: 2 }]));
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({ code: "OUT_OF_STOCK", details: { variantId: last.id } });

    const counters = await prisma.variant.findMany({ where: { shopId: owner.shop.id }, orderBy: { available: "asc" } });
    expect(counters.map((v) => [v.available, v.reserved])).toEqual([[1, 0], [5, 0]]);
    expect(await prisma.order.count({ where: { shopId: owner.shop.id } })).toBe(0);
    expect(await prisma.stockMovement.count({ where: { shopId: owner.shop.id, reason: "RESERVE" } })).toBe(0);

    const next = await placeOrder(owner.shop.slug, orderBody([{ variantId: last.id }]));
    expect(next.body.number).toBe(1001);
  });

  it("refuses archived variants, archived products and another shop's variants", async () => {
    const other = await signUpOwner();
    const { variant: foreign } = await seedVariant(other.shop.id);
    const { variant: archived } = await seedVariant(owner.shop.id);
    await prisma.variant.update({ where: { id: archived.id }, data: { archived: true } });
    const { product, variant: inArchivedProduct } = await seedVariant(owner.shop.id, { name: "Old" });
    await prisma.product.update({ where: { id: product.id }, data: { status: "ARCHIVED" } });

    for (const variantId of [foreign.id, archived.id, inArchivedProduct.id]) {
      const res = await placeOrder(owner.shop.slug, orderBody([{ variantId }]));
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe("UNAVAILABLE");
    }
    expect((await prisma.variant.findUniqueOrThrow({ where: { id: foreign.id } })).available).toBe(5);
  });

  it("validates the customer, the address and the shop", async () => {
    const { variant } = await seedVariant(owner.shop.id);
    const badPhone = await placeOrder(owner.shop.slug, orderBody([{ variantId: variant.id }], { customer: { name: "A", phone: "123" } }));
    expect(badPhone.status).toBe(400);
    const badPlace = orderBody([{ variantId: variant.id }]);
    badPlace.address.governorate = "Atlantis";
    expect((await placeOrder(owner.shop.slug, badPlace)).status).toBe(400);
    const tooMany = await placeOrder(owner.shop.slug, orderBody([{ variantId: variant.id, qty: 21 }]));
    expect(tooMany.status).toBe(400);
    expect((await placeOrder("no-such-shop", orderBody([{ variantId: variant.id }]))).status).toBe(404);

    await prisma.shop.update({ where: { id: owner.shop.id }, data: { suspended: true } });
    expect((await placeOrder(owner.shop.slug, orderBody([{ variantId: variant.id }]))).status).toBe(404);
  });

  it("returns the first order when the same idempotency key is sent again", async () => {
    const { variant } = await seedVariant(owner.shop.id, { available: 5 });
    const body = orderBody([{ variantId: variant.id }]);
    const first = await placeOrder(owner.shop.slug, body, { key: "form-load-abc123" });
    const retry = await placeOrder(owner.shop.slug, body, { key: "form-load-abc123" });
    expect(first.status).toBe(201);
    expect(retry.status).toBe(200);
    expect(retry.headers.get("idempotent-replayed")).toBe("true");
    expect(retry.body).toEqual(first.body);
    expect(await prisma.order.count({ where: { shopId: owner.shop.id } })).toBe(1);
    expect((await prisma.variant.findUniqueOrThrow({ where: { id: variant.id } })).available).toBe(4);

    expect((await placeOrder(owner.shop.slug, body, { key: "bad key!" })).status).toBe(400);
  });

  it("emails the tracking link when the customer gave an email", async () => {
    const { variant } = await seedVariant(owner.shop.id);
    outbox.length = 0;
    const res = await placeOrder(
      owner.shop.slug,
      orderBody([{ variantId: variant.id }], { customer: { name: "Maya Haddad", phone: "71123456", email: "maya@example.com" } }),
    );
    expect(outbox).toHaveLength(1);
    expect(outbox[0].to).toBe("maya@example.com");
    expect(outbox[0].text).toContain(`/t/${res.body.token}`);
  });

  it("stops taking orders at the free plan's monthly limit, but not on Pro", async () => {
    const { variant } = await seedVariant(owner.shop.id, { available: 100 });
    const { orderLimit } = await import("@/server/domain/plans");
    const limit = orderLimit("free")!;
    const { seedOrder } = await import("./fixtures");
    for (let i = 0; i < limit; i++) await seedOrder(owner.shop.id, { variantId: variant.id });

    const refused = await placeOrder(owner.shop.slug, orderBody([{ variantId: variant.id }]));
    expect(refused.status).toBe(422);
    expect(refused.body.error.code).toBe("PLAN_LIMIT_REACHED");

    await prisma.shop.update({ where: { id: owner.shop.id }, data: { plan: "pro" } });
    expect((await placeOrder(owner.shop.slug, orderBody([{ variantId: variant.id }]))).status).toBe(201);
  });

  it("limits how fast one address can place orders", async () => {
    const { variant } = await seedVariant(owner.shop.id, { available: 100 });
    const statuses: number[] = [];
    for (let i = 0; i < 31; i++) {
      statuses.push((await placeOrder(owner.shop.slug, orderBody([{ variantId: variant.id }]), { ip: "203.0.113.9" })).status);
    }
    expect(statuses.filter((s) => s === 201)).toHaveLength(30);
    expect(statuses.at(-1)).toBe(429);
  });
});

describe("manual orders from DMs", () => {
  it("lets staff enter an order with when the customer first wrote and a custom fee", async () => {
    const owner = await signUpOwner();
    const staff = await addMember(owner.shop.id, "staff");
    const { variant } = await seedVariant(owner.shop.id, { priceMinor: 1000n });
    const res = await call(createManual, "/api/orders", {
      method: "POST",
      cookie: staff.cookie,
      headers: { "idempotency-key": "manual-entry-0001" },
      body: orderBody([{ variantId: variant.id }], { firstContactAt: "2026-10-20T09:00:00Z", deliveryFee: "4.00" }),
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ number: 1001, source: "MANUAL", createdByUserId: staff.userId, totalMinor: 1400 });
    expect(new Date(res.body.firstContactAt).toISOString()).toBe("2026-10-20T09:00:00.000Z");
    expect(res.body.events[0]).toMatchObject({ toValue: "NEW", actorUserId: staff.userId });
  });

  it("is closed to delivery users", async () => {
    const owner = await signUpOwner();
    const delivery = await addMember(owner.shop.id, "delivery");
    const { variant } = await seedVariant(owner.shop.id);
    const res = await call(createManual, "/api/orders", {
      method: "POST",
      cookie: delivery.cookie,
      body: orderBody([{ variantId: variant.id }]),
    });
    expect(res.status).toBe(403);
  });
});
