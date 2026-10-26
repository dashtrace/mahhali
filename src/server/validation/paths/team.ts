import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import type { ZodType } from "zod";
import { IdParam } from "../common";
import {
  AcceptInviteBody,
  ActiveShopBody,
  AdminShopsQuery,
  CursorQuery,
  InviteBody,
  SuspendBody,
  TokenParam,
  UpdateMemberBody,
} from "../team";
import { z } from "../zod";
import type { PathHelpers } from "./helpers";

// Staff and invitations, platform admin, billing.
export function registerTeam(r: OpenAPIRegistry, { secured, ok, error, errors }: PathHelpers) {
  const body = (schema: ZodType) => ({ content: { "application/json": { schema } } });
  const gone = error("Invitation expired (INVITE_EXPIRED) or already used (INVITE_USED)");

  r.registerPath({
    method: "get",
    path: "/api/staff",
    summary: "Members and pending invitations (owner)",
    tags: ["Staff"],
    security: secured,
    responses: { 200: ok("Members and invitations"), 401: errors[401], 403: errors[403] },
  });
  r.registerPath({
    method: "post",
    path: "/api/staff/invites",
    summary: "Invite a manager, staff or delivery user by email (owner); replaces a pending invite for the same email",
    tags: ["Staff"],
    security: secured,
    request: { body: body(InviteBody) },
    responses: {
      201: ok("Invitation, its link, and whether the email was sent"),
      ...errors,
      409: error("Already a member (ALREADY_MEMBER)"),
      422: error("Delivery invite without a courier (COURIER_REQUIRED)"),
    },
  });
  r.registerPath({
    method: "delete",
    path: "/api/staff/invites/{id}",
    summary: "Revoke a pending invitation (owner)",
    tags: ["Staff"],
    security: secured,
    request: { params: IdParam },
    responses: { 204: { description: "Revoked" }, ...errors },
  });
  r.registerPath({
    method: "patch",
    path: "/api/staff/{id}",
    summary: "Change a member's role or courier (owner); {id} is the membership id",
    tags: ["Staff"],
    security: secured,
    request: { params: IdParam, body: body(UpdateMemberBody) },
    responses: {
      200: ok("Updated member"),
      ...errors,
      422: error("The owner cannot be changed (OWNER_PROTECTED), or delivery without a courier (COURIER_REQUIRED)"),
    },
  });
  r.registerPath({
    method: "delete",
    path: "/api/staff/{id}",
    summary: "Remove a member's access (owner); not the owner",
    tags: ["Staff"],
    security: secured,
    request: { params: IdParam },
    responses: { 204: { description: "Removed" }, ...errors, 422: error("The owner cannot be removed (OWNER_PROTECTED)") },
  });
  r.registerPath({
    method: "get",
    path: "/api/public/invites/{token}",
    summary: "What an invite link offers: shop, email, role, and whether the email already has an account",
    tags: ["Public"],
    request: { params: TokenParam },
    responses: { 200: ok("Invitation"), 400: errors[400], 404: errors[404], 410: gone },
  });
  r.registerPath({
    method: "post",
    path: "/api/public/invites/{token}/accept",
    summary: "Accept an invite: creates the account or checks the existing password, adds the membership and signs in",
    tags: ["Public"],
    request: { params: TokenParam, body: body(AcceptInviteBody) },
    responses: {
      200: ok("Signed in as the new member; session cookie set"),
      400: errors[400],
      401: error("Wrong password for the existing account (INVALID_PASSWORD)"),
      404: errors[404],
      409: error("Already a member (ALREADY_MEMBER)"),
      410: gone,
      429: error("Too many attempts"),
    },
  });
  r.registerPath({
    method: "get",
    path: "/api/me/shops",
    summary: "Shops the signed-in user belongs to, with their role in each",
    tags: ["Accounts"],
    security: secured,
    responses: { 200: ok("Memberships"), 401: errors[401], 403: errors[403] },
  });
  r.registerPath({
    method: "post",
    path: "/api/me/active-shop",
    summary: "Switch the session to another shop the user belongs to",
    tags: ["Accounts"],
    security: secured,
    request: { body: body(ActiveShopBody) },
    responses: { 200: ok("Active shop and role"), ...errors },
  });

  const adminErrors = { 401: errors[401], 403: error("Platform admins only") };
  r.registerPath({
    method: "get",
    path: "/api/admin/shops",
    summary: "All shops with member, product and order counts (platform admin; audited)",
    tags: ["Admin"],
    security: secured,
    request: { query: AdminShopsQuery },
    responses: { 200: ok("Shops"), ...adminErrors },
  });
  r.registerPath({
    method: "get",
    path: "/api/admin/shops/{id}",
    summary: "One shop's details and members (platform admin; audited)",
    tags: ["Admin"],
    security: secured,
    request: { params: IdParam },
    responses: { 200: ok("Shop"), ...adminErrors, 404: errors[404] },
  });
  r.registerPath({
    method: "get",
    path: "/api/admin/shops/{id}/orders",
    summary: "A shop's orders, newest first, 50 per page (platform admin; audited, read-only)",
    tags: ["Admin"],
    security: secured,
    request: { params: IdParam, query: CursorQuery },
    responses: { 200: ok("{ items, nextCursor }"), ...adminErrors, 404: errors[404] },
  });
  r.registerPath({
    method: "post",
    path: "/api/admin/shops/{id}/suspend",
    summary: "Suspend or restore a shop (platform admin; audited)",
    tags: ["Admin"],
    security: secured,
    request: { params: IdParam, body: body(SuspendBody) },
    responses: { 200: ok("{ id, suspended }"), 400: errors[400], ...adminErrors, 404: errors[404] },
  });
  r.registerPath({
    method: "get",
    path: "/api/admin/audit-log",
    summary: "Every admin request, newest first, 50 per page (platform admin)",
    tags: ["Admin"],
    security: secured,
    request: { query: CursorQuery },
    responses: { 200: ok("{ items, nextCursor }"), ...adminErrors },
  });

  r.registerPath({
    method: "get",
    path: "/api/billing/plans",
    summary: "Plans for the pricing page",
    tags: ["Billing"],
    responses: { 200: ok("Plans") },
  });
  r.registerPath({
    method: "post",
    path: "/api/billing/checkout",
    summary: "Start a Stripe Checkout Session (test mode) for the Pro plan (owner)",
    tags: ["Billing"],
    security: secured,
    responses: {
      200: ok("{ url } of the Stripe Checkout page"),
      401: errors[401],
      403: errors[403],
      409: error("Already on Pro (ALREADY_SUBSCRIBED)"),
      502: error("Stripe refused the request"),
      503: error("Stripe keys are not configured (BILLING_NOT_CONFIGURED)"),
    },
  });
  r.registerPath({
    method: "post",
    path: "/api/billing/webhook",
    summary: "Stripe webhook: checkout.session.completed sets Pro, customer.subscription.deleted sets Free",
    description: "Verified with the Stripe-Signature header over the raw body. Other events are acknowledged and ignored.",
    tags: ["Billing"],
    request: { headers: z.object({ "stripe-signature": z.string() }) },
    responses: {
      200: ok("{ received, handled }"),
      400: error("Bad signature (INVALID_SIGNATURE) or not a Stripe event"),
      503: error("Webhook secret is not configured (BILLING_NOT_CONFIGURED)"),
    },
  });
}
