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
          return {
            orderId: l.orderId,
            collectedUsdCents: toMinor(l.collectedUsd, "USD"),
            collectedLbp: BigInt(l.collectedLbp),
            feeMinor,
          };
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

  /** What the owner ticks off while the courier is handing over cash. */
  async unsettled(actor: Actor, courierId: string) {
    await this.requireCourier(actor, courierId);
    return remittanceRepo.unsettled(actor.shopId, courierId);
  },
};
