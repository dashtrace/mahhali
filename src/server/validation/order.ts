import { GOVERNORATES } from "../domain/lebanon";
import { ORDER_STATUSES } from "../domain/orderStatus";
import { Amount, Phone } from "./common";
import { z } from "./zod";

const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

export const OrderLine = z.object({
  variantId: z.string().min(1).max(64),
  qty: z.number().int().min(1).max(20),
  /** Customization text, for products that ask for one; dropped otherwise. */
  note: optionalText(500),
});

export const Address = z
  .object({
    governorate: z.enum(GOVERNORATES),
    district: text(60),
    area: text(80),
    /** Street, building and floor. */
    addressLine: text(200),
    landmark: optionalText(200),
  })
  .openapi("Address");

const orderFields = {
  items: z
    .array(OrderLine)
    .min(1)
    .max(20)
    // One variant may appear on several lines with different notes.
    .refine(
      (lines) => new Set(lines.map((l) => JSON.stringify([l.variantId, l.note]))).size === lines.length,
      "List each variant and note once",
    )
    // Split lines must not lift the per-variant cap of 20 (notes are dropped for plain products).
    .refine((lines) => {
      const qty = new Map<string, number>();
      for (const l of lines) qty.set(l.variantId, (qty.get(l.variantId) ?? 0) + l.qty);
      return [...qty.values()].every((n) => n <= 20);
    }, "Order at most 20 of each variant"),
  customer: z.object({
    name: text(80),
    phone: Phone,
    email: z.email().max(200).nullish().transform((v) => v ?? null),
  }),
  address: Address,
  notes: optionalText(500),
};

export const PlaceOrderBody = z.object(orderFields).openapi("PlaceOrderBody");

/** Staff entering an order that came in by Instagram DM or WhatsApp. */
export const ManualOrderBody = z
  .object({
    ...orderFields,
    /** When the customer first wrote; defaults to now. Feeds the outcome metrics. */
    firstContactAt: z.iso.datetime({ offset: true }).optional(),
    /** Overrides the shop's default delivery fee for this order. */
    deliveryFee: Amount.optional(),
  })
  .openapi("ManualOrderBody");

export const OrderStatusEnum = z.enum(ORDER_STATUSES).openapi("OrderStatus");

export const ListOrdersQuery = z.object({
  status: OrderStatusEnum.optional(),
  courierId: z.string().min(1).max(64).optional(),
  /** Order number (#1042), phone digits or part of the customer's name. */
  q: z.string().trim().max(80).optional(),
  cursor: z.string().min(1).max(64).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const UpdateOrderBody = z
  .object({
    address: Address.partial().optional(),
    notes: optionalText(500).optional(),
    /** null unassigns. */
    courierId: z.string().min(1).max(64).nullable().optional(),
  })
  .refine((b) => Object.keys(b).length > 0, "Send at least one field to change")
  .openapi("UpdateOrderBody");

/** Cash the courier collected at the door, in the currency it was paid in. */
const Collected = {
  collectedUsd: Amount.optional(),
  collectedLbp: z.string().regex(/^\d{1,12}$/, "Whole pounds").optional(),
};

export const TransitionBody = z
  .object({
    to: OrderStatusEnum,
    note: optionalText(300),
    ...Collected,
  })
  .openapi("TransitionBody");

export const DeliveredBody = z.object(Collected).openapi("DeliveredBody");

export const FailedBody = z.object({ reason: text(300) }).openapi("FailedBody");

export const DeliveryOrdersQuery = z.object({
  view: z.enum(["active", "done"]).default("active"),
  /** Desk roles only: one courier's run. */
  courierId: z.string().min(1).max(64).optional(),
});

export type PlaceOrderInput = z.infer<typeof PlaceOrderBody>;
export type ManualOrderInput = z.infer<typeof ManualOrderBody>;
export type ListOrdersInput = z.infer<typeof ListOrdersQuery>;
export type UpdateOrderInput = z.infer<typeof UpdateOrderBody>;
export type TransitionInput = z.infer<typeof TransitionBody>;
