import { IMPORT_MAX_PRODUCTS } from "../domain/productImport";
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

export const ListProductsToolInput = z.strictObject({
  search: z.string().trim().max(80).optional().describe("Words to find in the name, description, category, SKU or options; Arabic or English"),
  category: z.string().trim().max(40).optional().describe("Only products in this category (by name)"),
  includeArchived: z.boolean().default(false).describe("Also list archived products"),
  limit: z.number().int().min(1).max(100).default(50),
});

export const StockLevelsToolInput = z.strictObject({
  threshold: z.number().int().min(0).max(1000).default(3).describe("List variants with this many or fewer available"),
  limit: z.number().int().min(1).max(200).default(50),
});

export const ListReviewsToolInput = z.strictObject({
  status: z.enum(["PUBLISHED", "HIDDEN"]).optional(),
  minRating: z.number().int().min(1).max(5).optional(),
  maxRating: z.number().int().min(1).max(5).optional().describe("e.g. 2 to find unhappy customers"),
  limit: z.number().int().min(1).max(100).default(30),
});

export const SalesMetricsToolInput = z
  .strictObject({
    from: range.from.describe("First day, YYYY-MM-DD (UTC); 30 days before 'to' when left out"),
    to: range.to.describe("Last day, YYYY-MM-DD (UTC); today when left out"),
  })
  .refine(fromNotAfterTo, rangeMessage);

export const CodReconciliationToolInput = z
  .strictObject({
    from: range.from.describe("First day, YYYY-MM-DD (UTC); 30 days before 'to' when left out"),
    to: range.to.describe("Last day, YYYY-MM-DD (UTC); today when left out"),
    courierId: z.string().min(1).max(64).optional().describe("Only this courier (id from an earlier result)"),
  })
  .refine(fromNotAfterTo, rangeMessage);

export const UnsettledCashToolInput = z.strictObject({
  courierId: z.string().min(1).max(64).optional().describe("Only this courier (id from an earlier result)"),
});

// Rows are checked one by one against the product schema (CreateProductBody),
// so one bad row is reported in the preview instead of failing the whole call.
const ImportVariant = z.strictObject({
  optionValues: z.array(z.string().max(60)).max(5).optional().describe("One value per option, in the product's option order, e.g. [\"M\", \"Black\"]"),
  sku: z.string().max(60).nullish(),
  price: z.union([z.string().max(20), z.number().nonnegative()]).describe("In the shop's currency, e.g. \"25\" or \"25.50\" for USD, \"450000\" for LBP"),
  stock: z.number().int().min(0).max(100_000).optional().describe("Items available; 0 when not given"),
});

const ImportProduct = z.strictObject({
  name: z.string().max(200),
  description: z.string().max(4000).nullish(),
  category: z.string().max(60).nullish().describe("Category name; a new one is created if the shop has none by that name"),
  options: z.array(z.string().max(60)).max(5).optional().describe("Option names such as [\"Size\", \"Colour\"]; none for a product with one variant"),
  variants: z.array(ImportVariant).min(1).max(100),
});

export const PreviewImportToolInput = z.strictObject({
  products: z.array(ImportProduct).min(1).max(IMPORT_MAX_PRODUCTS),
});

export type ListOrdersToolInput = z.infer<typeof ListOrdersToolInput>;
export type GetOrderToolInput = z.infer<typeof GetOrderToolInput>;
export type MyDeliveriesToolInput = z.infer<typeof MyDeliveriesToolInput>;
export type ListProductsToolInput = z.infer<typeof ListProductsToolInput>;
export type StockLevelsToolInput = z.infer<typeof StockLevelsToolInput>;
export type ListReviewsToolInput = z.infer<typeof ListReviewsToolInput>;
export type SalesMetricsToolInput = z.infer<typeof SalesMetricsToolInput>;
export type CodReconciliationToolInput = z.infer<typeof CodReconciliationToolInput>;
export type UnsettledCashToolInput = z.infer<typeof UnsettledCashToolInput>;
export type PreviewImportToolInput = z.infer<typeof PreviewImportToolInput>;
