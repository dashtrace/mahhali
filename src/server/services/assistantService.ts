import type { Currency } from "../domain/money";
import { maskAddress, maskName, maskPhone, maskText } from "../domain/mask";
import { notFound } from "../http/errors";
import type { McpActor } from "../http/withRoute";
import { formatMoney } from "@/lib/format";
import type { ListOrdersToolInput, MyDeliveriesToolInput } from "../validation/mcp";
import { orderService } from "./orderService";

// What AI assistants (MCP tools) read. Each function calls the same service the
// dashboard uses, then returns a compact view with customer details masked, so
// nothing a tool returns can carry a full name, phone, address or email.

type Money = { minor: number; text: string };

export function money(minor: bigint | number, currency: Currency): Money {
  return { minor: Number(minor), text: formatMoney(minor, currency) };
}

type OrderLike = {
  id: string;
  number: number;
  status: string;
  createdAt: Date;
  customerName: string;
  customerPhone: string;
  governorate: string;
  district: string;
  area: string;
  notes: string | null;
  currency: Currency;
  codMinor: bigint;
  items: { nameSnapshot: string; qty: number }[];
  courier: { id: string; name: string } | null;
};

function orderView(o: OrderLike & { totalMinor?: bigint }) {
  return {
    number: o.number,
    status: o.status,
    createdAt: o.createdAt,
    customer: { name: maskName(o.customerName), phone: maskPhone(o.customerPhone) },
    deliverTo: maskAddress(o),
    items: o.items.map((i) => ({ name: i.nameSnapshot, qty: i.qty })),
    ...(o.totalMinor !== undefined ? { total: money(o.totalMinor, o.currency) } : {}),
    cashToCollect: money(o.codMinor, o.currency),
    courier: o.courier ? { id: o.courier.id, name: o.courier.name } : null,
    notes: o.notes ? maskText(o.notes) : null,
  };
}

export const assistantService = {
  async listOrders(actor: McpActor, input: ListOrdersToolInput) {
    const page = await orderService.list(actor, {
      status: input.status,
      courierId: input.courierId,
      q: input.search,
      from: input.from,
      to: input.to,
      cursor: input.cursor,
      limit: input.limit,
    });
    return {
      orders: page.orders.map(orderView),
      nextCursor: page.nextCursor,
      countsByStatus: page.counts,
    };
  },

  async getOrder(actor: McpActor, number: number) {
    const match = (await orderService.list(actor, { q: `#${number}`, limit: 20 })).orders.find((o) => o.number === number);
    if (!match) throw notFound("Order");
    const o = await orderService.get(actor, match.id);
    return {
      ...orderView(o),
      items: o.items.map((i) => ({ name: i.nameSnapshot, qty: i.qty, unitPrice: money(i.unitPriceMinor, o.currency) })),
      subtotal: money(o.subtotalMinor, o.currency),
      deliveryFee: money(o.deliveryFeeMinor, o.currency),
      usdLbpRate: o.usdLbpRate,
      source: o.source,
      customerOrderCount: o.customer.orderCount,
      deliveredBy: o.deliveredBy?.name ?? null,
      deliveredAt: o.deliveredAt,
      failureReason: o.failureReason ? maskText(o.failureReason) : null,
      history: o.events.map((e) => ({
        at: e.at,
        change: e.type,
        from: e.fromValue,
        to: e.toValue,
        by: e.actorName ?? null,
        note: e.note ? maskText(e.note) : null,
      })),
      nextStatuses: o.allowedNext,
    };
  },

  /** Packed and out-for-delivery orders (or delivered and returned ones); a delivery member sees only their own. */
  async myDeliveries(actor: McpActor, input: MyDeliveriesToolInput) {
    const orders = await orderService.deliveryList(actor, { view: input.view });
    return {
      orders: orders.map((o) => ({
        ...orderView(o),
        failureReason: o.failureReason ? maskText(o.failureReason) : null,
        deliveredAt: o.deliveredAt,
      })),
    };
  },
};
