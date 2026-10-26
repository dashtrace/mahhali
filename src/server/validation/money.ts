import { Amount } from "./common";
import { z } from "./zod";

const CourierId = z.string().min(1).max(64);
const Pounds = z.string().regex(/^\d{1,12}$/, "Whole pounds, e.g. 450000").openapi({ example: "450000" });
const Day = z.iso.date().openapi({ example: "2026-10-01" });

export const RemittanceLineBody = z
  .object({
    orderId: z.string().min(1).max(64),
    collectedUsd: Amount.default("0"),
    collectedLbp: Pounds.default("0"),
    /** Courier fee kept back, in the order's (the shop's) currency. */
    fee: Amount.default("0"),
  })
  .openapi("RemittanceLineInput");

export const CreateRemittanceBody = z
  .object({
    courierId: CourierId,
    receivedAt: Day,
    /** What the courier handed over, in the currency it was paid in. */
    amountUsd: Amount.default("0"),
    amountLbp: Pounds.default("0"),
    reference: z.string().trim().max(120).nullish().transform((v) => (v ? v : null)),
    lines: z
      .array(RemittanceLineBody)
      .min(1)
      .max(500)
      .refine((lines) => new Set(lines.map((l) => l.orderId)).size === lines.length, "List each order once"),
  })
  .openapi("CreateRemittanceBody");

const range = { from: Day.optional(), to: Day.optional() };
// "to" defaults to today, so a lone "from" must not be in the future either.
const fromNotAfterTo = (q: { from?: string; to?: string }) =>
  !q.from || q.from <= (q.to ?? new Date().toISOString().slice(0, 10));
const rangeMessage = { message: "from must not be after to", path: ["from"] };

/** YYYY-MM-DD, inclusive, in UTC; the last 30 days by default. */
export const PeriodQuery = z.object(range).refine(fromNotAfterTo, rangeMessage);

export const CourierPeriodQuery = z
  .object({ ...range, courierId: CourierId.optional() })
  .refine(fromNotAfterTo, rangeMessage);

export const UnsettledQuery = z.object({ courierId: CourierId });

export type CreateRemittanceInput = z.infer<typeof CreateRemittanceBody>;
export type PeriodInput = z.infer<typeof PeriodQuery>;
export type CourierPeriodInput = z.infer<typeof CourierPeriodQuery>;
