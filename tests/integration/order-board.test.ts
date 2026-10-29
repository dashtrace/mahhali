import { beforeAll, describe, expect, it } from "vitest";
import { GET as listOrders } from "@/app/api/orders/route";
import { GET as getOrder } from "@/app/api/orders/[id]/route";
import { POST as expireRoute } from "@/app/api/cron/expire-reservations/route";
import { prisma } from "@/server/db";
import { outbox } from "@/server/mail/mailer";
import { seedCourier, seedOrder, seedVariant } from "./fixtures";
import { addMember, call, resetDb, signUpOwner } from "./helpers";
import { moveOrder, orderBody, patchOrder, placeOrder } from "./orderHelpers";

beforeAll(resetDb);

async function counters(variantId: string) {
  const v = await prisma.variant.findUniqueOrThrow({ where: { id: variantId } });
  return [v.available, v.reserved];
}

describe("moving an order across the board", () => {
  it("walks New to Delivered with the stock, history and review invite to match", async () => {
    const owner = await signUpOwner({ usdLbpRate: "89500" });
    const staff = await addMember(owner.shop.id, "staff");
    const courier = await seedCourier(owner.shop.id);
    const { variant } = await seedVariant(owner.shop.id, { available: 5 });
    const placed = await placeOrder(
      owner.shop.slug,
      orderBody([{ variantId: variant.id, qty: 2 }], { customer: { name: "Maya Haddad", phone: "71123456", email: "maya@example.com" } }),
    );
    const id = (await prisma.order.findFirstOrThrow({ where: { number: placed.body.number, shopId: owner.shop.id } })).id;

    const confirmed = await moveOrder(staff.cookie, id, { to: "CONFIRMED" });
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.confirmedAt).toBeTruthy();
    expect(confirmed.body.allowedNext).toEqual(["PACKED", "CANCELLED"]);
    expect((await moveOrder(staff.cookie, id, { to: "PACKED" })).status).toBe(200);

    const noCourier = await moveOrder(staff.cookie, id, { to: "OUT_FOR_DELIVERY" });
    expect(noCourier.status).toBe(422);
    expect(noCourier.body.error.code).toBe("COURIER_REQUIRED");

    const assigned = await patchOrder(staff.cookie, id, { courierId: courier.id });
    expect(assigned.status).toBe(200);
    expect(assigned.body.courier.name).toBe("Toters");

    expect((await moveOrder(staff.cookie, id, { to: "OUT_FOR_DELIVERY" })).status).toBe(200);
    expect(await counters(variant.id)).toEqual([3, 0]);

    outbox.length = 0;
    const delivered = await moveOrder(staff.cookie, id, { to: "DELIVERED", collectedUsd: "50.00", collectedLbp: "90000" });
    expect(delivered.status).toBe(200);

    const order = await prisma.order.findUniqueOrThrow({
      where: { id },
      include: { events: { orderBy: { at: "asc" } }, stockMovements: true, reviewInvite: true },
    });
    expect(order).toMatchObject({ status: "DELIVERED", deliveredByUserId: staff.userId, reportedUsdCents: 5000n, reportedLbp: 90000n });
    expect(order.deliveredAt).toBeTruthy();
    expect(order.events.map((e) => `${e.type}:${e.toValue}`)).toEqual([
      "STATUS:NEW",
      "STATUS:CONFIRMED",
      "STATUS:PACKED",
      "COURIER:Toters",
      "STATUS:OUT_FOR_DELIVERY",
      "STATUS:DELIVERED",
    ]);
    expect(order.stockMovements.map((m) => `${m.reason}:${m.delta}`).sort()).toEqual(["RESERVE:-2", "SHIP:-2"]);
    expect(order.reviewInvite?.emailSentAt).toBeTruthy();
    expect(outbox.map((m) => m.to)).toEqual(["maya@example.com"]);
    expect(outbox[0].text).toMatch(/\/r\/[A-Za-z0-9_-]+/);

    const detail = await call(getOrder, `/api/orders/${id}`, { cookie: owner.cookie }, { id });
    expect(detail.body.events.find((e: { toValue: string }) => e.toValue === "DELIVERED").actorName).toMatch(/staff/);
    expect(detail.body.trackingUrl).toContain(`/t/${placed.body.token}`);
    expect(detail.body.idempotencyKey).toBeUndefined();
  });

  it("refuses moves the board does not allow", async () => {
    const owner = await signUpOwner();
    const { variant } = await seedVariant(owner.shop.id);
    const order = await seedOrder(owner.shop.id, { variantId: variant.id });

    const skip = await moveOrder(owner.cookie, order.id, { to: "DELIVERED" });
    expect(skip.status).toBe(422);
    expect(skip.body.error).toMatchObject({ code: "INVALID_TRANSITION", details: { from: "NEW", allowed: ["CONFIRMED", "CANCELLED"] } });
    expect((await moveOrder(owner.cookie, order.id, { to: "RETURNED" })).status).toBe(422);
    expect((await moveOrder(owner.cookie, order.id, { to: "NEW" })).status).toBe(422);
    expect((await moveOrder(owner.cookie, order.id, { to: "SHIPPED" })).status).toBe(400);
  });

  it("releases the reservation when an order is cancelled before it leaves", async () => {
    const owner = await signUpOwner();
    const { variant } = await seedVariant(owner.shop.id, { available: 5 });
    const order = await seedOrder(owner.shop.id, { variantId: variant.id, qty: 2, status: "PACKED" });
    expect(await counters(variant.id)).toEqual([3, 2]);

    const res = await moveOrder(owner.cookie, order.id, { to: "CANCELLED", note: "Customer changed their mind" });
    expect(res.status).toBe(200);
    expect(await counters(variant.id)).toEqual([5, 0]);
    const event = await prisma.orderEvent.findFirstOrThrow({ where: { orderId: order.id, toValue: "CANCELLED" } });
    expect(event.note).toBe("Customer changed their mind");
  });

  it("restocks a failed delivery and cannot cancel an order that already left", async () => {
    const owner = await signUpOwner();
    const courier = await seedCourier(owner.shop.id);
    const { variant } = await seedVariant(owner.shop.id, { available: 5 });
    const order = await seedOrder(owner.shop.id, { variantId: variant.id, status: "OUT_FOR_DELIVERY", courierId: courier.id });
    expect(await counters(variant.id)).toEqual([4, 0]);

    expect((await moveOrder(owner.cookie, order.id, { to: "CANCELLED" })).status).toBe(422);
    const returned = await moveOrder(owner.cookie, order.id, { to: "RETURNED", note: "Nobody home" });
    expect(returned.status).toBe(200);
    expect(await counters(variant.id)).toEqual([5, 0]);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).failureReason).toBe("Nobody home");
  });

  it("lets only one of two simultaneous moves through", async () => {
    const owner = await signUpOwner();
    const { variant } = await seedVariant(owner.shop.id, { available: 5 });
    const order = await seedOrder(owner.shop.id, { variantId: variant.id, status: "PACKED" });

    const [a, b] = await Promise.all([
      moveOrder(owner.cookie, order.id, { to: "CANCELLED" }),
      moveOrder(owner.cookie, order.id, { to: "CANCELLED" }),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, expect.any(Number)]);
    expect([a.status, b.status].filter((s) => s === 200)).toHaveLength(1);
    expect(await counters(variant.id)).toEqual([5, 0]);
    expect(await prisma.orderEvent.count({ where: { orderId: order.id, toValue: "CANCELLED" } })).toBe(1);
  });

  it("locks the address once the order is out, and refuses inactive or foreign couriers", async () => {
    const owner = await signUpOwner();
    const other = await signUpOwner();
    const courier = await seedCourier(owner.shop.id);
    const retired = await prisma.courier.create({ data: { shopId: owner.shop.id, name: "Old", type: "INDIVIDUAL", active: false } });
    const foreign = await seedCourier(other.shop.id);
    const { variant } = await seedVariant(owner.shop.id);
    const order = await seedOrder(owner.shop.id, { variantId: variant.id, status: "CONFIRMED" });

    const edited = await patchOrder(owner.cookie, order.id, { address: { landmark: "Blue gate" }, notes: "Call first" });
    expect(edited.body).toMatchObject({ landmark: "Blue gate", notes: "Call first", area: "Mar Mikhael" });
    expect((await patchOrder(owner.cookie, order.id, { courierId: retired.id })).body.error.code).toBe("COURIER_INACTIVE");
    expect((await patchOrder(owner.cookie, order.id, { courierId: foreign.id })).status).toBe(404);

    await patchOrder(owner.cookie, order.id, { courierId: courier.id });
    await moveOrder(owner.cookie, order.id, { to: "PACKED" });
    await moveOrder(owner.cookie, order.id, { to: "OUT_FOR_DELIVERY" });
    const late = await patchOrder(owner.cookie, order.id, { address: { landmark: "Red gate" } });
    expect(late.status).toBe(422);
    expect(late.body.error.code).toBe("ORDER_LOCKED");
  });
});

