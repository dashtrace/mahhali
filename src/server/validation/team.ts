import { z } from "./zod";

// The owner role is never granted through these routes: a shop keeps the owner who signed it up.
const StaffRole = z.enum(["manager", "staff", "delivery"]).openapi("StaffRole");
const Id = z.string().min(1).max(64);

export const InviteBody = z
  .object({
    email: z.email().max(200).transform((v) => v.toLowerCase()),
    role: StaffRole,
    /** Required for delivery users: the shop's courier they deliver for. */
    courierId: Id.optional(),
  })
  .openapi("InviteBody");

export const UpdateMemberBody = z
  .object({
    role: StaffRole.optional(),
    courierId: Id.nullable().optional(),
  })
  .refine((b) => Object.keys(b).length > 0, "Send at least one field to change")
  .openapi("UpdateMemberBody");

export const TokenParam = z.object({ token: z.string().regex(/^[\w-]{20,100}$/, "Not a valid invite link") });

export const AcceptInviteBody = z
  .object({
    /** Used only when the invite creates a new account. */
    name: z.string().trim().min(1).max(100),
    password: z.string().min(8).max(128),
  })
  .openapi("AcceptInviteBody");

export const ActiveShopBody = z.object({ shopId: Id }).openapi("ActiveShopBody");

export const AdminShopsQuery = z.object({ q: z.string().trim().max(100).optional() });
export const CursorQuery = z.object({ cursor: Id.optional() });
export const SuspendBody = z.object({ suspended: z.boolean() }).openapi("SuspendBody");

// The parts of Stripe events the webhook reads; checked after the signature.
export const StripeEvent = z.object({ type: z.string(), data: z.object({ object: z.unknown() }) });
export const CheckoutCompleted = z.object({ client_reference_id: Id, customer: z.string(), subscription: z.string() });
export const SubscriptionDeleted = z.object({ id: z.string(), metadata: z.object({ shopId: Id }) });

export type InviteInput = z.infer<typeof InviteBody>;
export type UpdateMemberInput = z.infer<typeof UpdateMemberBody>;
export type AcceptInviteInput = z.infer<typeof AcceptInviteBody>;
