import { collectedInOrderCurrency, type Currency } from "../domain/money";
import { firstName } from "../domain/names";
import { notFound } from "../http/errors";
import { rateLimit } from "../http/rateLimit";
import { shopRepo } from "../repositories/shopRepo";
import { trackingRepo } from "../repositories/trackingRepo";
import type { TrackInput } from "../validation/tracking";

const MINUTE = 60_000;

export const trackingService = {
  /** The customer's order page: status, items and money, nothing personal beyond a first name. */
  async view(publicToken: string, ip: string) {
    rateLimit(`tracking:${ip}`, 60, MINUTE);
    const order = await trackingRepo.findByPublicToken(publicToken);
    if (!order) throw notFound("Order");
    const rate = order.usdLbpRate?.toString() ?? null;
    const other: Currency = order.currency === "USD" ? "LBP" : "USD";
    const invite = order.reviewInvite;
    return {
      shop: order.shop,
      order: {
        number: order.number,
        status: order.status,
        placedAt: order.createdAt,
        timeline: order.events.map((e) => ({ status: e.toValue, at: e.at })),
        items: order.items.map((i) => ({ name: i.nameSnapshot, unitPriceMinor: i.unitPriceMinor, qty: i.qty })),
        currency: order.currency,
        subtotalMinor: order.subtotalMinor,
        deliveryFeeMinor: order.deliveryFeeMinor,
        totalMinor: order.totalMinor,
        // The same amounts in the other currency, at the rate frozen when the order was placed.
        converted: rate
          ? {
              currency: other,
              usdLbpRate: rate,
              subtotalMinor: convert(order.subtotalMinor, order.currency, rate),
              deliveryFeeMinor: convert(order.deliveryFeeMinor, order.currency, rate),
              totalMinor: convert(order.totalMinor, order.currency, rate),
            }
          : null,
        courier: order.courier ? { name: order.courier.name } : null,
        customerFirstName: firstName(order.customerName),
      },
      review: {
        canReview: order.status === "DELIVERED" && !!invite && !invite.usedAt && invite.expiresAt > new Date(),
      },
    };
  },

  /** "Track my order": number plus phone. One generic 404 whichever part was wrong. */
  async findToken(slug: string, input: TrackInput, ip: string) {
    rateLimit(`track:ip:${ip}`, 10, 10 * MINUTE);
    rateLimit(`track:order:${slug}:${input.number}`, 5, 10 * MINUTE);
    const shop = await shopRepo.findBySlug(slug);
    const token = shop && !shop.suspended
      ? await trackingRepo.findTokenByNumberAndPhone(shop.id, input.number, input.phone)
      : null;
    if (!token) throw notFound("Order");
    return { token };
  },
};

function convert(amount: bigint, currency: Currency, rate: string): bigint {
  const cash = currency === "USD" ? { usdCents: amount, lbp: 0n } : { usdCents: 0n, lbp: amount };
  return collectedInOrderCurrency(cash, currency === "USD" ? "LBP" : "USD", rate);
}
