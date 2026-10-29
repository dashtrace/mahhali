import { toMinor } from "../domain/money";
import { firstName } from "../domain/names";
import { itemLabel, orderTotals, parseOrderNumber } from "../domain/orders";
import { orderLimit } from "../domain/plans";
import {
  STATUS_LABELS,
  allowedNext,
  canTransition,
  isEditable,
  isFinal,
  movementDelta,
  stockEffect,
  type OrderStatus,
} from "../domain/orderStatus";
import { checkNote } from "../domain/storefront";
import { randomToken } from "../domain/tokens";
import { AppError, badRequest, conflict, notFound, unprocessable } from "../http/errors";
import { json } from "../http/json";
import { rateLimit } from "../http/rateLimit";
import type { Actor } from "../http/withRoute";
import { appUrl, sendMail } from "../mail/mailer";
import { orderRepo } from "../repositories/orderRepo";
import { shopRepo } from "../repositories/shopRepo";
import { isUniqueViolation, transaction } from "../repositories/tx";
import type {
  ListOrdersInput,
  ManualOrderInput,
  PlaceOrderInput,
  TransitionInput,
  UpdateOrderInput,
} from "../validation/order";
import { createReviewInvite, sendReviewInvite } from "./reviewService";

const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{8,80}$/;

type Placement = {
  shop: { id: string; name: string; plan: string; currency: "USD" | "LBP"; deliveryFeeMinor: bigint };
  input: PlaceOrderInput;
  idempotencyKey: string | null;
  source: "CATALOGUE" | "MANUAL";
  actorUserId: string | null;
  firstContactAt?: Date;
  deliveryFeeMinor?: bigint;
};

/**
 * Creates the order and reserves its stock in one transaction: either every
 * line is reserved, the order gets the shop's next number and the stock
 * movements are written, or nothing happens.
 */
