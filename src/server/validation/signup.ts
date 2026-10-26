import { isValidSlug } from "../domain/slug";
import { Currency, Rate } from "./common";
import { BaselineConfirmMinutes, BaselineOrdersPerDay } from "./shop";
import { z } from "./zod";

export const SignupBody = z
  .object({
    name: z.string().trim().min(1).max(100),
    email: z.email().max(200),
    password: z.string().min(8).max(128),
    shopName: z.string().trim().min(1).max(100),
    shopSlug: z
      .string()
      .trim()
      .toLowerCase()
      .refine(isValidSlug, "Use 3 to 40 lowercase letters, digits or single dashes"),
    currency: Currency.default("USD"),
    usdLbpRate: Rate.optional(),
    // "How many orders a day? How long to confirm one?" before using Shop Link.
    baselineOrdersPerDay: BaselineOrdersPerDay.optional(),
    baselineConfirmMinutes: BaselineConfirmMinutes.optional(),
  })
  .openapi("SignupBody");

export type SignupInput = z.infer<typeof SignupBody>;
