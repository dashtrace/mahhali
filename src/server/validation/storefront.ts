import { HOME_SECTIONS, LOGO_MODES, isAllowedSocialUrl } from "../domain/storefront";
import { z } from "./zod";

// In a PATCH: missing = leave as it is, "" or null = clear.
const clearable = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v === "" ? null : v));

const socialUrl = (network: "instagram" | "facebook") =>
  z
    .string()
    .trim()
    .max(300)
    .refine((v) => v === "" || isAllowedSocialUrl(network, v), `Use an https://${network}.com link`)
    .nullable()
    .optional()
    .transform((v) => (v === "" ? null : v));

export const StorefrontBody = z
  .strictObject({
    tagline: clearable(80),
    about: clearable(2000),
    shippingInfo: clearable(2000),
    instagramUrl: socialUrl("instagram"),
    facebookUrl: socialUrl("facebook"),
    logoMode: z.enum(LOGO_MODES).optional(),
    homeSection: z.enum(HOME_SECTIONS).optional(),
    showTestimonials: z.boolean().optional(),
  })
  .refine((b) => Object.values(b).some((v) => v !== undefined), "Send at least one field to change")
  .openapi("StorefrontBody");

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => v || null);

/** Text fields sent next to the slide image; the file is checked in storage/uploads. */
export const SlideFields = z.object({
  kicker: optionalText(40),
  title: z.string().trim().min(1).max(80),
  body: optionalText(160),
});

export const UpdateSlideBody = z
  .object({
    kicker: clearable(40),
    title: z.string().trim().min(1).max(80).optional(),
    body: clearable(160),
    /** 0-based place in the carousel; the others shift to make room. */
    position: z.number().int().min(0).max(100).optional(),
  })
  .refine((b) => Object.values(b).some((v) => v !== undefined), "Send at least one field to change")
  .openapi("UpdateSlideBody");

const CategoryName = z.string().trim().min(1).max(40);

export const CategoryBody = z.object({ name: CategoryName }).openapi("CategoryBody");

export const UpdateCategoryBody = z
  .object({ name: CategoryName.optional(), position: z.number().int().min(0).max(100).optional() })
  .refine((b) => Object.values(b).some((v) => v !== undefined), "Send at least one field to change")
  .openapi("UpdateCategoryBody");

const TestimonialStatus = z.enum(["PENDING", "APPROVED", "REJECTED"]).openapi("TestimonialStatus");

export const TestimonialBody = z
  .object({
    authorName: z.string().trim().min(1).max(60),
    // Counted in characters like the database CHECK, so 5 emoji (10 UTF-16 units) is too short.
    message: z.string().trim().min(10).max(1000).refine((v) => [...v].length >= 10, "Write at least 10 characters"),
    /** The customer agrees to public display once the shop approves it. */
    consent: z.literal(true, "Agree to public display to send a testimonial"),
  })
  .openapi("TestimonialBody");

export const ListTestimonialsQuery = z.object({ status: TestimonialStatus.optional() });

export const ModerateTestimonialBody = z
  .object({ status: z.enum(["APPROVED", "REJECTED"]) })
  .openapi("ModerateTestimonialBody");

export type StorefrontInput = z.infer<typeof StorefrontBody>;
export type UpdateSlideInput = z.infer<typeof UpdateSlideBody>;
export type UpdateCategoryInput = z.infer<typeof UpdateCategoryBody>;
export type TestimonialInput = z.infer<typeof TestimonialBody>;
export type TestimonialStatusValue = z.infer<typeof TestimonialStatus>;
