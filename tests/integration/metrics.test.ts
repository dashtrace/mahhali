import { beforeAll, describe, expect, it } from "vitest";
import { GET as metrics } from "@/app/api/metrics/route";
import { prisma } from "@/server/db";
import { seedCourier, seedOrder, seedVariant } from "./fixtures";
import { addMember, call, resetDb, signUpOwner } from "./helpers";

const at = (iso: string, plusMinutes = 0) => new Date(Date.parse(iso) + plusMinutes * 60_000);
const range = "from=2026-10-01&to=2026-10-02";

describe("metrics", () => {
  let owner: Awaited<ReturnType<typeof signUpOwner>>;

  beforeAll(async () => {
    await resetDb();
    owner = await signUpOwner();
    const shopId = owner.shop.id;
    await prisma.shop.update({ where: { id: shopId }, data: { baselineOrdersPerDay: 3, baselineConfirmMinutes: 90 } });
    const courier = await seedCourier(shopId);
    const { variant } = await seedVariant(shopId, { available: 50 });
    const order = (status: "NEW" | "CONFIRMED" | "CANCELLED" | "DELIVERED", created: string, confirmAfter: number | null, extra = {}) =>
      seedOrder(shopId, {
        variantId: variant.id,
        status,
        createdAt: at(created),
        confirmedAt: confirmAfter === null ? null : at(created, confirmAfter),
        ...extra,
      });

    await order("CONFIRMED", "2026-10-01T09:00:00Z", 10);
    await order("CONFIRMED", "2026-10-01T12:00:00Z", 30);
    await order("NEW", "2026-10-02T08:00:00Z", null);
    await order("CANCELLED", "2026-10-02T09:00:00Z", null);
    // Delivered and never paid for: one COD gap.
    await order("DELIVERED", "2026-10-02T10:00:00Z", 20, { courierId: courier.id, deliveredAt: at("2026-10-02T18:00:00Z") });
    // Outside the range.
    await order("CONFIRMED", "2026-10-05T10:00:00Z", 500);
  });

  it("reports confirmation time, orders per day, statuses, COD gaps and the baseline", async () => {
    const res = await call(metrics, `/api/metrics?${range}`, { cookie: owner.cookie });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      from: "2026-10-01",
      to: "2026-10-02",
      medianConfirmMinutes: 20,
      ordersPerDay: 2.5,
      ordersByStatus: { NEW: 1, CONFIRMED: 2, PACKED: 0, OUT_FOR_DELIVERY: 0, DELIVERED: 1, CANCELLED: 1, RETURNED: 0 },
      codGaps: { count: 1, sumMinor: 2500 },
      baseline: { ordersPerDay: 3, confirmMinutes: 90 },
    });
  });

  it("has no median without confirmations, and defaults to the last 30 days", async () => {
    const res = await call(metrics, "/api/metrics?from=2026-10-03&to=2026-10-04", { cookie: owner.cookie });
    expect(res.body).toMatchObject({ medianConfirmMinutes: null, ordersPerDay: 0, codGaps: { count: 0, sumMinor: 0 } });

    const recent = await call(metrics, "/api/metrics", { cookie: owner.cookie });
    expect(recent.status).toBe(200);
    expect(recent.body.to).toBe(new Date().toISOString().slice(0, 10));
  });

  it("refuses a range that runs backwards or is not a date", async () => {
    expect((await call(metrics, "/api/metrics?from=2026-10-05&to=2026-10-01", { cookie: owner.cookie })).status).toBe(400);
    expect((await call(metrics, "/api/metrics?from=yesterday", { cookie: owner.cookie })).status).toBe(400);
  });

  it("is for owners and managers only", async () => {
    const manager = await addMember(owner.shop.id, "manager");
    expect((await call(metrics, `/api/metrics?${range}`, { cookie: manager.cookie })).status).toBe(200);
    for (const role of ["staff", "delivery"]) {
      const member = await addMember(owner.shop.id, role);
      expect((await call(metrics, `/api/metrics?${range}`, { cookie: member.cookie })).status).toBe(403);
    }
  });

  it("counts only the signed-in shop's orders", async () => {
    const other = await signUpOwner();
    const res = await call(metrics, `/api/metrics?${range}`, { cookie: other.cookie });
    expect(res.body).toMatchObject({ medianConfirmMinutes: null, ordersPerDay: 0, codGaps: { count: 0, sumMinor: 0 } });
    expect(Object.values(res.body.ordersByStatus).every((n) => n === 0)).toBe(true);
  });
});