async function place(p: Placement) {
  const shopId = p.shop.id;
  if (p.idempotencyKey) {
    const existing = await orderRepo.findByIdempotencyKey(shopId, p.idempotencyKey);
    if (existing) return { order: existing, replayed: true };
  }

  const ids = p.input.items.map((l) => l.variantId);
  const variants = new Map((await orderRepo.orderableVariants(shopId, ids)).map((v) => [v.id, v]));
  const missing = ids.filter((id) => !variants.has(id));
  if (missing.length) {
    throw unprocessable("UNAVAILABLE", "Some items can no longer be ordered.", { variantIds: missing });
  }
  const notes = p.input.items.map((l) => {
    const { product } = variants.get(l.variantId)!;
    const checked = checkNote(
      { label: product.customLabel, required: product.customRequired, maxLength: product.customMaxLength },
      l.note,
    );
    if (checked.ok) return checked.note;
    throw checked.code === "CUSTOMIZATION_REQUIRED"
      ? unprocessable(checked.code, `${product.customLabel} is required for ${product.name}.`, { variantId: l.variantId })
      : unprocessable(checked.code, `${product.customLabel} can be up to ${product.customMaxLength} characters.`, {
          variantId: l.variantId,
          maxLength: product.customMaxLength,
        });
  });

  const limit = orderLimit(p.shop.plan);
  if (limit !== null) {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    // shortcut: counted outside the transaction, so a burst can pass the limit by a few orders; fine for a soft plan cap.
    if ((await orderRepo.countSince(shopId, monthStart)) >= limit) {
      throw unprocessable("PLAN_LIMIT_REACHED", "This shop cannot take more orders this month. Please contact the shop.");
    }
  }

  try {
    const order = await transaction(async (tx) => {
      // A fixed order of row locks means two orders never wait on each other in a cycle.
      const lines = [...p.input.items].sort((a, b) => a.variantId.localeCompare(b.variantId));
      for (const line of lines) {
        if (!(await orderRepo.reserve(tx, shopId, line.variantId, line.qty))) {
          throw conflict("OUT_OF_STOCK", "Sorry, that just sold out.", { variantId: line.variantId });
        }
      }
      const shop = await orderRepo.takeOrderNumber(tx, shopId);
      const customer = await orderRepo.upsertCustomer(tx, shopId, p.input.customer);
      const items = p.input.items.map((l, i) => {
        const v = variants.get(l.variantId)!;
        return {
          variantId: v.id,
          nameSnapshot: itemLabel(v.product.name, v.size, v.colour),
          unitPriceMinor: v.priceMinor,
          qty: l.qty,
          note: notes[i],
        };
      });
      const created = await orderRepo.create(
        tx,
        {
          shopId,
          number: shop.nextOrderSeq - 1,
          publicToken: randomToken(),
          idempotencyKey: p.idempotencyKey,
          source: p.source,
          createdByUserId: p.source === "MANUAL" ? p.actorUserId : null,
          customerId: customer.id,
          customerName: p.input.customer.name,
          customerPhone: p.input.customer.phone,
          customerEmail: p.input.customer.email,
          ...p.input.address,
          notes: p.input.notes,
          currency: shop.currency,
          // The rate is frozen on the order so later rate changes never move what was owed.
          usdLbpRate: shop.usdLbpRate,
          ...orderTotals(items, p.deliveryFeeMinor ?? shop.deliveryFeeMinor),
          firstContactAt: p.firstContactAt ?? new Date(),
          items,
        },
        p.actorUserId,
      );
      await orderRepo.logMovements(
        tx,
        shopId,
        created.id,
        lines.map((l) => ({ variantId: l.variantId, delta: -l.qty, reason: "RESERVE" as const })),
        p.actorUserId,
      );
      return created;
    });
    await sendOrderPlacedEmail(order, p.shop.name);
    return { order, replayed: false };
  } catch (error) {
    // A retry racing its own first attempt: hand back the order the first one created.
    const raced = isUniqueViolation(error) || (error instanceof AppError && error.code === "OUT_OF_STOCK");
    if (p.idempotencyKey && raced) {
      const existing = await orderRepo.findByIdempotencyKey(shopId, p.idempotencyKey);
      if (existing) return { order: existing, replayed: true };
    }
    throw error;
  }
}

async function sendOrderPlacedEmail(
  order: { customerEmail: string | null; customerName: string; number: number; publicToken: string },
  shopName: string,
) {
  if (!order.customerEmail) return;
  try {
    await sendMail({
      to: order.customerEmail,
      subject: `Order #${order.number} received - ${shopName}`,
      text: `Hi ${firstName(order.customerName)},\n\nThanks for your order #${order.number}. You pay cash on delivery.\nTrack it here: ${appUrl(`/t/${order.publicToken}`)}\n\n${shopName}`,
    });
  } catch (error) {
    // The order is saved; a lost confirmation email must not undo it.
    console.error("order confirmation email failed", error);
  }
}

function checkKey(key: string | null): string | null {
  if (key === null) return null;
  if (!IDEMPOTENCY_KEY.test(key)) throw badRequest("Idempotency-Key must be 8 to 80 letters, digits, - or _");
  return key;
}

type MoveOptions = {
  actorUserId: string | null;
  note?: string | null;
  /** Delivery users only reach orders assigned to their courier. */
  courierScope?: string | null;
  data?: Record<string, unknown>;
  /** Extra checks on the loaded order before anything changes. */
  check?: (order: { currency: "USD" | "LBP"; usdLbpRate: unknown }) => void;
};

/**
 * Moves an order to `to` with the stock effect of that move, the history
 * event and, on delivery, the review invite - all in one transaction.
 */
