import type { CourierReconciliation } from "@/server/domain/reconcile";

type Lists = Pick<CourierReconciliation, "courierId" | "shortOrOver" | "notDeliveredButPaid" | "unpaid" | "doorstepGaps" | "remittanceGaps">;

export type OrderIssue = {
  orderId: string;
  number: number;
  courierId: string;
  shortOrOver?: Lists["shortOrOver"][number];
  mismatch?: Lists["notDeliveredButPaid"][number];
  unpaid?: Lists["unpaid"][number];
  doorstep?: Lists["doorstepGaps"][number];
};

export type RemittanceIssue = Lists["remittanceGaps"][number] & { courierId: string };

/** A remittance whose own total matches can still pay an order short, over or not delivered: that isn't settled. */
export function hasUnsettledOrder(lines: { orderId: string }[], couriers: Pick<Lists, "shortOrOver" | "notDeliveredButPaid">[]) {
  const unsettled = new Set(couriers.flatMap((c) => [...c.shortOrOver, ...c.notDeliveredButPaid].map((r) => r.orderId)));
  return lines.some((l) => unsettled.has(l.orderId));
}

/**
 * Everything to look at, one entry per order and per remittance, worst first. One order can sit in
 * several lists (a doorstep gap that is also unpaid), so the lists are merged by order id. This is
 * not reconcile()'s `gaps`, which leaves doorstep and remittance differences out.
 */
export function openIssues(couriers: Lists[]) {
  const byOrder = new Map<string, OrderIssue>();
  const issue = (courierId: string, row: { orderId: string; number: number }) => {
    let found = byOrder.get(row.orderId);
    if (!found) {
      found = { orderId: row.orderId, number: row.number, courierId };
      byOrder.set(row.orderId, found);
    }
    return found;
  };

  for (const c of couriers) for (const r of c.shortOrOver) issue(c.courierId, r).shortOrOver = r;
  for (const c of couriers) for (const r of c.notDeliveredButPaid) issue(c.courierId, r).mismatch = r;
  for (const c of couriers) for (const r of c.unpaid) issue(c.courierId, r).unpaid = r;
  for (const c of couriers) for (const r of c.doorstepGaps) issue(c.courierId, r).doorstep = r;

  const orders = [...byOrder.values()];

  const byRemittance = new Map<string, RemittanceIssue>();
  for (const c of couriers) for (const r of c.remittanceGaps) byRemittance.set(r.remittanceId, { ...r, courierId: c.courierId });
  const remittances = [...byRemittance.values()];

  return { orders, remittances, count: orders.length + remittances.length };
}
