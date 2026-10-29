import { auth } from "../auth/auth";
import { can, isShopRole, type Action } from "../domain/policy";
import { membershipRepo } from "../repositories/membershipRepo";
import { forbidden, unauthorized } from "./errors";
import type { Actor, AdminActor } from "./withRoute";

/**
 * The signed-in shop member behind a request, checked against the policy.
 * Shared by withRoute (API) and the dashboard's server components.
 */
export async function resolveActor(headers: Headers, action: Action): Promise<Actor> {
  const session = await auth.api.getSession({ headers });
  if (!session) throw unauthorized();
  const membership = await membershipRepo.findActive(session.user.id, session.session.activeOrganizationId);
  if (!membership || !isShopRole(membership.role)) throw forbidden("You are not a member of a shop.");
  if (membership.shop.suspended) throw forbidden("This shop is suspended.");
  if (!can(membership.role, action)) throw forbidden();
  return {
    userId: session.user.id,
    shopId: membership.shopId,
    role: membership.role,
    courierId: membership.courierId,
  };
}

export async function resolveAdmin(headers: Headers): Promise<AdminActor> {
  const session = await auth.api.getSession({ headers });
  if (!session) throw unauthorized();
  if (session.user.role !== "admin") throw forbidden("Platform admins only.");
  return { userId: session.user.id };
}

/** Who is signed in, without any shop or role check (for redirects after sign-in). */
export async function currentUser(headers: Headers) {
  const session = await auth.api.getSession({ headers });
  return session ? { id: session.user.id, name: session.user.name, email: session.user.email, isAdmin: session.user.role === "admin" } : null;
}
