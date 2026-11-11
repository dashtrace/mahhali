import { range, fromNotAfterTo, rangeMessage } from "./money";
import { OrderStatusEnum } from "./order";
import { z } from "./zod";

// Inputs of the tools AI assistants call on /api/mcp. Strict: an unknown field
// (a shopId, a role) is refused rather than ignored, since the shop and role
// come only from the access token. Descriptions are read by the assistant.

export const ShopInfoInput = z.strictObject({});

export const ListOrdersToolInput = z
  .strictObject({
    status: OrderStatusEnum.optional().describe("Only orders in this status"),
    search: z
      .string()
      .trim()
      .max(80)
      .optional()
      .describe("An order number (#1042), digits of the customer's phone, part of their name, or part of an item's name"),
    from: range.from.describe("Created on or after this day, YYYY-MM-DD (UTC)"),
    to: range.to.describe("Created on or before this day, YYYY-MM-DD (UTC)"),
    courierId: z.string().min(1).max(64).optional().describe("Only orders assigned to this courier (id from an earlier result)"),
    limit: z.number().int().min(1).max(50).default(20),
    cursor: z.string().min(1).max(64).optional().describe("nextCursor from the previous page"),
  })
  .refine(fromNotAfterTo, rangeMessage);

export const GetOrderToolInput = z.strictObject({
  number: z.number().int().min(1).max(99_999_999).describe("The order number, e.g. 1042 for #1042"),
});

export const MyDeliveriesToolInput = z.strictObject({
  view: z.enum(["active", "done"]).default("active").describe("active: packed or out for delivery; done: delivered or returned in the last 7 days"),
});

export type ListOrdersToolInput = z.infer<typeof ListOrdersToolInput>;
export type GetOrderToolInput = z.infer<typeof GetOrderToolInput>;
export type MyDeliveriesToolInput = z.infer<typeof MyDeliveriesToolInput>;
