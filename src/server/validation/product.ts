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

export const VariantBody = z
  .object({
    size: optionalText,
    colour: optionalText,
    sku: optionalText,
    price: Amount,
    stock: z.number().int().min(0).max(100_000).default(0),
  })
  .openapi("VariantInput");

export const CreateProductBody = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(2000).nullable().optional(),
    variants: z.array(VariantBody).min(1).max(100),
  })
  .refine(
    (p) => new Set(p.variants.map((v) => `${v.size ?? ""}|${v.colour ?? ""}`)).size === p.variants.length,
    { message: "Each size and colour combination can appear once", path: ["variants"] },
  )
  .openapi("CreateProductBody");

export const UpdateProductBody = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
  })
  .refine((b) => Object.keys(b).length > 0, "Send at least one field to change")
  .openapi("UpdateProductBody");

export const ListProductsQuery = z.object({
  includeArchived: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});

export type CreateProductInput = z.infer<typeof CreateProductBody>;
export type UpdateProductInput = z.infer<typeof UpdateProductBody>;
