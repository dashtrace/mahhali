import { beforeAll, describe, expect, it } from "vitest";
import { GET as listRemittances, POST as createRemittance } from "@/app/api/remittances/route";
import { prisma } from "@/server/db";
import { seedCourier, seedOrder, seedVariant } from "./fixtures";
import { addMember, call, resetDb, signUpOwner } from "./helpers";

beforeAll(resetDb);

async function shopWithCourier(opts: { currency?: string; usdLbpRate?: string } = {}) {
  const owner = await signUpOwner(opts);
  const courier = await seedCourier(owner.shop.id);
  const { variant } = await seedVariant(owner.shop.id, { available: 50 });
  const deliveredOrder = (courierId = courier.id) =>
    seedOrder(owner.shop.id, { variantId: variant.id, status: "DELIVERED", courierId });
  return { owner, courier, variant, deliveredOrder };
}

const post = (cookie: string, body: unknown) => call(createRemittance, "/api/remittances", { method: "POST", cookie, body });

describe("remittances", () => {
  it("records a remittance with its lines, in dollars and pounds", async () => {
    const { owner, courier, deliveredOrder } = await shopWithCourier({ usdLbpRate: "89500" });
    const a = await deliveredOrder();
    const b = await deliveredOrder();
    const res = await post(owner.cookie, {
      courierId: courier.id,
      receivedAt: "2026-10-20",
      amountUsd: "42.00",
      amountLbp: "447500",
      reference: "TT-001",
      lines: [
        { orderId: a.id, collectedUsd: "25" },
        { orderId: b.id, collectedUsd: "20", collectedLbp: "447500", fee: "3" },
      ],
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      courierId: courier.id,
      amountUsdCents: 4200,
      amountLbp: 447500,
      reference: "TT-001",
      recordedByUserId: owner.user.id,
    });
    expect(res.body.lines).toEqual([
      expect.objectContaining({ orderId: a.id, order: { number: a.number }, collectedUsdCents: 2500, collectedLbp: 0, feeMinor: 0 }),
      expect.objectContaining({ orderId: b.id, order: { number: b.number }, collectedUsdCents: 2000, collectedLbp: 447500, feeMinor: 300 }),
    ]);
    expect(await prisma.remittanceLine.count({ where: { shopId: owner.shop.id } })).toBe(2);
  });

  it("lists remittances newest first with their lines, filtered by courier and dates", async () => {
    const { owner, courier, deliveredOrder } = await shopWithCourier();
    const other = await seedCourier(owner.shop.id, { name: "Wakilni" });
    const [a, b, c] = [await deliveredOrder(), await deliveredOrder(), await deliveredOrder(other.id)];
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    await post(owner.cookie, { courierId: courier.id, receivedAt: yesterday, amountUsd: "25", lines: [{ orderId: a.id, collectedUsd: "25" }] });
    await post(owner.cookie, { courierId: courier.id, receivedAt: today, amountUsd: "25", lines: [{ orderId: b.id, collectedUsd: "25" }] });
    await post(owner.cookie, { courierId: other.id, receivedAt: today, amountUsd: "25", lines: [{ orderId: c.id, collectedUsd: "25" }] });

    const res = await call(listRemittances, `/api/remittances?courierId=${courier.id}`, { cookie: owner.cookie });
    expect(res.status).toBe(200);
    expect(res.body.to).toBe(today);
    expect(res.body.remittances.map((r: { lines: { order: { number: number } }[] }) => r.lines[0].order.number)).toEqual([
      b.number,
      a.number,
    ]);

    const onlyToday = await call(listRemittances, `/api/remittances?from=${today}&to=${today}`, { cookie: owner.cookie });
    expect(onlyToday.body.remittances).toHaveLength(2);
  });

  it("refuses orders assigned to another courier", async () => {
    const { owner, courier, deliveredOrder } = await shopWithCourier();
    const other = await seedCourier(owner.shop.id, { name: "Wakilni" });
    const theirs = await deliveredOrder(other.id);
    const res = await post(owner.cookie, {
      courierId: courier.id,
      receivedAt: "2026-10-20",
      amountUsd: "25",
      lines: [{ orderId: theirs.id, collectedUsd: "25" }],
    });
    expect(res.status).toBe(422);
    expect(res.body.error).toMatchObject({ code: "WRONG_COURIER", details: { orders: [theirs.number] } });
    expect(await prisma.remittance.count({ where: { shopId: owner.shop.id } })).toBe(0);
  });

  it("settles an order's cash only once, even when two remittances race", async () => {
    const { owner, courier, deliveredOrder } = await shopWithCourier();
    const order = await deliveredOrder();
    const body = { courierId: courier.id, receivedAt: "2026-10-20", amountUsd: "25", lines: [{ orderId: order.id, collectedUsd: "25" }] };
    expect((await post(owner.cookie, body)).status).toBe(201);
    const again = await post(owner.cookie, body);
    expect(again.status).toBe(409);
    expect(again.body.error).toMatchObject({ code: "ALREADY_SETTLED", details: { orders: [order.number] } });

    const fresh = await deliveredOrder();
    const racing = { ...body, lines: [{ orderId: fresh.id, collectedUsd: "25" }] };
    const results = await Promise.all([post(owner.cookie, racing), post(owner.cookie, racing)]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await prisma.remittanceLine.count({ where: { orderId: fresh.id } })).toBe(1);
  });

  it("refuses pounds when the shop has no exchange rate, and cents in pound fees", async () => {
    const usd = await shopWithCourier();
    const o = await usd.deliveredOrder();
    const noRate = await post(usd.owner.cookie, {
      courierId: usd.courier.id,
      receivedAt: "2026-10-20",
      amountLbp: "2237500",
      lines: [{ orderId: o.id, collectedLbp: "2237500" }],
    });
    expect(noRate.status).toBe(422);
    expect(noRate.body.error.code).toBe("RATE_MISSING");

    const lbp = await shopWithCourier({ currency: "LBP", usdLbpRate: "89500" });
    const p = await lbp.deliveredOrder();
    const res = await post(lbp.owner.cookie, {
      courierId: lbp.courier.id,
      receivedAt: "2026-10-20",
      amountLbp: "2000000",
      lines: [{ orderId: p.id, collectedLbp: "2237500", fee: "100.5" }],
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("INVALID_AMOUNT");
  });

  it("validates the body", async () => {
    const { owner, courier, deliveredOrder } = await shopWithCourier();
    const o = await deliveredOrder();
    const line = { orderId: o.id, collectedUsd: "25" };
    const base = { courierId: courier.id, receivedAt: "2026-10-20", amountUsd: "25" };
    expect((await post(owner.cookie, { ...base, lines: [line, line] })).status).toBe(400);
    expect((await post(owner.cookie, { ...base, lines: [] })).status).toBe(400);
    expect((await post(owner.cookie, { ...base, receivedAt: "20/10/2026", lines: [line] })).status).toBe(400);
    expect((await post(owner.cookie, { ...base, amountUsd: "-5", lines: [line] })).status).toBe(400);
  });

  it("lets a manager record, but not staff or delivery users", async () => {
    const { owner, courier, deliveredOrder } = await shopWithCourier();
    const o = await deliveredOrder();
    const body = { courierId: courier.id, receivedAt: "2026-10-20", amountUsd: "25", lines: [{ orderId: o.id, collectedUsd: "25" }] };
    for (const role of ["staff", "delivery"]) {
      const member = await addMember(owner.shop.id, role, role === "delivery" ? courier.id : undefined);
      expect((await post(member.cookie, body)).status).toBe(403);
      expect((await call(listRemittances, "/api/remittances", { cookie: member.cookie })).status).toBe(403);
    }
    const manager = await addMember(owner.shop.id, "manager");
    expect((await post(manager.cookie, body)).status).toBe(201);
  });

  it("never touches another shop's couriers or orders", async () => {
    const a = await shopWithCourier();
    const b = await shopWithCourier();
    const ordersB = await b.deliveredOrder();
    const ordersA = await a.deliveredOrder();
    const base = { receivedAt: "2026-10-20", amountUsd: "25" };

    // A's courier with B's order, and B's courier with A's order: both look missing.
    const withBOrder = await post(a.owner.cookie, { ...base, courierId: a.courier.id, lines: [{ orderId: ordersB.id, collectedUsd: "25" }] });
    expect(withBOrder.status).toBe(404);
    const withBCourier = await post(a.owner.cookie, { ...base, courierId: b.courier.id, lines: [{ orderId: ordersA.id, collectedUsd: "25" }] });
    expect(withBCourier.status).toBe(404);
    expect(await prisma.remittanceLine.count({ where: { orderId: { in: [ordersA.id, ordersB.id] } } })).toBe(0);

    await post(b.owner.cookie, { ...base, courierId: b.courier.id, lines: [{ orderId: ordersB.id, collectedUsd: "25" }] });
    expect((await call(listRemittances, `/api/remittances?courierId=${b.courier.id}`, { cookie: a.owner.cookie })).status).toBe(404);
    const listA = await call(listRemittances, "/api/remittances", { cookie: a.owner.cookie });
    expect(listA.body.remittances).toEqual([]);
  });
});
