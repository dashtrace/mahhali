import type { OrderSource, OrderStatus, Prisma, StockReason } from "@prisma/client";
import { db, type Db } from "./tx";

// Every function takes shopId and puts it in every where clause.

const listInclude = {
  items: { select: { id: true, nameSnapshot: true, qty: true, unitPriceMinor: true } },
  courier: { select: { id: true, name: true, type: true } },
  deliveredBy: { select: { id: true, name: true } },
  remittanceLine: { select: { id: true, remittanceId: true } },
} satisfies Prisma.OrderInclude;

const detailInclude = {
  ...listInclude,
  items: { include: { variant: { select: { id: true, productId: true, size: true, colour: true } } } },
  events: { orderBy: { at: "asc" } },
  customer: { select: { id: true, name: true, phone: true, email: true, _count: { select: { orders: true } } } },
} satisfies Prisma.OrderInclude;

export type NewOrder = {
  shopId: string;
  number: number;
  publicToken: string;
  idempotencyKey: string | null;
  source: OrderSource;
  createdByUserId: string | null;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  governorate: string;
  district: string;
  area: string;
  addressLine: string;
  landmark: string | null;
  notes: string | null;
  currency: "USD" | "LBP";
  usdLbpRate: Prisma.Decimal | null;
  subtotalMinor: bigint;
  deliveryFeeMinor: bigint;
  totalMinor: bigint;
  codMinor: bigint;
  firstContactAt: Date;
  items: { variantId: string; nameSnapshot: string; unitPriceMinor: bigint; qty: number }[];
};

export type Movement = { variantId: string; delta: number; reason: StockReason };

