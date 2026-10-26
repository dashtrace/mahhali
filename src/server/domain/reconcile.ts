// Cash-on-delivery reconciliation: what each courier owes, what they handed
// over, and every order or remittance where the two disagree. Pure: the
// service loads the rows and passes "asOf" in.
// shortcut: amounts are added in the shop's currency as stored; a shop that switches currency mid-period gets mixed totals. Convert per order if switching becomes common.
import { collectedInOrderCurrency, type Currency } from "./money";
import type { OrderStatus } from "./orderStatus";

const DAY_MS = 86_400_000;

export type ReconcileOrder = {
  id: string;
  number: number;
  courierId: string | null;
  status: OrderStatus;
  currency: Currency;
  /** Frozen on the order; the shop's rate is used when it is empty. */
  usdLbpRate: string | null;
  codMinor: bigint;
  reportedUsdCents: bigint | null;
  reportedLbp: bigint | null;
  deliveredAt: Date | null;
};

export type ReconcileLine = {
  remittanceId: string;
  /** The courier who paid it (the remittance's courier). */
  courierId: string;
  collectedUsdCents: bigint;
  collectedLbp: bigint;
  /** Courier fee kept out of the hand-over, in the order currency. */
  feeMinor: bigint;
  order: ReconcileOrder;
};

export type ReconcileRemittance = {
  id: string;
  courierId: string;
  amountUsdCents: bigint;
  amountLbp: bigint;
  receivedAt: Date;
  reference: string | null;
};

export type ReconcileInput = {
  currency: Currency;
  /** The shop's current rate: converts remittance totals and orders without a frozen rate. */
  rate: string | null;
  /** Differences up to this much count as settled (change given in pounds). */
  toleranceMinor: bigint;
  asOf: Date;
  /** Orders delivered in the period. */
  delivered: ReconcileOrder[];
  /** Remittances received in the period. */
  remittances: ReconcileRemittance[];
  /** Every line of those remittances, plus any line that pays for a delivered order. */
  lines: ReconcileLine[];
};

type OrderRef = { orderId: string; number: number };
type Received = { usdCents: bigint; lbp: bigint };
type Gaps = { count: number; sumMinor: bigint };

export type CourierReconciliation = {
  courierId: string;
  /** COD due on the orders this courier delivered in the period. */
  expectedMinor: bigint;
  /** Cash in the remittances received in the period, as handed over and in the shop currency. */
  received: Received;
  receivedMinor: bigint;
  settled: (OrderRef & { dueMinor: bigint; paidMinor: bigint })[];
  /** diffMinor = paid - due: negative is short, positive is over. reported shows where it went wrong. */
  shortOrOver: (OrderRef & { dueMinor: bigint; reportedMinor: bigint | null; paidMinor: bigint; diffMinor: bigint })[];
  unpaid: (OrderRef & { dueMinor: bigint; deliveredAt: Date; daysOutstanding: number })[];
  /** Cash handed over for an order that is not Delivered, e.g. paid and later returned. */
  notDeliveredButPaid: (OrderRef & { status: OrderStatus; paidMinor: bigint })[];
  /** diffMinor = handed over - what the remittance's lines add up to (after fees). */
  remittanceGaps: { remittanceId: string; receivedAt: Date; reference: string | null; diffMinor: bigint }[];
  /** The courier reported a different amount at the door than was due (diffMinor = reported - due). */
  doorstepGaps: (OrderRef & { dueMinor: bigint; reportedMinor: bigint; paidMinor: bigint | null; diffMinor: bigint })[];
  /** "COD gaps found": short or over, unpaid and not-delivered-but-paid rows, and the money in them. */
  gaps: Gaps;
};

export type Reconciliation = {
  couriers: CourierReconciliation[];
  totals: { expectedMinor: bigint; received: Received; receivedMinor: bigint; gaps: Gaps };
};

const abs = (v: bigint) => (v < 0n ? -v : v);
const positive = (v: bigint) => (v > 0n ? v : 0n);

/** Signed dollars and pounds in `currency`; collectedInOrderCurrency only takes cash, so each sign is converted alone. */
function convert(usdCents: bigint, lbp: bigint, currency: Currency, rate: string | null): bigint {
  return (
    collectedInOrderCurrency({ usdCents: positive(usdCents), lbp: positive(lbp) }, currency, rate) -
    collectedInOrderCurrency({ usdCents: positive(-usdCents), lbp: positive(-lbp) }, currency, rate)
  );
}

