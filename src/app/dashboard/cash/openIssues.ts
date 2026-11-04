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
  /** Null when the row carries no such figure: an order paid but not delivered has no amount due, and "reported" is only known when the courier entered one. */
  dueMinor: bigint | null;
  reportedMinor: bigint | null;
  paidMinor: bigint | null;
  /** Due minus paid: negative when more was paid than due. */
  remainingMinor: bigint | null;
};

export type RemittanceIssue = Lists["remittanceGaps"][number] & { courierId: string };

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
      found = { orderId: row.orderId, number: row.number, courierId, dueMinor: null, reportedMinor: null, paidMinor: null, remainingMinor: null };
      byOrder.set(row.orderId, found);
    }
    return found;
  };

  for (const c of couriers) for (const r of c.shortOrOver) issue(c.courierId, r).shortOrOver = r;
  for (const c of couriers) for (const r of c.notDeliveredButPaid) issue(c.courierId, r).mismatch = r;
  for (const c of couriers) for (const r of c.unpaid) issue(c.courierId, r).unpaid = r;
  for (const c of couriers) for (const r of c.doorstepGaps) issue(c.courierId, r).doorstep = r;

  const orders = [...byOrder.values()].map((o) => {
    const dueMinor = o.shortOrOver?.dueMinor ?? o.unpaid?.dueMinor ?? o.doorstep?.dueMinor ?? null;
    const paidMinor = o.shortOrOver?.paidMinor ?? o.mismatch?.paidMinor ?? o.doorstep?.paidMinor ?? null;
    return {
      ...o,
      dueMinor,
      paidMinor,
      reportedMinor: o.shortOrOver?.reportedMinor ?? o.doorstep?.reportedMinor ?? null,
      remainingMinor: dueMinor === null ? null : dueMinor - (paidMinor ?? 0n),
    };
  });

  const byRemittance = new Map<string, RemittanceIssue>();
  for (const c of couriers) for (const r of c.remittanceGaps) byRemittance.set(r.remittanceId, { ...r, courierId: c.courierId });
  const remittances = [...byRemittance.values()];

  return { orders, remittances, count: orders.length + remittances.length };
}