export const orderRepo = {
  findByIdempotencyKey(shopId: string, idempotencyKey: string, client: Db = db) {
    return client.order.findUnique({ where: { shopId_idempotencyKey: { shopId, idempotencyKey } } });
  },

  /** Variants a customer may order: active product, variant not archived. */
  orderableVariants(shopId: string, variantIds: string[], client: Db = db) {
    return client.variant.findMany({
      where: { shopId, id: { in: variantIds }, archived: false, product: { status: "ACTIVE" } },
      include: { product: { select: { name: true } } },
    });
  },

  /**
   * Moves qty from available to reserved only if that much is available.
   * Postgres re-checks the condition after waiting on a concurrent buyer's
   * row lock, so the last item sells once. Returns false when out of stock.
   */
  async reserve(tx: Db, shopId: string, variantId: string, qty: number) {
    const { count } = await tx.variant.updateMany({
      where: { id: variantId, shopId, archived: false, available: { gte: qty } },
      data: { available: { decrement: qty }, reserved: { increment: qty } },
    });
    return count === 1;
  },

  /** Takes the next order number. Locks the shop row until the transaction ends. */
  takeOrderNumber(tx: Db, shopId: string) {
    return tx.shop.update({ where: { id: shopId }, data: { nextOrderSeq: { increment: 1 } } });
  },

  /** Repeat buyers are recognised by phone; the latest name and email win. */
  upsertCustomer(tx: Db, shopId: string, c: { name: string; phone: string; email: string | null }) {
    return tx.customer.upsert({
      where: { shopId_phone: { shopId, phone: c.phone } },
      create: { shopId, name: c.name, phone: c.phone, email: c.email },
      update: { name: c.name, ...(c.email ? { email: c.email } : {}) },
    });
  },

  create(tx: Db, o: NewOrder, actorUserId: string | null) {
    const { items, shopId, ...rest } = o;
    return tx.order.create({
      data: {
        ...rest,
        shopId,
        items: { create: items.map((i) => ({ ...i, shopId })) },
        events: { create: { shopId, type: "STATUS", fromValue: null, toValue: "NEW", actorUserId } },
      },
      include: { items: true },
    });
  },

  /** Applies a stock effect to one variant; the CHECK constraints stop negatives. */
  adjustCounters(tx: Db, shopId: string, variantId: string, change: { available: number; reserved: number }) {
    return tx.variant.updateMany({
      where: { id: variantId, shopId },
      data: { available: { increment: change.available }, reserved: { increment: change.reserved } },
    });
  },

  logMovements(tx: Db, shopId: string, orderId: string, movements: Movement[], actorUserId: string | null) {
    return tx.stockMovement.createMany({
      data: movements.map((m) => ({ ...m, shopId, orderId, actorUserId })),
    });
  },

  async list(
    shopId: string,
    f: { status?: OrderStatus; courierId?: string; number?: number; phoneDigits?: string; name?: string; cursor?: string; limit: number },
    client: Db = db,
  ) {
    const search: Prisma.OrderWhereInput[] = [];
    if (f.number !== undefined) search.push({ number: f.number });
    if (f.phoneDigits) search.push({ customerPhone: { contains: f.phoneDigits } });
    if (f.name) search.push({ customerName: { contains: f.name, mode: "insensitive" } });
    const rows = await client.order.findMany({
      where: {
        shopId,
        ...(f.status ? { status: f.status } : {}),
        ...(f.courierId ? { courierId: f.courierId } : {}),
        ...(search.length ? { OR: search } : {}),
      },
      include: listInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: f.limit + 1,
      ...(f.cursor ? { cursor: { id: f.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > f.limit;
    return { orders: rows.slice(0, f.limit), nextCursor: hasMore ? rows[f.limit - 1].id : null };
  },

  async statusCounts(shopId: string, courierId: string | undefined, client: Db = db) {
    const groups = await client.order.groupBy({
      by: ["status"],
      where: { shopId, ...(courierId ? { courierId } : {}) },
      _count: { _all: true },
    });
    return Object.fromEntries(groups.map((g) => [g.status, g._count._all])) as Partial<Record<OrderStatus, number>>;
  },

  findDetail(shopId: string, id: string, client: Db = db) {
    return client.order.findFirst({ where: { id, shopId }, include: detailInclude });
  },

  /** Names for the actors in an order's history. */
  userNames(userIds: string[], client: Db = db) {
    return client.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } });
  },

  findWithItems(tx: Db, shopId: string, id: string) {
    return tx.order.findFirst({ where: { id, shopId }, include: { items: true } });
  },

  /**
   * Changes the status only if it is still `from`, so two people pressing
   * buttons at once cannot both move the same order.
   */
  async moveStatus(tx: Db, shopId: string, id: string, from: OrderStatus, data: Prisma.OrderUpdateManyMutationInput) {
    const { count } = await tx.order.updateMany({ where: { id, shopId, status: from }, data });
    return count === 1;
  },

  addEvent(
    tx: Db,
    shopId: string,
    e: { orderId: string; type: "STATUS" | "COURIER"; fromValue: string | null; toValue: string; note?: string | null; actorUserId: string | null },
  ) {
    return tx.orderEvent.create({ data: { shopId, ...e } });
  },

  update(tx: Db, shopId: string, id: string, data: Prisma.OrderUncheckedUpdateManyInput) {
    return tx.order.updateMany({ where: { id, shopId }, data });
  },

  findCourier(shopId: string, id: string, client: Db = db) {
    return client.courier.findFirst({ where: { id, shopId } });
  },

  /** A courier's run: what the delivery screen lists. */
  forCourier(shopId: string, f: { courierId?: string; statuses: OrderStatus[]; since?: Date }, client: Db = db) {
    return client.order.findMany({
      where: {
        shopId,
        status: { in: f.statuses },
        ...(f.courierId ? { courierId: f.courierId } : {}),
        ...(f.since ? { updatedAt: { gte: f.since } } : {}),
      },
      include: {
        items: { select: { nameSnapshot: true, qty: true } },
        courier: { select: { id: true, name: true } },
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 200,
    });
  },

  countSince(shopId: string, since: Date, client: Db = db) {
    return client.order.count({ where: { shopId, createdAt: { gte: since } } });
  },

  /** System job only: shops that auto-cancel unconfirmed orders. */
  shopsWithAutoCancel(client: Db = db) {
    return client.shop.findMany({
      where: { autoCancelHours: { not: null }, suspended: false },
      select: { id: true, autoCancelHours: true },
    });
  },

  staleNewOrderIds(shopId: string, before: Date, client: Db = db) {
    return client.order.findMany({
      where: { shopId, status: "NEW", createdAt: { lt: before } },
      select: { id: true },
      take: 200,
    });
  },
};