export function reconcile(input: ReconcileInput): Reconciliation {
  const byCourier = new Map<string, CourierReconciliation>();
  const courier = (courierId: string) => {
    let c = byCourier.get(courierId);
    if (!c) {
      c = {
        courierId,
        expectedMinor: 0n,
        received: { usdCents: 0n, lbp: 0n },
        receivedMinor: 0n,
        settled: [],
        shortOrOver: [],
        unpaid: [],
        notDeliveredButPaid: [],
        remittanceGaps: [],
        doorstepGaps: [],
        gaps: { count: 0, sumMinor: 0n },
      };
      byCourier.set(courierId, c);
    }
    return c;
  };
  const inOrderCurrency = (usdCents: bigint, lbp: bigint, order: ReconcileOrder) =>
    convert(usdCents, lbp, order.currency, order.usdLbpRate ?? input.rate);
  const reportedOf = (order: ReconcileOrder) =>
    order.reportedUsdCents === null && order.reportedLbp === null
      ? null
      : inOrderCurrency(order.reportedUsdCents ?? 0n, order.reportedLbp ?? 0n, order);

  // One line per order (RemittanceLine.orderId is unique), whichever query found it.
  const lineByOrder = new Map(input.lines.map((l) => [l.order.id, l]));
  const paidByOrder = new Map<string, bigint>();

  for (const line of lineByOrder.values()) {
    const { order } = line;
    const c = courier(line.courierId);
    // What the customer paid at the door. The courier's fee comes out of the
    // hand-over (checked per remittance below), not out of what was due.
    const paidMinor = inOrderCurrency(line.collectedUsdCents, line.collectedLbp, order);
    paidByOrder.set(order.id, paidMinor);
    const ref = { orderId: order.id, number: order.number };
    if (order.status !== "DELIVERED") {
      c.notDeliveredButPaid.push({ ...ref, status: order.status, paidMinor });
      continue;
    }
    const diffMinor = paidMinor - order.codMinor;
    if (abs(diffMinor) <= input.toleranceMinor) {
      c.settled.push({ ...ref, dueMinor: order.codMinor, paidMinor });
    } else {
      c.shortOrOver.push({ ...ref, dueMinor: order.codMinor, reportedMinor: reportedOf(order), paidMinor, diffMinor });
    }
  }

  for (const order of input.delivered) {
    // Cash the shop collected itself is not a courier's debt.
    if (!order.courierId || !order.deliveredAt) continue;
    const c = courier(order.courierId);
    const ref = { orderId: order.id, number: order.number };
    c.expectedMinor += order.codMinor;
    if (!lineByOrder.has(order.id)) {
      const daysOutstanding = Math.max(0, Math.floor((input.asOf.getTime() - order.deliveredAt.getTime()) / DAY_MS));
      c.unpaid.push({ ...ref, dueMinor: order.codMinor, deliveredAt: order.deliveredAt, daysOutstanding });
    }
    const reportedMinor = reportedOf(order);
    if (reportedMinor !== null) {
      const diffMinor = reportedMinor - order.codMinor;
      if (abs(diffMinor) > input.toleranceMinor) {
        c.doorstepGaps.push({ ...ref, dueMinor: order.codMinor, reportedMinor, paidMinor: paidByOrder.get(order.id) ?? null, diffMinor });
      }
    }
  }

  for (const r of input.remittances) {
    const c = courier(r.courierId);
    c.received.usdCents += r.amountUsdCents;
    c.received.lbp += r.amountLbp;
    const lines = [...lineByOrder.values()].filter((l) => l.remittanceId === r.id);
    // Compare like with like (dollars with dollars, pounds with pounds), so only the
    // difference is converted and a rate change since the orders cannot create a gap.
    const usd = lines.reduce((sum, l) => sum + l.collectedUsdCents, 0n);
    const lbp = lines.reduce((sum, l) => sum + l.collectedLbp, 0n);
    const fees = lines.reduce((sum, l) => sum + l.feeMinor, 0n);
    const diffMinor = convert(r.amountUsdCents - usd, r.amountLbp - lbp, input.currency, input.rate) + fees;
    if (abs(diffMinor) > input.toleranceMinor) {
      c.remittanceGaps.push({ remittanceId: r.id, receivedAt: r.receivedAt, reference: r.reference, diffMinor });
    }
  }

  const totals = { expectedMinor: 0n, received: { usdCents: 0n, lbp: 0n }, receivedMinor: 0n, gaps: { count: 0, sumMinor: 0n } };
  for (const c of byCourier.values()) {
    c.receivedMinor = convert(c.received.usdCents, c.received.lbp, input.currency, input.rate);
    c.gaps = {
      count: c.shortOrOver.length + c.unpaid.length + c.notDeliveredButPaid.length,
      sumMinor:
        c.shortOrOver.reduce((sum, row) => sum + abs(row.diffMinor), 0n) +
        c.unpaid.reduce((sum, row) => sum + row.dueMinor, 0n) +
        c.notDeliveredButPaid.reduce((sum, row) => sum + abs(row.paidMinor), 0n),
    };
    totals.expectedMinor += c.expectedMinor;
    totals.received.usdCents += c.received.usdCents;
    totals.received.lbp += c.received.lbp;
    totals.receivedMinor += c.receivedMinor;
    totals.gaps.count += c.gaps.count;
    totals.gaps.sumMinor += c.gaps.sumMinor;
  }
  return { couriers: [...byCourier.values()], totals };
}