async function move(shopId: string, orderId: string, to: OrderStatus, o: MoveOptions) {
  const order = await transaction(async (tx) => {
    const order = await orderRepo.findWithItems(tx, shopId, orderId);
    if (!order || (o.courierScope !== undefined && (!o.courierScope || order.courierId !== o.courierScope))) {
      throw notFound("Order");
    }
    if (!canTransition(order.status, to)) {
      throw unprocessable(
        "INVALID_TRANSITION",
        `An order that is ${STATUS_LABELS[order.status]} cannot move to ${STATUS_LABELS[to]}.`,
        { from: order.status, to, allowed: allowedNext(order.status) },
      );
    }
    if (to === "OUT_FOR_DELIVERY" && !order.courierId) {
      throw unprocessable("COURIER_REQUIRED", "Assign a courier before sending the order out.");
    }
    o.check?.(order);
    const now = new Date();
    const stamps =
      to === "CONFIRMED" ? { confirmedAt: order.confirmedAt ?? now } : to === "DELIVERED" ? { deliveredAt: now } : {};
    if (!(await orderRepo.moveStatus(tx, shopId, orderId, order.status, { status: to, ...stamps, ...o.data }))) {
      throw conflict("STATUS_CHANGED", "Someone else just updated this order. Reload and try again.");
    }
    const effect = stockEffect(to);
    if (effect) {
      const items = [...order.items].sort((a, b) => a.variantId.localeCompare(b.variantId));
      for (const item of items) {
        await orderRepo.adjustCounters(tx, shopId, item.variantId, {
          available: effect.available * item.qty,
          reserved: effect.reserved * item.qty,
        });
      }
      await orderRepo.logMovements(
        tx,
        shopId,
        orderId,
        items.map((i) => ({ variantId: i.variantId, delta: movementDelta(effect, i.qty), reason: effect.reason })),
        o.actorUserId,
      );
    }
    await orderRepo.addEvent(tx, shopId, {
      orderId,
      type: "STATUS",
      fromValue: order.status,
      toValue: to,
      note: o.note ?? null,
      actorUserId: o.actorUserId,
    });
    if (to === "DELIVERED") await createReviewInvite(tx, shopId, orderId);
    return order;
  });
  // After commit: a slow or failing mail provider never blocks the delivery.
  if (to === "DELIVERED") await sendReviewInvite(shopId, orderId);
  return order;
}

function collected(input: { collectedUsd?: string; collectedLbp?: string }) {
  if (input.collectedUsd === undefined && input.collectedLbp === undefined) return {};
  return {
    reportedUsdCents: input.collectedUsd === undefined ? 0n : toMinor(input.collectedUsd, "USD"),
    reportedLbp: input.collectedLbp === undefined ? 0n : BigInt(input.collectedLbp),
  };
}

function courierScope(actor: Actor) {
  return actor.role === "delivery" ? (actor.courierId ?? null) : undefined;
}

