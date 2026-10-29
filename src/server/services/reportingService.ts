import { notFound } from "../http/errors";
import type { Actor } from "../http/withRoute";
import { medianConfirmMinutes, ordersPerDay, periodOf, type Period } from "../domain/metrics";
import { ORDER_STATUSES } from "../domain/orderStatus";
import { reconcile, type ReconcileLine, type ReconcileOrder } from "../domain/reconcile";
import { reportingRepo } from "../repositories/reportingRepo";
import { shopRepo } from "../repositories/shopRepo";
import type { CourierPeriodInput, PeriodInput } from "../validation/money";

type Shop = NonNullable<Awaited<ReturnType<typeof shopRepo.findById>>>;
type OrderRow = Omit<ReconcileOrder, "usdLbpRate"> & { usdLbpRate: { toString(): string } | null };

const toOrder = (o: OrderRow): ReconcileOrder => ({ ...o, usdLbpRate: o.usdLbpRate?.toString() ?? null });

async function requireShop(actor: Actor) {
  const shop = await shopRepo.findById(actor.shopId);
  if (!shop) throw notFound("Shop");
  return shop;
}

/** Loads the period's delivered orders, remittances and lines, and runs reconcile(). */
async function reconcileShop(shop: Shop, period: Period, courierId: string | undefined, asOf: Date) {
  const [delivered, remittances] = await Promise.all([
    reportingRepo.delivered(shop.id, period, courierId),
    reportingRepo.remittances(shop.id, period, courierId),
  ]);
  const lines: ReconcileLine[] = [
    ...delivered.flatMap(({ remittanceLine: line, ...order }) =>
      line ? [{ ...line, courierId: line.remittance.courierId, order: toOrder(order) }] : [],
    ),
    ...remittances.flatMap((r) => r.lines.map((l) => ({ ...l, courierId: r.courierId, order: toOrder(l.order) }))),
  ];
  return reconcile({
    currency: shop.currency,
    rate: shop.usdLbpRate?.toString() ?? null,
    toleranceMinor: shop.codToleranceMinor,
    asOf,
    delivered: delivered.map(toOrder),
    remittances,
    lines,
  });
}

export const reportingService = {
  async reconciliation(actor: Actor, query: CourierPeriodInput) {
    const shop = await requireShop(actor);
    const couriers = new Map((await reportingRepo.couriers(shop.id)).map((c) => [c.id, c.name]));
    if (query.courierId && !couriers.has(query.courierId)) throw notFound("Courier");
    const now = new Date();
    const period = periodOf(query.from, query.to, now);
    const result = await reconcileShop(shop, period, query.courierId, now);
    return {
      from: period.from,
      to: period.to,
      currency: shop.currency,
      toleranceMinor: shop.codToleranceMinor,
      couriers: result.couriers
        .map((c) => ({ ...c, courierName: couriers.get(c.courierId) ?? null }))
        .sort((a, b) => (a.courierName ?? "").localeCompare(b.courierName ?? "")),
      totals: result.totals,
    };
  },

  async metrics(actor: Actor, query: PeriodInput) {
    const shop = await requireShop(actor);
    const now = new Date();
    const period = periodOf(query.from, query.to, now);
    const [byStatus, confirmations, cod] = await Promise.all([
      reportingRepo.countByStatus(shop.id, period),
      reportingRepo.confirmations(shop.id, period),
      reconcileShop(shop, period, undefined, now),
    ]);
    const counts = new Map(byStatus.map((s) => [s.status, s._count._all]));
    const created = byStatus.reduce((sum, s) => sum + s._count._all, 0);
    return {
      from: period.from,
      to: period.to,
      medianConfirmMinutes: medianConfirmMinutes(confirmations),
      ordersPerDay: ordersPerDay(created, period),
      ordersByStatus: Object.fromEntries(ORDER_STATUSES.map((s) => [s, counts.get(s) ?? 0])),
      codGaps: cod.totals.gaps,
      // The "before" numbers the owner gave at sign-up.
      baseline: { ordersPerDay: shop.baselineOrdersPerDay, confirmMinutes: shop.baselineConfirmMinutes },
    };
  },
};
