import { describe, expect, it } from "vitest";
import {
  reconcile,
  type ReconcileInput,
  type ReconcileLine,
  type ReconcileOrder,
  type ReconcileRemittance,
} from "@/server/domain/reconcile";

let seq = 1000;
function order(o: Partial<ReconcileOrder> = {}): ReconcileOrder {
  seq += 1;
  return {
    id: `o${seq}`,
    number: seq,
    courierId: "c1",
    status: "DELIVERED",
    currency: "USD",
    usdLbpRate: "89500",
    codMinor: 2500n,
    reportedUsdCents: null,
    reportedLbp: null,
    deliveredAt: new Date("2026-10-10T12:00:00Z"),
    ...o,
  };
}

function line(o: ReconcileOrder, l: Partial<Omit<ReconcileLine, "order">> = {}): ReconcileLine {
  return { remittanceId: "r1", courierId: o.courierId ?? "c1", collectedUsdCents: 0n, collectedLbp: 0n, feeMinor: 0n, order: o, ...l };
}

function remittance(r: Partial<ReconcileRemittance> = {}): ReconcileRemittance {
  return { id: "r1", courierId: "c1", amountUsdCents: 0n, amountLbp: 0n, receivedAt: new Date("2026-10-12"), reference: null, ...r };
}

function run(input: Partial<ReconcileInput>) {
  return reconcile({
    currency: "USD",
    rate: "89500",
    toleranceMinor: 0n,
    asOf: new Date("2026-10-20T12:00:00Z"),
    delivered: [],
    remittances: [],
    lines: [],
    ...input,
  });
}

