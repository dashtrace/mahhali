import { matchesSearch } from "../domain/arabic";
import type { Currency } from "../domain/money";
import { maskAddress, maskName, maskPhone, maskText } from "../domain/mask";
import { notFound } from "../http/errors";
import type { McpActor } from "../http/withRoute";
import { formatMoney } from "@/lib/format";
import type {
  CodReconciliationToolInput,
  ListOrdersToolInput,
  ListProductsToolInput,
  ListReviewsToolInput,
  MyDeliveriesToolInput,
  SalesMetricsToolInput,
  StockLevelsToolInput,
  UnsettledCashToolInput,
} from "../validation/mcp";
import { courierService } from "./courierService";
import { orderService } from "./orderService";
import { productService } from "./productService";
import { remittanceService } from "./remittanceService";
import { reportingService } from "./reportingService";
import { reviewService } from "./reviewService";
import { shopService } from "./shopService";
import { categoryService } from "./storefrontService";

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

  /** Products with their variants, prices and stock; search matches Arabic however it is typed. */
  async listProducts(actor: McpActor, input: ListProductsToolInput) {
    const [{ currency }, products, categories] = await Promise.all([
      shopService.summary(actor),
      productService.list(actor, { includeArchived: input.includeArchived }),
      categoryService.list(actor),
    ]);
    const categoryName = new Map(categories.map((c) => [c.id, c.name]));
    const matches = products.filter((p) => {
      const category = p.categoryId ? (categoryName.get(p.categoryId) ?? "") : "";
      if (input.category && !matchesSearch(category, input.category)) return false;
      if (!input.search) return true;
      const text = [p.name, p.description ?? "", category, ...p.variants.flatMap((v) => [v.sku ?? "", ...v.optionValues])].join(" ");
      return matchesSearch(text, input.search);
    });
    return {
      total: matches.length,
      products: matches.slice(0, input.limit).map((p) => ({
        id: p.id,
        name: p.name,
        status: p.status,
        category: p.categoryId ? (categoryName.get(p.categoryId) ?? null) : null,
        options: p.options,
        rating: p.ratingCount > 0 ? { average: Number(p.ratingAvg), count: p.ratingCount } : null,
        variants: p.variants
          .filter((v) => !v.archived)
          .map((v) => ({
            options: v.optionValues,
            sku: v.sku,
            price: money(v.priceMinor, currency),
            available: v.available,
            reserved: v.reserved,
          })),
      })),
    };
  },

  /** Variants of active products running low, lowest first. */
  async stockLevels(actor: McpActor, input: StockLevelsToolInput) {
    const products = await productService.list(actor, { includeArchived: false });
    const low = products.flatMap((p) =>
      p.variants
        .filter((v) => !v.archived && v.available <= input.threshold)
        .map((v) => ({ product: p.name, options: v.optionValues, sku: v.sku, available: v.available, reserved: v.reserved })),
    );
    low.sort((a, b) => a.available - b.available || a.product.localeCompare(b.product));
    return { threshold: input.threshold, variants: low.slice(0, input.limit), total: low.length };
  },

  /** Customer reviews, newest first; the author's name and anything contact-like in the text are masked. */
  async listReviews(actor: McpActor, input: ListReviewsToolInput) {
    const reviews = (await reviewService.list(actor, input.status)).filter(
      (r) => (input.maxRating === undefined || r.rating <= input.maxRating) && (input.minRating === undefined || r.rating >= input.minRating),
    );
    return {
      total: reviews.length,
      reviews: reviews.slice(0, input.limit).map((r) => ({
        rating: r.rating,
        comment: r.comment ? maskText(r.comment) : null,
        author: maskName(r.authorName),
        product: r.product.name,
        orderNumber: r.order.number,
        status: r.status,
        createdAt: r.createdAt,
      })),
    };
  },

  /** Orders, delivered revenue, best sellers, confirmation speed and cash-on-delivery gaps for a period. */
  async salesMetrics(actor: McpActor, input: SalesMetricsToolInput) {
    const [metrics, sales] = await Promise.all([reportingService.metrics(actor, input), reportingService.sales(actor, input)]);
    return {
      from: metrics.from,
      to: metrics.to,
      ordersCreated: metrics.ordersCreated,
      ordersPerDay: Math.round(metrics.ordersPerDay * 10) / 10,
      ordersByStatus: metrics.ordersByStatus,
      medianConfirmMinutes: metrics.medianConfirmMinutes,
      delivered: { orders: sales.deliveredOrders, revenue: money(sales.revenueMinor, sales.currency) },
      topItems: sales.topItems,
      codGaps: { count: metrics.codGaps.count, amount: money(metrics.codGaps.sumMinor, sales.currency) },
    };
  },

  /** Cash on delivery per courier: what was due, what was handed over, and where it does not match. */
  async codReconciliation(actor: McpActor, input: CodReconciliationToolInput) {
    const r = await reportingService.reconciliation(actor, input);
    const m = (minor: bigint) => money(minor, r.currency);
    const received = (x: { usdCents: bigint; lbp: bigint }) => ({ usd: money(x.usdCents, "USD"), lbp: money(x.lbp, "LBP") });
    return {
      from: r.from,
      to: r.to,
      totals: {
        due: m(r.totals.expectedMinor),
        received: received(r.totals.received),
        receivedInShopCurrency: m(r.totals.receivedMinor),
        gaps: { count: r.totals.gaps.count, amount: m(r.totals.gaps.sumMinor) },
      },
      couriers: r.couriers.map((c) => ({
        courier: { id: c.courierId, name: c.courierName },
        due: m(c.expectedMinor),
        received: received(c.received),
        gaps: { count: c.gaps.count, amount: m(c.gaps.sumMinor) },
        unpaid: c.unpaid.slice(0, 20).map((u) => ({ order: u.number, due: m(u.dueMinor), daysOutstanding: u.daysOutstanding })),
        shortOrOver: c.shortOrOver.slice(0, 20).map((g) => ({ order: g.number, due: m(g.dueMinor), paid: m(g.paidMinor), difference: m(g.diffMinor) })),
        paidButNotDelivered: c.notDeliveredButPaid.slice(0, 20).map((g) => ({ order: g.number, status: g.status, paid: m(g.paidMinor) })),
      })),
    };
  },

  /** Delivered orders whose cash a courier has not handed over yet, per courier (deactivated couriers included). */
  async unsettledCash(actor: McpActor, input: UnsettledCashToolInput) {
    const couriers = (await courierService.list(actor, {})).filter((c) => !input.courierId || c.id === input.courierId);
    if (input.courierId && couriers.length === 0) throw notFound("Courier");
    const owing = await Promise.all(
      couriers.map(async (c) => {
        const orders = await remittanceService.unsettled(actor, c.id);
        const due = new Map<Currency, bigint>();
        for (const o of orders) due.set(o.currency, (due.get(o.currency) ?? 0n) + o.codMinor);
        return {
          courier: { id: c.id, name: c.name, active: c.active },
          orderCount: orders.length,
          due: [...due].map(([currency, minor]) => money(minor, currency)),
          orders: orders.slice(0, 50).map((o) => ({
            order: o.number,
            deliveredAt: o.deliveredAt,
            due: money(o.codMinor, o.currency),
            reportedAtDoor: o.reportedUsdCents !== null || o.reportedLbp !== null
              ? { usd: money(o.reportedUsdCents ?? 0n, "USD"), lbp: money(o.reportedLbp ?? 0n, "LBP") }
              : null,
          })),
        };
      }),
    );
    return { couriers: owing.filter((c) => c.orderCount > 0) };
  },
};