describe("the board list", () => {
  it("filters by status and courier, searches by number, phone and name, and counts per status", async () => {
    const owner = await signUpOwner();
    const courier = await seedCourier(owner.shop.id);
    const { variant } = await seedVariant(owner.shop.id, { available: 50 });
    await seedOrder(owner.shop.id, { variantId: variant.id, customerName: "Rami Khoury", customerPhone: "+96103123456" });
    await seedOrder(owner.shop.id, { variantId: variant.id, status: "CONFIRMED", courierId: courier.id });
    await seedOrder(owner.shop.id, { variantId: variant.id, status: "DELIVERED", courierId: courier.id });

    const all = await call(listOrders, "/api/orders", { cookie: owner.cookie });
    expect(all.body.orders.map((o: { number: number }) => o.number)).toEqual([1003, 1002, 1001]);
    expect(all.body.counts).toEqual({ NEW: 1, CONFIRMED: 1, DELIVERED: 1 });
    expect(all.body.orders[0].publicToken).toBeUndefined();

    const q = (query: string) => call(listOrders, `/api/orders?${query}`, { cookie: owner.cookie });
    expect((await q("status=CONFIRMED")).body.orders.map((o: { number: number }) => o.number)).toEqual([1002]);
    expect((await q(`courierId=${courier.id}`)).body.orders).toHaveLength(2);
    expect((await q("q=%231001")).body.orders.map((o: { number: number }) => o.number)).toEqual([1001]);
    expect((await q("q=03%20123%20456")).body.orders.map((o: { number: number }) => o.number)).toEqual([1001]);
    expect((await q("q=khoury")).body.orders.map((o: { number: number }) => o.number)).toEqual([1001]);

    const page1 = await q("limit=2");
    expect(page1.body.orders).toHaveLength(2);
    const page2 = await q(`limit=2&cursor=${page1.body.nextCursor}`);
    expect(page2.body.orders.map((o: { number: number }) => o.number)).toEqual([1001]);
    expect(page2.body.nextCursor).toBeNull();
  });

  it("is closed to delivery users", async () => {
    const owner = await signUpOwner();
    const delivery = await addMember(owner.shop.id, "delivery");
    expect((await call(listOrders, "/api/orders", { cookie: delivery.cookie })).status).toBe(403);
  });
});

