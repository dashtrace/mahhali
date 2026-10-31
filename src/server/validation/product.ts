import { Amount } from "./common";
import { z } from "./zod";

const optionalText = z
  .string()
  .trim()
  .max(40)
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional()
  .transform((v) => v ?? null);

const OptionName = z.string().trim().min(1).max(40);
const repeats = (names: string[]) => new Set(names.map((n) => n.toLowerCase())).size !== names.length;
/** One value per product option, in the product's order; "" leaves that option blank. */
const OptionValues = z.array(z.string().trim().max(40)).max(3);

// Strict: an old form still sending { size } gets a 400 instead of a variant with blank values.
export const VariantBody = z
  .strictObject({
    optionValues: OptionValues.default([]),
    sku: optionalText,
    price: Amount,
    stock: z.number().int().min(0).max(100_000).default(0),
  })
  .openapi("VariantInput");

const Spec = z.object({ label: z.string().trim().min(1).max(40), value: z.string().trim().min(1).max(200) });

// Optional in both create and PATCH; null clears. customLabel set = customization on.
const storefrontFields = {
  categoryId: z.string().min(1).max(64).nullable().optional(),
  featured: z.boolean().optional(),
  specs: z.array(Spec).max(12).optional(),
  customLabel: z.string().trim().max(80).nullable().optional().transform((v) => (v === "" ? null : v)),
  customPlaceholder: z.string().trim().max(120).nullable().optional().transform((v) => (v === "" ? null : v)),
  customRequired: z.boolean().optional(),
  customMaxLength: z.number().int().min(1).max(500).optional(),
};

export const CreateProductBody = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(2000).nullable().optional(),
    /** Option names, e.g. ["Size", "Colour"] or ["SPF"]; none for a product with a single variant. */
    options: z.array(OptionName).max(3).default([]),
    variants: z.array(VariantBody).min(1).max(100),
    ...storefrontFields,
  })
  .refine((p) => !repeats(p.options), { message: "Each option name can appear once", path: ["options"] })
  .refine((p) => p.variants.every((v) => v.optionValues.length === p.options.length), {
    message: "Give each variant one value per option",
    path: ["variants"],
  })
  // JSON keeps ["a|b", ""] and ["a", "b|"] apart; joining with "|" would not.
  .refine((p) => new Set(p.variants.map((v) => JSON.stringify(v.optionValues))).size === p.variants.length, {
    message: "Each combination of option values can appear once",
    path: ["variants"],
  })
  .openapi("CreateProductBody");

export const UpdateProductBody = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
    ...storefrontFields,
  })
  .refine((b) => Object.values(b).some((v) => v !== undefined), "Send at least one field to change")
  .openapi("UpdateProductBody");

export const ListProductsQuery = z.object({
  includeArchived: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});

// Like optionalText, but a missing field stays undefined ("leave it as it is").
const patchText = z
  .string()
  .trim()
  .max(40)
  .nullable()
  .optional()
  .transform((v) => (v === "" ? null : v));

export const UpdateVariantBody = z
  .strictObject({
    optionValues: OptionValues.optional(),
    sku: patchText,
    price: Amount.optional(),
    archived: z.boolean().optional(),
  })
  .refine((b) => Object.values(b).some((v) => v !== undefined), "Send at least one field to change")
  .openapi("UpdateVariantBody");

export const StockAdjustmentBody = z
  .object({
    delta: z
      .number()
      .int()
      .min(-100_000)
      .max(100_000)
      .refine((d) => d !== 0, "Use a positive number to add stock or a negative one to remove it"),
    /** Why, e.g. "damaged" or "recount". */
    note: z.string().trim().max(200).nullish().transform((v) => v || null),
  })
  .openapi("StockAdjustmentBody");

export const SetOptionsBody = z
  .object({
    /**
     * The new list, in order. `from` is the current name of the option this one keeps (renamed or
     * moved), null for a new option with blank values. Options left out lose their values.
     */
    options: z.array(z.object({ name: OptionName, from: OptionName.nullable() })).max(3),
  })
  .refine((b) => !repeats(b.options.map((o) => o.name)), { message: "Each option name can appear once", path: ["options"] })
  .refine((b) => !repeats(b.options.flatMap((o) => (o.from === null ? [] : [o.from]))), {
    message: "Each current option can be kept once",
    path: ["options"],
  })
  .openapi("SetOptionsBody");

/** Text fields sent next to an uploaded photo; the file is checked in storage/uploads. */
export const ImageFields = z.object({ optionValue: optionalText });

export const ImageParams = z.object({ id: z.string().min(1).max(64), imageId: z.string().min(1).max(64) });

export type ProductSpec = z.infer<typeof Spec>;
export type CreateProductInput = z.infer<typeof CreateProductBody>;
export type UpdateProductInput = z.infer<typeof UpdateProductBody>;
export type VariantInput = z.infer<typeof VariantBody>;
export type UpdateVariantInput = z.infer<typeof UpdateVariantBody>;
export type SetOptionsInput = z.infer<typeof SetOptionsBody>;
export type StockAdjustmentInput = z.infer<typeof StockAdjustmentBody>;
