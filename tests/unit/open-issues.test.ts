import { describe, expect, it } from "vitest";
import { openIssues } from "@/app/dashboard/cash/openIssues";

const empty = { courierId: "c1", shortOrOver: [], notDeliveredButPaid: [], unpaid: [], doorstepGaps: [], remittanceGaps: [] };
const ref = { orderId: "o1", number: 1001 };
const unpaid = { ...ref, dueMinor: 5000n, deliveredAt: new Date("2026-11-01"), daysOutstanding: 2 };
const doorstep = { ...ref, dueMinor: 5000n, reportedMinor: 4000n, paidMinor: null, diffMinor: -1000n };
const short = { ...ref, dueMinor: 5000n, reportedMinor: 5000n, paidMinor: 4000n, diffMinor: -1000n };
const gap = { remittanceId: "r1", receivedAt: new Date("2026-11-02"), reference: null, diffMinor: -1000n };

describe("openIssues", () => {
  it("is empty when nothing is wrong", () => {
    expect(openIssues([empty]).count).toBe(0);
  });

  it("counts an order on several lists once and keeps both reasons", () => {
    const { orders, count } = openIssues([{ ...empty, unpaid: [unpaid], doorstepGaps: [doorstep] }]);
    expect(count).toBe(1);
    expect(orders[0].unpaid).toBe(unpaid);
    expect(orders[0].doorstep).toBe(doorstep);
    expect(orders[0].reportedMinor).toBe(4000n);
    expect(orders[0].remainingMinor).toBe(5000n);
  });

  it("merges an order across couriers", () => {
    const issues = openIssues([
      { ...empty, courierId: "paid-by", shortOrOver: [short] },
      { ...empty, courierId: "delivered-by", doorstepGaps: [{ ...doorstep, paidMinor: 4000n }] },
    ]);
    expect(issues.count).toBe(1);
    expect(issues.orders[0].courierId).toBe("paid-by");
    expect(issues.orders[0].remainingMinor).toBe(1000n);
  });

  it("counts a remittance gap with $0 in the COD gap figure", () => {
    const { remittances, count } = openIssues([{ ...empty, remittanceGaps: [gap] }]);
    expect(count).toBe(1);
    expect(remittances[0].courierId).toBe("c1");
  });

  it("adds unique orders and unique remittances together", () => {
    const other = { ...unpaid, orderId: "o2", number: 1002 };
    const { count } = openIssues([{ ...empty, unpaid: [unpaid, other], doorstepGaps: [doorstep], remittanceGaps: [gap, { ...gap, remittanceId: "r2" }] }]);
    expect(count).toBe(4);
  });

  it("has no amount due for an order paid but not delivered", () => {
    const { orders } = openIssues([{ ...empty, notDeliveredButPaid: [{ ...ref, status: "RETURNED", paidMinor: 3000n }] }]);
    expect(orders[0].dueMinor).toBeNull();
    expect(orders[0].paidMinor).toBe(3000n);
    expect(orders[0].remainingMinor).toBeNull();
  });
});
