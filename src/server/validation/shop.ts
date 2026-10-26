import { FONTS, PALETTE_NAMES, RADII } from "../domain/theme";
import { Amount, Phone, Rate } from "./common";
import { z } from "./zod";

/** Pilot baseline from sign-up: the "before" numbers for the outcome metrics. */
export const BaselineOrdersPerDay = z.number().int().min(0).max(100_000);
export const BaselineConfirmMinutes = z.number().int().min(0).max(100_000);

// Strict: currency is fixed at sign-up, so sending it is an error, not a silent no-op.
export const ShopSettingsBody = z
  .strictObject({
    name: z.string().trim().min(1).max(100).optional(),
    usdLbpRate: Rate.optional(),
    deliveryFee: Amount.optional(),
    codTolerance: Amount.optional(),
    autoCancelHours: z.number().int().min(1).max(720).nullable().optional(),
    whatsappPhone: Phone.nullable().optional(),
    language: z.enum(["en", "ar"]).optional(),
    baselineOrdersPerDay: BaselineOrdersPerDay.nullable().optional(),
    baselineConfirmMinutes: BaselineConfirmMinutes.nullable().optional(),
  })
  .refine((b) => Object.values(b).some((v) => v !== undefined), "Send at least one field to change")
  .openapi("ShopSettingsBody");

const Hex = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use a colour like #1e3a8a")
  .transform((v) => v.toLowerCase());

export const ThemeBody = z
  .object({ primary: Hex, accent: Hex, background: Hex, radius: z.enum(RADII), font: z.enum(FONTS) })
  .openapi("Theme");

export const BrandingBody = z
  .union([ThemeBody, z.object({ preset: z.enum(PALETTE_NAMES) })])
  .openapi("BrandingBody");

export type ShopSettingsInput = z.infer<typeof ShopSettingsBody>;
export type BrandingInput = z.infer<typeof BrandingBody>;
