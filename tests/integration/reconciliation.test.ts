import { beforeAll, describe, expect, it } from "vitest";
import { POST as createRemittance } from "@/app/api/remittances/route";
import { GET as reconciliation } from "@/app/api/reconciliation/route";
import { GET as unsettled } from "@/app/api/reconciliation/unsettled/route";
import { seedCourier, seedOrder, seedVariant } from "./fixtures";
import { addMember, call, resetDb, signUpOwner } from "./helpers";

const DAY = 86_400_000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY);
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

// One shop, two couriers, every kind of problem the reconciliation screen shows.
describe("reconciliation", () => {
  let owner: Awaited<ReturnType<typeof signUpOwner>>;
  let toters: string;
  let wakilni: string;
  const o: Record<string, { id: string; number: number }> = {};

  beforeAll(async () => {
    await resetDb();
    owner = await signUpOwner({ usdLbpRate: "89500" });
    const shopId = owner.shop.id;
    toters = (await seedCourier(shopId, { name: "Toters" })).id;
    wakilni = (await seedCourier(shopId, { name: "Wakilni" })).id;
    const { variant } = await seedVariant(shopId, { priceMinor: 2500n, available: 50 });
    const delivered = (courierId: string, days: number, extra = {}) =>
      seedOrder(shopId, { variantId: variant.id, status: "DELIVERED", courierId, deliveredAt: daysAgo(days), ...extra });

    o.paid = await delivered(toters, 2);
    o.short = await delivered(toters, 2);
    o.unpaid = await delivered(toters, 3 + 1 / 24);
    o.returned = await seedOrder(shopId, { variantId: variant.id, status: "RETURNED", courierId: toters });
    o.doorstep = await delivered(wakilni, 1, { reportedUsdCents: 2000n });
    o.old = await delivered(toters, 60);

    const res = await call(createRemittance, "/api/remittances", {
      method: "POST",
      cookie: owner.cookie,
      body: {
        courierId: toters,
        receivedAt: isoDay(new Date()),
        amountUsd: "69.00",
        reference: "TT-17",
        lines: [
          { orderId: o.paid.id, collectedUsd: "25" },
          { orderId: o.short.id, collectedUsd: "20" },
          { orderId: o.returned.id, collectedUsd: "25" },
        ],
      },
    });
    expect(res.status).toBe(201);
  });

  it("returns each courier's expected cash, what came in and every gap", async () => {
    const res = await call(reconciliation, "/api/reconciliation", { cookie: owner.cookie });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ currency: "USD", toleranceMinor: 0, to: isoDay(new Date()) });

    const [t, w] = res.body.couriers;
    expect(t).toMatchObject({
      courierId: toters,
      courierName: "Toters",
      expectedMinor: 7500,
      received: { usdCents: 6900, lbp: 0 },
      receivedMinor: 6900,
      settled: [{ orderId: o.paid.id, number: o.paid.number, dueMinor: 2500, paidMinor: 2500 }],
      shortOrOver: [{ orderId: o.short.id, dueMinor: 2500, reportedMinor: null, paidMinor: 2000, diffMinor: -500 }],
      unpaid: [{ orderId: o.unpaid.id, dueMinor: 2500, daysOutstanding: 3 }],
      notDeliveredButPaid: [{ orderId: o.returned.id, status: "RETURNED", paidMinor: 2500 }],
      remittanceGaps: [{ reference: "TT-17", diffMinor: -100 }],
      doorstepGaps: [],
      gaps: { count: 3, sumMinor: 5500 },
    });
    expect(w).toMatchObject({
      courierName: "Wakilni",
      expectedMinor: 2500,
      receivedMinor: 0,
      unpaid: [{ orderId: o.doorstep.id }],
      doorstepGaps: [{ orderId: o.doorstep.id, dueMinor: 2500, reportedMinor: 2000, paidMinor: null, diffMinor: -500 }],
      gaps: { count: 1, sumMinor: 2500 },
    });
    expect(res.body.totals).toEqual({
      expectedMinor: 10000,
      received: { usdCents: 6900, lbp: 0 },
      receivedMinor: 6900,
      gaps: { count: 4, sumMinor: 8000 },
    });
  });

  it("filters by courier and by dates", async () => {
    const one = await call(reconciliation, `/api/reconciliation?courierId=${wakilni}`, { cookie: owner.cookie });
    expect(one.body.couriers.map((c: { courierName: string }) => c.courierName)).toEqual(["Wakilni"]);

    const day = isoDay(daysAgo(60));
    const past = await call(reconciliation, `/api/reconciliation?from=${day}&to=${day}`, { cookie: owner.cookie });
    expect(past.body.couriers).toHaveLength(1);
    expect(past.body.couriers[0]).toMatchObject({ courierId: toters, expectedMinor: 2500, unpaid: [{ orderId: o.old.id }] });
    expect(past.body.totals.receivedMinor).toBe(0);

    const backwards = await call(reconciliation, `/api/reconciliation?from=${isoDay(new Date())}&to=${day}`, { cookie: owner.cookie });
    expect(backwards.status).toBe(400);
  });

  it("lists a courier's delivered orders that are not paid for yet, oldest first", async () => {
    const t = await call(unsettled, `/api/reconciliation/unsettled?courierId=${toters}`, { cookie: owner.cookie });
    expect(t.status).toBe(200);
    expect(t.body.map((r: { id: string }) => r.id)).toEqual([o.old.id, o.unpaid.id]);
    expect(t.body[1]).toMatchObject({ number: o.unpaid.number, codMinor: 2500, currency: "USD", reportedUsdCents: null });

    const w = await call(unsettled, `/api/reconciliation/unsettled?courierId=${wakilni}`, { cookie: owner.cookie });
    expect(w.body).toEqual([expect.objectContaining({ id: o.doorstep.id, codMinor: 2500, reportedUsdCents: 2000 })]);

    expect((await call(unsettled, "/api/reconciliation/unsettled", { cookie: owner.cookie })).status).toBe(400);
  });

  it("is for owners and managers only", async () => {
    const manager = await addMember(owner.shop.id, "manager");
    expect((await call(reconciliation, "/api/reconciliation", { cookie: manager.cookie })).status).toBe(200);
    for (const role of ["staff", "delivery"]) {
      const member = await addMember(owner.shop.id, role, role === "delivery" ? toters : undefined);
      expect((await call(reconciliation, "/api/reconciliation", { cookie: member.cookie })).status).toBe(403);
      const res = await call(unsettled, `/api/reconciliation/unsettled?courierId=${toters}`, { cookie: member.cookie });
      expect(res.status).toBe(403);
    }
  });

  it("shows another shop nothing of this shop's couriers or cash", async () => {
    const other = await signUpOwner();
    const byCourier = await call(reconciliation, `/api/reconciliation?courierId=${toters}`, { cookie: other.cookie });
    expect(byCourier.status).toBe(404);
    const list = await call(unsettled, `/api/reconciliation/unsettled?courierId=${toters}`, { cookie: other.cookie });
    expect(list.status).toBe(404);
    expect(JSON.stringify(list.body)).not.toContain(o.unpaid.id);

    const own = await call(reconciliation, "/api/reconciliation", { cookie: other.cookie });
    expect(own.body.couriers).toEqual([]);
    expect(own.body.totals).toMatchObject({ expectedMinor: 0, gaps: { count: 0, sumMinor: 0 } });
  });
});
