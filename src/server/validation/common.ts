import { isValidSlug } from "../domain/slug";
import { normalizePhone } from "../domain/phone";
import { z } from "./zod";

export const IdParam = z.object({ id: z.string().min(1).max(64) });
export const SlugParam = z.object({
  slug: z.string().refine(isValidSlug, "Not a valid shop link"),
});

export const Currency = z.enum(["USD", "LBP"]).openapi("Currency");

/** A decimal amount as text, e.g. "12.50" for USD or "450000" for LBP. */
export const Amount = z
  .string()
  .regex(/^\d{1,12}(\.\d{1,2})?$/, "Use digits with up to two decimals, e.g. 12.50")
  .openapi({ example: "12.50" });

export const Rate = z
  .string()
  .regex(/^\d{1,9}(\.\d{1,2})?$/, "Use pounds per dollar, e.g. 89500")
  .refine((v) => Number(v) > 0, "Must be more than zero")
  .openapi({ example: "89500" });

export const Phone = z
  .string()
  .transform((v, ctx) => {
    const normalized = normalizePhone(v);
    if (!normalized) {
      ctx.addIssue({ code: "custom", message: "Not a valid phone number" });
      return z.NEVER;
    }
    return normalized;
  })
  .openapi({ type: "string", example: "+96171123456" });

export const ErrorBody = z
  .object({
    error: z.object({
      code: z.string(),
      message: z.string(),
      details: z.unknown().optional(),
    }),
  })
  .openapi("Error");