describe("reservation expiry job", () => {
  it("cancels orders left in New past the shop's limit and needs the cron secret", async () => {
    process.env.CRON_SECRET = "test-cron-secret";
    const owner = await signUpOwner();
    await prisma.shop.update({ where: { id: owner.shop.id }, data: { autoCancelHours: 24 } });
    const { variant } = await seedVariant(owner.shop.id, { available: 5 });
    const stale = await seedOrder(owner.shop.id, { variantId: variant.id, createdAt: new Date(Date.now() - 25 * 3600_000) });
    const fresh = await seedOrder(owner.shop.id, { variantId: variant.id });
    const confirmed = await seedOrder(owner.shop.id, {
      variantId: variant.id,
      status: "CONFIRMED",
      createdAt: new Date(Date.now() - 48 * 3600_000),
    });

    expect((await call(expireRoute, "/api/cron/expire-reservations", { method: "POST" })).status).toBe(401);
    const res = await call(expireRoute, "/api/cron/expire-reservations", {
      method: "POST",
      headers: { "x-cron-secret": "test-cron-secret" },
    });
    expect(res.status).toBe(200);
    expect(res.body.cancelled).toBeGreaterThanOrEqual(1);

    const statuses = await prisma.order.findMany({ where: { id: { in: [stale.id, fresh.id, confirmed.id] } }, orderBy: { number: "asc" } });
    expect(statuses.map((o) => o.status)).toEqual(["CANCELLED", "NEW", "CONFIRMED"]);
    expect(await counters(variant.id)).toEqual([3, 2]);
  });
});