describe("reconcile", () => {
  it("settles an order paid exactly", () => {
    const o = order();
    const result = run({
      delivered: [o],
      lines: [line(o, { collectedUsdCents: 2500n })],
      remittances: [remittance({ amountUsdCents: 2500n })],
    });
    const [c] = result.couriers;
    expect(c.settled).toEqual([{ orderId: o.id, number: o.number, dueMinor: 2500n, paidMinor: 2500n }]);
    expect(c).toMatchObject({ expectedMinor: 2500n, receivedMinor: 2500n, shortOrOver: [], unpaid: [], remittanceGaps: [] });
    expect(result.totals).toEqual({
      expectedMinor: 2500n,
      received: { usdCents: 2500n, lbp: 0n },
      receivedMinor: 2500n,
      gaps: { count: 0, sumMinor: 0n },
    });
  });

  it("flags an order short by 5 cents, unless the tolerance covers it", () => {
    const o = order();
    const input = { delivered: [o], lines: [line(o, { collectedUsdCents: 2495n })] };
    const short = run(input).couriers[0];
    expect(short.shortOrOver).toEqual([
      { orderId: o.id, number: o.number, dueMinor: 2500n, reportedMinor: null, paidMinor: 2495n, diffMinor: -5n },
    ]);
    expect(short.gaps).toEqual({ count: 1, sumMinor: 5n });

    const tolerated = run({ ...input, toleranceMinor: 5n }).couriers[0];
    expect(tolerated.shortOrOver).toEqual([]);
    expect(tolerated.settled).toHaveLength(1);
  });

  it("flags over-collection as a positive difference", () => {
    const o = order();
    const c = run({ delivered: [o], lines: [line(o, { collectedUsdCents: 3000n })] }).couriers[0];
    expect(c.shortOrOver[0].diffMinor).toBe(500n);
    expect(c.gaps).toEqual({ count: 1, sumMinor: 500n });
  });

  it("takes the courier fee out of the hand-over, not out of what the customer owed", () => {
    const o = order();
    const feeKept = run({
      delivered: [o],
      lines: [line(o, { collectedUsdCents: 2500n, feeMinor: 300n })],
      remittances: [remittance({ amountUsdCents: 2200n })],
    }).couriers[0];
    expect(feeKept.settled[0]).toMatchObject({ dueMinor: 2500n, paidMinor: 2500n });
    expect(feeKept.remittanceGaps).toEqual([]);

    const feeNotKept = run({
      delivered: [o],
      lines: [line(o, { collectedUsdCents: 2500n, feeMinor: 300n })],
      remittances: [remittance({ amountUsdCents: 2500n })],
    }).couriers[0];
    expect(feeNotKept.settled).toHaveLength(1);
    expect(feeNotKept.remittanceGaps[0].diffMinor).toBe(300n);
  });

  it("lists delivered orders not yet paid with days outstanding (partial remittance)", () => {
    const paid = order();
    const owed = order({ codMinor: 4000n, deliveredAt: new Date("2026-10-15T18:00:00Z") });
    const c = run({
      delivered: [paid, owed],
      lines: [line(paid, { collectedUsdCents: 2500n })],
      remittances: [remittance({ amountUsdCents: 2500n })],
    }).couriers[0];
    expect(c.expectedMinor).toBe(6500n);
    expect(c.settled).toHaveLength(1);
    expect(c.unpaid).toEqual([
      { orderId: owed.id, number: owed.number, dueMinor: 4000n, deliveredAt: owed.deliveredAt, daysOutstanding: 4 },
    ]);
    expect(c.gaps).toEqual({ count: 1, sumMinor: 4000n });
  });

  it("flags cash paid for an order that was later returned", () => {
    const returned = order({ status: "RETURNED", deliveredAt: null });
    const result = run({
      lines: [line(returned, { collectedUsdCents: 2500n })],
      remittances: [remittance({ amountUsdCents: 2500n })],
    });
    const c = result.couriers[0];
    expect(c.expectedMinor).toBe(0n);
    expect(c.settled).toEqual([]);
    expect(c.notDeliveredButPaid).toEqual([{ orderId: returned.id, number: returned.number, status: "RETURNED", paidMinor: 2500n }]);
    expect(result.totals.gaps).toEqual({ count: 1, sumMinor: 2500n });
  });

  it("returns nothing for an empty period", () => {
    expect(run({})).toEqual({
      couriers: [],
      totals: { expectedMinor: 0n, received: { usdCents: 0n, lbp: 0n }, receivedMinor: 0n, gaps: { count: 0, sumMinor: 0n } },
    });
  });

  it("converts pounds at the order's frozen rate on a USD shop, within tolerance", () => {
    const o = order({ usdLbpRate: "89500" });
    // $20 + 447,500 LBP is exactly $25 at 89,500.
    const exact = run({ rate: "90000", delivered: [o], lines: [line(o, { collectedUsdCents: 2000n, collectedLbp: 447_500n })] });
    expect(exact.couriers[0].settled[0].paidMinor).toBe(2500n);

    // 450,000 LBP of change rounds to $5.03: 3 cents over.
    const rounded = { delivered: [o], lines: [line(o, { collectedUsdCents: 2000n, collectedLbp: 450_000n })] };
    expect(run(rounded).couriers[0].shortOrOver[0].diffMinor).toBe(3n);
    expect(run({ ...rounded, toleranceMinor: 5n }).couriers[0].settled).toHaveLength(1);
  });

  it("converts dollars on an LBP shop, within tolerance", () => {
    const o = order({ currency: "LBP", codMinor: 2_240_000n });
    // $20 + 447,500 LBP = 2,237,500 LBP: 2,500 short.
    const input = {
      currency: "LBP" as const,
      delivered: [o],
      lines: [line(o, { collectedUsdCents: 2000n, collectedLbp: 447_500n })],
    };
    expect(run({ ...input, toleranceMinor: 5_000n }).couriers[0].settled).toHaveLength(1);
    const c = run({ ...input, toleranceMinor: 1_000n }).couriers[0];
    expect(c.shortOrOver[0]).toMatchObject({ paidMinor: 2_237_500n, diffMinor: -2_500n });
  });

  it("uses the shop's rate for an order placed before the rate was set", () => {
    const o = order({ usdLbpRate: null });
    const c = run({ delivered: [o], lines: [line(o, { collectedLbp: 2_237_500n })] }).couriers[0];
    expect(c.settled[0].paidMinor).toBe(2500n);
  });

  it("finds a remittance whose total differs from its lines", () => {
    const a = order();
    const b = order();
    const c = run({
      delivered: [a, b],
      lines: [line(a, { collectedUsdCents: 2500n }), line(b, { collectedUsdCents: 2500n })],
      remittances: [remittance({ amountUsdCents: 4500n, reference: "TT-17" })],
    }).couriers[0];
    expect(c.remittanceGaps).toEqual([{ remittanceId: "r1", receivedAt: new Date("2026-10-12"), reference: "TT-17", diffMinor: -500n }]);
    // A hand-over gap is not one of the order-level "COD gaps found".
    expect(c.gaps.count).toBe(0);
  });

  it("matches a remittance paid in pounds whatever the shop's rate is now", () => {
    const o = order({ usdLbpRate: "89500" });
    const c = run({
      rate: "100000",
      delivered: [o],
      lines: [line(o, { collectedUsdCents: 2000n, collectedLbp: 447_500n, feeMinor: 300n })],
      // The courier kept their $3 fee out of the dollars.
      remittances: [remittance({ amountUsdCents: 1700n, amountLbp: 447_500n })],
    }).couriers[0];
    expect(c.remittanceGaps).toEqual([]);
    expect(c.received).toEqual({ usdCents: 1700n, lbp: 447_500n });
    expect(c.receivedMinor).toBe(1700n + 448n);
  });

  it("reports a doorstep gap between what was due and what the courier reported", () => {
    const o = order({ reportedUsdCents: 2000n });
    const fine = order({ reportedUsdCents: 2000n, reportedLbp: 447_500n });
    const c = run({ delivered: [o, fine], lines: [line(o, { collectedUsdCents: 2000n })] }).couriers[0];
    expect(c.doorstepGaps).toEqual([
      { orderId: o.id, number: o.number, dueMinor: 2500n, reportedMinor: 2000n, paidMinor: 2000n, diffMinor: -500n },
    ]);
    expect(c.shortOrOver[0]).toMatchObject({ reportedMinor: 2000n, paidMinor: 2000n });
    expect(c.unpaid.map((u) => u.orderId)).toEqual([fine.id]);
  });

  it("keeps couriers apart and adds them up", () => {
    const a = order({ courierId: "c1" });
    const b = order({ courierId: "c2", codMinor: 1000n });
    const mine = order({ courierId: null });
    const result = run({
      delivered: [a, b, mine],
      lines: [line(a, { collectedUsdCents: 2500n }), line(b, { remittanceId: "r2", collectedUsdCents: 900n })],
      remittances: [remittance({ amountUsdCents: 2500n }), remittance({ id: "r2", courierId: "c2", amountUsdCents: 900n })],
    });
    expect(result.couriers.map((c) => [c.courierId, c.expectedMinor, c.receivedMinor, c.gaps.count])).toEqual([
      ["c1", 2500n, 2500n, 0],
      ["c2", 1000n, 900n, 1],
    ]);
    expect(result.totals).toMatchObject({ expectedMinor: 3500n, receivedMinor: 3400n, gaps: { count: 1, sumMinor: 100n } });
  });

  it("counts a line once when both queries return it", () => {
    const o = order();
    const l = line(o, { collectedUsdCents: 2500n });
    const c = run({ delivered: [o], lines: [l, { ...l }], remittances: [remittance({ amountUsdCents: 2500n })] }).couriers[0];
    expect(c.settled).toHaveLength(1);
    expect(c.remittanceGaps).toEqual([]);
  });
});