export const orderService = {
  /** A guest order from the public catalogue. */
  async placeFromCatalogue(slug: string, input: PlaceOrderInput, opts: { idempotencyKey: string | null; ip: string }) {
    // shortcut: per IP and shop; generous because Lebanese mobile carriers put many buyers behind one IP.
    rateLimit(`order:${slug}:${opts.ip}`, 30, 5 * 60_000);
    const key = checkKey(opts.idempotencyKey);
    const shop = await shopRepo.findBySlug(slug);
    if (!shop || shop.suspended) throw notFound("Shop");
    const { order, replayed } = await place({ shop, input, idempotencyKey: key, source: "CATALOGUE", actorUserId: null });
    return json(
      { number: order.number, token: order.publicToken, status: order.status, currency: order.currency, totalMinor: order.totalMinor },
      replayed ? 200 : 201,
      replayed ? { "idempotent-replayed": "true" } : undefined,
    );
  },

  /** An order staff enter for a customer who wrote by DM or WhatsApp. */
  async createManual(actor: Actor, input: ManualOrderInput, idempotencyKey: string | null) {
    const shop = await shopRepo.findById(actor.shopId);
    if (!shop) throw notFound("Shop");
    let deliveryFeeMinor: bigint | undefined;
    try {
      deliveryFeeMinor = input.deliveryFee === undefined ? undefined : toMinor(input.deliveryFee, shop.currency);
    } catch {
      throw unprocessable("INVALID_PRICE", "The delivery fee does not fit the shop currency.");
    }
    const { order, replayed } = await place({
      shop,
      input,
      idempotencyKey: checkKey(idempotencyKey),
      source: "MANUAL",
      actorUserId: actor.userId,
      firstContactAt: input.firstContactAt ? new Date(input.firstContactAt) : undefined,
      deliveryFeeMinor,
    });
    return json(await this.get(actor, order.id), replayed ? 200 : 201);
  },

  async list(actor: Actor, q: ListOrdersInput) {
    const search = q.q?.trim() ?? "";
    const number = search ? parseOrderNumber(search) : null;
    const digits = search.replace(/\D/g, "");
    const filters = {
      status: q.status,
      courierId: q.courierId,
      cursor: q.cursor,
      limit: q.limit,
      ...(number !== null ? { number } : {}),
      // Local numbers ("03 123 456") are stored as +9613123456: match on the digits after the leading 0.
      ...(digits.length >= 4 ? { phoneDigits: digits.replace(/^0/, "") } : {}),
      ...(search && number === null && digits.length < 4 ? { name: search } : {}),
    };
    const [page, counts] = await Promise.all([
      orderRepo.list(actor.shopId, filters),
      orderRepo.statusCounts(actor.shopId, q.courierId),
    ]);
    return {
      // undefined drops the field from the JSON
      orders: page.orders.map((o) => ({
        ...o,
        idempotencyKey: undefined,
        publicToken: undefined,
        allowedNext: allowedNext(o.status),
      })),
      nextCursor: page.nextCursor,
      counts,
    };
  },

  async get(actor: Actor, id: string) {
    const order = await orderRepo.findDetail(actor.shopId, id);
    if (!order) throw notFound("Order");
    const actorIds = [...new Set(order.events.map((e) => e.actorUserId).filter((x): x is string => !!x))];
    const names = new Map((await orderRepo.userNames(actorIds)).map((u) => [u.id, u.name]));
    const { customer } = order;
    return {
      ...order,
      idempotencyKey: undefined,
      customer: { ...customer, orderCount: customer._count.orders, _count: undefined },
      events: order.events.map((e) => ({ ...e, actorName: e.actorUserId ? (names.get(e.actorUserId) ?? null) : null })),
      allowedNext: allowedNext(order.status),
      trackingUrl: appUrl(`/t/${order.publicToken}`),
    };
  },

  /** Address, notes and courier. Reassigning a courier is recorded in the history. */
  async update(actor: Actor, id: string, input: UpdateOrderInput) {
    await transaction(async (tx) => {
      const order = await orderRepo.findWithItems(tx, actor.shopId, id);
      if (!order) throw notFound("Order");
      if ((input.address || input.notes !== undefined) && !isEditable(order.status)) {
        throw unprocessable("ORDER_LOCKED", "The address and notes cannot change once the order has left.");
      }
      const data: Record<string, unknown> = { ...input.address };
      if (input.notes !== undefined) data.notes = input.notes;
      if (input.courierId !== undefined && input.courierId !== order.courierId) {
        if (isFinal(order.status)) throw unprocessable("ORDER_CLOSED", "This order is closed.");
        const [from, to] = await Promise.all([
          order.courierId ? orderRepo.findCourier(actor.shopId, order.courierId, tx) : null,
          input.courierId ? orderRepo.findCourier(actor.shopId, input.courierId, tx) : null,
        ]);
        if (input.courierId && !to) throw notFound("Courier");
        if (to && !to.active) throw unprocessable("COURIER_INACTIVE", "That courier is no longer active.");
        data.courierId = input.courierId;
        await orderRepo.addEvent(tx, actor.shopId, {
          orderId: id,
          type: "COURIER",
          fromValue: from?.name ?? null,
          toValue: to?.name ?? "Unassigned",
          actorUserId: actor.userId,
        });
      }
      await orderRepo.update(tx, actor.shopId, id, data);
    });
    return this.get(actor, id);
  },

  /** The board's buttons. Delivered and Returned go through the delivery rules. */
  async transition(actor: Actor, id: string, input: TransitionInput) {
    if (input.to === "DELIVERED") return this.markDelivered(actor, id, input);
    if (input.to === "RETURNED") return this.markFailed(actor, id, input.note ?? "Delivery failed");
    await move(actor.shopId, id, input.to, { actorUserId: actor.userId, note: input.note });
    return this.get(actor, id);
  },

  async markDelivered(actor: Actor, id: string, input: { collectedUsd?: string; collectedLbp?: string }) {
    const cash = collected(input);
    const shop = await shopRepo.findById(actor.shopId);
    await move(actor.shopId, id, "DELIVERED", {
      actorUserId: actor.userId,
      courierScope: courierScope(actor),
      data: { deliveredByUserId: actor.userId, ...cash },
      check: (order) => {
        // Reconciliation converts the other currency with the order's (or shop's) rate.
        const other = order.currency === "USD" ? cash.reportedLbp : cash.reportedUsdCents;
        if (other && other > 0n && !order.usdLbpRate && !shop?.usdLbpRate) {
          throw unprocessable("RATE_MISSING", "Set the shop's exchange rate before recording cash in the other currency.");
        }
      },
    });
    return { id, status: "DELIVERED" as const };
  },

  async markFailed(actor: Actor, id: string, reason: string) {
    await move(actor.shopId, id, "RETURNED", {
      actorUserId: actor.userId,
      courierScope: courierScope(actor),
      note: reason,
      data: { failureReason: reason },
    });
    return { id, status: "RETURNED" as const };
  },

  /** The delivery phone screen: a courier's run, with what to collect. */
  async deliveryList(actor: Actor, q: { view: "active" | "done"; courierId?: string }) {
    const scope = courierScope(actor);
    if (scope === null) return [];
    const orders = await orderRepo.forCourier(actor.shopId, {
      courierId: scope ?? q.courierId,
      statuses: q.view === "active" ? ["PACKED", "OUT_FOR_DELIVERY"] : ["DELIVERED", "RETURNED"],
      since: q.view === "done" ? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) : undefined,
    });
    return orders.map((o) => ({
      id: o.id,
      number: o.number,
      status: o.status,
      customerName: o.customerName,
      customerPhone: o.customerPhone,
      governorate: o.governorate,
      district: o.district,
      area: o.area,
      addressLine: o.addressLine,
      landmark: o.landmark,
      notes: o.notes,
      currency: o.currency,
      usdLbpRate: o.usdLbpRate,
      codMinor: o.codMinor,
      items: o.items,
      courier: o.courier,
      reportedUsdCents: o.reportedUsdCents,
      reportedLbp: o.reportedLbp,
      failureReason: o.failureReason,
      deliveredAt: o.deliveredAt,
      canComplete: o.status === "OUT_FOR_DELIVERY",
    }));
  },

  /** Host cron: cancels orders left in New past the shop's limit, releasing their stock. */
  async expireReservations(now = new Date()) {
    let cancelled = 0;
    for (const shop of await orderRepo.shopsWithAutoCancel()) {
      const before = new Date(now.getTime() - shop.autoCancelHours! * 60 * 60 * 1000);
      for (const { id } of await orderRepo.staleNewOrderIds(shop.id, before)) {
        try {
          await move(shop.id, id, "CANCELLED", {
            actorUserId: null,
            note: `Not confirmed within ${shop.autoCancelHours} hours`,
          });
          cancelled += 1;
        } catch (error) {
          // Confirmed by staff a moment ago: leave it.
          if (!(error instanceof AppError)) throw error;
        }
      }
    }
    return { cancelled };
  },
};
