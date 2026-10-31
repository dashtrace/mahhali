import type { Prisma } from "@prisma/client";
import { db, type Db } from "./tx";

// Every function takes shopId and puts it in every where clause.
// What reconcile() needs to know about an order.
const reconcileOrder = {
  id: true,
  number: true,
  courierId: true,
  status: true,
  currency: true,
  usdLbpRate: true,
  codMinor: true,
  reportedUsdCents: true,
  reportedLbp: true,
  deliveredAt: true,
} satisfies Prisma.OrderSelect;

type Range = { start: Date; end: Date };

export const reportingRepo = {
  couriers(shopId: string, client: Db = db) {
    return client.courier.findMany({ where: { shopId }, select: { id: true, name: true } });
  },

  /** Orders delivered by a courier in the range, with the line that paid for each, if any. */
  delivered(shopId: string, range: Range, courierId: string | undefined, client: Db = db) {
    return client.order.findMany({
      where: {
        shopId,
        status: "DELIVERED",
        deliveredAt: { gte: range.start, lt: range.end },
        courierId: courierId ?? { not: null },
      },
      select: { ...reconcileOrder, remittanceLine: { include: { remittance: { select: { courierId: true } } } } },
    });
  },

  /** Remittances received in the range with every line and its order. */
  remittances(shopId: string, range: Range, courierId: string | undefined, client: Db = db) {
    return client.remittance.findMany({
      where: { shopId, courierId, receivedAt: { gte: range.start, lt: range.end } },
      include: { lines: { include: { order: { select: reconcileOrder } } } },
    });
  },

  countByStatus(shopId: string, range: Range, client: Db = db) {
    return client.order.groupBy({
      by: ["status"],
      where: { shopId, createdAt: { gte: range.start, lt: range.end } },
      _count: { _all: true },
    });
  },

  /** When the shop's first order was created (imported or backdated orders can predate the shop), or null. */
  async firstOrderAt(shopId: string, client: Db = db) {
    const { _min } = await client.order.aggregate({ where: { shopId }, _min: { createdAt: true } });
    return _min.createdAt;
  },

  /** First contact and confirmation times of the range's confirmed orders. */
  confirmations(shopId: string, range: Range, client: Db = db) {
    return client.order.findMany({
      where: { shopId, createdAt: { gte: range.start, lt: range.end }, confirmedAt: { not: null } },
      select: { firstContactAt: true, confirmedAt: true },
    });
  },
};
