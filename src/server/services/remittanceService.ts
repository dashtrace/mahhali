import { conflict, notFound, unprocessable } from "../http/errors";
import type { Actor } from "../http/withRoute";
import { periodOf } from "../domain/metrics";
import { toMinor } from "../domain/money";
import { remittanceRepo } from "../repositories/remittanceRepo";
import { shopRepo } from "../repositories/shopRepo";
import { isUniqueViolation, transaction } from "../repositories/tx";
import type { CourierPeriodInput, CreateRemittanceInput } from "../validation/money";

const alreadySettled = (numbers: number[]) =>
  conflict("ALREADY_SETTLED", "A remittance already paid for these orders.", { orders: numbers });

export const remittanceService = {
  async requireCourier(actor: Actor, courierId: string) {
    const courier = await remittanceRepo.findCourier(actor.shopId, courierId);
    if (!courier) throw notFound("Courier");
    return courier;
  },

  /** Records cash a courier handed over, with one line per order it pays for. */
  async create(actor: Actor, input: CreateRemittanceInput) {
    const shop = await shopRepo.findById(actor.shopId);
    if (!shop) throw notFound("Shop");
    const amountUsdCents = toMinor(input.amountUsd, "USD");
    const amountLbp = BigInt(input.amountLbp);
    // Reconciliation converts the other currency with the shop's rate.
    const foreign = (usdCents: bigint, lbp: bigint) => (shop.currency === "USD" ? lbp : usdCents) > 0n;
    const anyForeign =
      foreign(amountUsdCents, amountLbp) ||
      input.lines.some((l) => foreign(toMinor(l.collectedUsd, "USD"), BigInt(l.collectedLbp)));
    if (anyForeign && !shop.usdLbpRate) {
      throw unprocessable("RATE_MISSING", "Set the shop's exchange rate before recording cash in both currencies.");
    }

    try {
      return await transaction(async (tx) => {
        const courier = await remittanceRepo.findCourier(actor.shopId, input.courierId, tx);
        if (!courier) throw notFound("Courier");
        const orders = new Map(
          (await remittanceRepo.ordersForLines(actor.shopId, input.lines.map((l) => l.orderId), tx)).map((o) => [o.id, o]),
        );
        if (orders.size !== input.lines.length) throw notFound("Order");
        const all = [...orders.values()];
        const wrong = all.filter((o) => o.courierId !== input.courierId);
        if (wrong.length > 0) {
          throw unprocessable("WRONG_COURIER", "Some orders are not assigned to this courier.", {
            orders: wrong.map((o) => o.number),
          });
        }
        const settled = all.filter((o) => o.remittanceLine);
        if (settled.length > 0) throw alreadySettled(settled.map((o) => o.number));

        const lines = input.lines.map((l) => {
          const currency = orders.get(l.orderId)?.currency ?? shop.currency;
          let feeMinor: bigint;
          try {
            feeMinor = toMinor(l.fee, currency);
          } catch {
            throw unprocessable("INVALID_AMOUNT", "Fees in pounds must be whole pounds.");
          }
          const order = orders.get(l.orderId)!;
          const reported = order.reportedUsdCents !== null || order.reportedLbp !== null;
          const usd = reported ? order.reportedUsdCents ?? 0n : order.currency === "USD" ? order.codMinor : 0n;
          const lbp = reported ? order.reportedLbp ?? 0n : order.currency === "LBP" ? order.codMinor : 0n;
          if (toMinor(l.collectedUsd, "USD") !== usd || BigInt(l.collectedLbp) !== lbp) {
            throw unprocessable("REPORTED_CASH_LOCKED", "Collected amounts must match the recorded delivery.");
          }
          return { orderId: l.orderId, collectedUsdCents: usd, collectedLbp: lbp, feeMinor };
        });
        return remittanceRepo.create(tx, actor.shopId, {
          courierId: input.courierId,
          amountUsdCents,
          amountLbp,
          receivedAt: new Date(input.receivedAt),
          reference: input.reference,
          recordedByUserId: actor.userId,
          lines,
        });
      });
    } catch (error) {
      // Two remittances racing for the same order: RemittanceLine.orderId is unique.
      if (isUniqueViolation(error)) throw alreadySettled([]);
      throw error;
    }
  },

  async list(actor: Actor, query: CourierPeriodInput) {
    if (query.courierId) await this.requireCourier(actor, query.courierId);
    const period = periodOf(query.from, query.to, new Date());
    const remittances = await remittanceRepo.list(actor.shopId, { courierId: query.courierId, ...period });
    return { from: period.from, to: period.to, remittances };
  },

  async get(actor: Actor, id: string) {
    const remittance = await remittanceRepo.find(actor.shopId, id);
    if (!remittance) throw notFound("Remittance");
    return remittance;
  },

  /** What the owner ticks off while the courier is handing over cash. */
  async unsettled(actor: Actor, courierId: string) {
    await this.requireCourier(actor, courierId);
    return remittanceRepo.unsettled(actor.shopId, courierId);
  },

  /** The original remittance remains unchanged; each later receipt is append-only. */
  async addPayment(actor: Actor, id: string, data: { amountUsd: string; amountLbp: string; reason: string; requestKey: string }) {
    const r = await this.get(actor, id);
    const earlier = await remittanceRepo.findSupplementByKey(actor.shopId, data.requestKey);
    if (earlier) {
      if (earlier.remittanceId !== id || earlier.amountUsdCents !== toMinor(data.amountUsd, "USD") || earlier.amountLbp !== BigInt(data.amountLbp))
        throw conflict("REQUEST_KEY_REUSED", "This payment key was already used for a different payment.");
      return earlier;
    }
    if (r.resolution) throw conflict("ACCEPTED", "This discrepancy was already accepted.");
    const usd = toMinor(data.amountUsd, "USD");
    const lbp = BigInt(data.amountLbp);
    if (usd === 0n && lbp === 0n) throw unprocessable("ZERO_PAYMENT", "Enter an amount received.");
    const shop = await shopRepo.findById(actor.shopId);
    if (!shop) throw notFound("Shop");
    if ((shop.currency === "USD" ? lbp : usd) > 0n && !shop.usdLbpRate) {
      throw unprocessable("RATE_MISSING", "Set the exchange rate before recording foreign currency.");
    }
    try {
      return await remittanceRepo.addSupplement(actor.shopId, id, { amountUsdCents: usd, amountLbp: lbp, reason: data.reason, recordedByUserId: actor.userId, requestKey: data.requestKey });
    } catch (e) {
      if (isUniqueViolation(e)) {
        const saved = await remittanceRepo.findSupplementByKey(actor.shopId, data.requestKey);
        if (saved && saved.remittanceId === id && saved.amountUsdCents === usd && saved.amountLbp === lbp) return saved;
      }
      throw e;
    }
  },

  async acceptDifference(actor: Actor, id: string, reason: string) {
    const r = await this.get(actor, id);
    if (r.resolution) throw conflict("ALREADY_ACCEPTED", "This remittance is already resolved.");
    return remittanceRepo.acceptDifference(actor.shopId, id, reason, actor.userId);
  },

  async acceptOrderDifference(actor: Actor, orderId: string, reason: string) {
    const order = await remittanceRepo.findCashOrder(actor.shopId, orderId);
    if (!order) throw notFound("Delivered remitted order");
    if (order.cashResolution) throw conflict("ALREADY_ACCEPTED", "This order difference is already resolved.");
    return remittanceRepo.acceptOrderDifference(actor.shopId, orderId, reason, actor.userId);
  },
};
