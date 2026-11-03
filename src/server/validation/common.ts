import { emailTypo } from "../domain/email";
import { passwordProblem, type PasswordProblem } from "../domain/password";
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

/** An email address; a slip in a big provider's domain (name@gmail.cam) is refused with the fix. */
export const Email = z
  .email()
  .max(200)
  .superRefine((v, ctx) => {
    const fix = emailTypo(v);
    if (fix) ctx.addIssue({ code: "custom", message: `Check the email address. Did you mean ${fix}?` });
  });

const WEAK: Record<PasswordProblem, string> = {
  Short: "Use at least 8 characters.",
  Common: "This password is too easy to guess.",
  NoLetter: "Add at least one letter.",
  NoDigitOrSymbol: "Add a number or a symbol.",
};

/** Why a new password is refused (English, for API errors), or null. */
export function weakPassword(password: string): string | null {
  const problem = passwordProblem(password);
  return problem && WEAK[problem];
}

/** A new account's password. The length check stays separate, so a short one gets one message. */
export const NewPassword = z
  .string()
  .min(8)
  .max(128)
  .superRefine((v, ctx) => {
    const why = v.length >= 8 && weakPassword(v);
    if (why) ctx.addIssue({ code: "custom", message: why });
  });

export const ErrorBody = z
  .object({
    error: z.object({
      code: z.string(),
      message: z.string(),
      details: z.unknown().optional(),
    }),
  })
  .openapi("Error");
