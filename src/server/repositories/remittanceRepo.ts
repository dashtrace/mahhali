import type { Prisma } from "@prisma/client";
import { db, type Db } from "./tx";

// Every function takes shopId and puts it in every where clause.
const withLines = {
  lines: { include: { order: { select: { number: true, currency: true } } }, orderBy: { order: { number: "asc" } } },
} satisfies Prisma.RemittanceInclude;

export type RemittanceRow = {
  courierId: string;
  amountUsdCents: bigint;
  amountLbp: bigint;
  receivedAt: Date;
  reference: string | null;
  recordedByUserId: string;
  lines: { orderId: string; collectedUsdCents: bigint; collectedLbp: bigint; feeMinor: bigint }[];
};

export const remittanceRepo = {
  findCourier(shopId: string, id: string, client: Db = db) {
    return client.courier.findFirst({ where: { id, shopId } });
  },

  /** The orders a remittance pays for, with whether each is already settled. */
  ordersForLines(shopId: string, ids: string[], client: Db = db) {
    return client.order.findMany({
      where: { shopId, id: { in: ids } },
      select: { id: true, number: true, courierId: true, currency: true, codMinor: true, reportedUsdCents: true, reportedLbp: true, remittanceLine: { select: { id: true } } },
    });
  },

  create(tx: Db, shopId: string, input: RemittanceRow) {
    return tx.remittance.create({
      data: { ...input, shopId, lines: { create: input.lines.map((l) => ({ ...l, shopId })) } },
      include: withLines,
    });
  },

  list(shopId: string, opts: { courierId?: string; start: Date; end: Date }, client: Db = db) {
    return client.remittance.findMany({
      where: { shopId, courierId: opts.courierId, receivedAt: { gte: opts.start, lt: opts.end } },
      include: { ...withLines, supplements: { orderBy: { createdAt: "asc" } }, resolution: true },
      orderBy: [{ receivedAt: "desc" }, { createdAt: "desc" }],
    });
  },

  find(shopId: string, id: string, client: Db = db) {
    return client.remittance.findFirst({ where: { id, shopId }, include: { ...withLines, supplements: { orderBy: { createdAt: "asc" } }, resolution: true } });
  },

  addSupplement(shopId: string, remittanceId: string, data: { amountUsdCents: bigint; amountLbp: bigint; reason: string; recordedByUserId: string; requestKey: string }, client: Db = db) {
    return client.remittanceSupplement.create({ data: { shopId, remittanceId, ...data } });
  },

  findSupplementByKey(shopId: string, requestKey: string, client: Db = db) {
    return client.remittanceSupplement.findFirst({ where: { shopId, requestKey } });
  },

  acceptDifference(shopId: string, remittanceId: string, reason: string, userId: string, client: Db = db) {
    return client.remittanceResolution.create({ data: { shopId, remittanceId, reason, recordedByUserId: userId } });
  },

  acceptOrderDifference(shopId: string, orderId: string, reason: string, userId: string, client: Db = db) {
    return client.orderCashResolution.create({ data: { shopId, orderId, reason, recordedByUserId: userId } });
  },

  findCashOrder(shopId: string, orderId: string, client: Db = db) {
    return client.order.findFirst({ where: { id: orderId, shopId, status: "DELIVERED" }, select: { id: true, cashResolution: { select: { id: true } } } });
  },

  /** Delivered orders of a courier that no remittance has paid for yet, oldest first. */
  unsettled(shopId: string, courierId: string, client: Db = db) {
    return client.order.findMany({
      where: { shopId, courierId, status: "DELIVERED", remittanceLine: null },
      select: {
        id: true,
        number: true,
        customerName: true,
        deliveredAt: true,
        currency: true,
        usdLbpRate: true,
        codMinor: true,
        reportedUsdCents: true,
        reportedLbp: true,
      },
      orderBy: { deliveredAt: "asc" },
      // shortcut: one remittance takes up to 500 lines, so that is all the list shows; page it if couriers ever owe more.
      take: 500,
    });
  },
};
