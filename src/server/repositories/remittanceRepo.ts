import type { Prisma } from "@prisma/client";
import { db, type Db } from "./tx";

// Every function takes shopId and puts it in every where clause.
const withLines = {
  lines: { include: { order: { select: { number: true } } }, orderBy: { order: { number: "asc" } } },
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
      select: { id: true, number: true, courierId: true, currency: true, remittanceLine: { select: { id: true } } },
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
      include: withLines,
      orderBy: [{ receivedAt: "desc" }, { createdAt: "desc" }],
    });
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
