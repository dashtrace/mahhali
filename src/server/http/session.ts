import { auth } from "../auth/auth";
import { hashOAuthToken, mcpResourceUrl } from "../auth/oauth";
import { can, isShopRole, type Action } from "../domain/policy";
import { membershipRepo } from "../repositories/membershipRepo";
import { oauthRepo } from "../repositories/oauthRepo";
import { forbidden, invalidToken, unauthorized } from "./errors";
import type { Actor, AdminActor, McpActor, UserActor } from "./withRoute";

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

/**
 * The shop member behind an AI assistant's call to /api/mcp. The token is
 * checked against the database every time, and the membership is loaded
 * again, so a revoke, a removed member, a role change or a suspension applies
 * to the very next call. Which tools the actor may use is decided per tool
 * (mcpPolicy.canUseTool), from the role and the token's scopes.
 */
export async function resolveMcpActor(headers: Headers): Promise<McpActor> {
  const bearer = /^Bearer\s+(\S+)$/i.exec(headers.get("authorization") ?? "")?.[1];
  if (!bearer) throw invalidToken("Connect Mahhali to continue.");
  const token = await oauthRepo.findAccessToken(hashOAuthToken(bearer));
  if (!token || token.revoked || token.expiresAt <= new Date() || token.client.disabled) throw invalidToken();
  // Issued for this endpoint (RFC 8707 audience), for a user and a shop.
  if (!token.resources.includes(mcpResourceUrl()) || !token.userId || !token.referenceId) throw invalidToken();
  const banned = token.user?.banned && (!token.user.banExpires || token.user.banExpires > new Date());
  if (banned) throw invalidToken();

  const membership = await membershipRepo.findActive(token.userId, token.referenceId);
  if (!membership || membership.shopId !== token.referenceId || !isShopRole(membership.role)) {
    throw forbidden("You are no longer a member of this shop.");
  }
  if (membership.shop.suspended) throw forbidden("This shop is suspended.");
  return {
    userId: token.userId,
    shopId: membership.shopId,
    role: membership.role,
    courierId: membership.courierId,
    clientId: token.clientId,
    scopes: token.scopes,
  };
}

export async function resolveAdmin(headers: Headers): Promise<AdminActor> {
  const session = await auth.api.getSession({ headers });
  if (!session) throw unauthorized();
  if (session.user.role !== "admin") throw forbidden("Platform admins only.");
  return { userId: session.user.id };
}

export async function resolveUser(headers: Headers): Promise<UserActor> {
  const session = await auth.api.getSession({ headers });
  if (!session) throw unauthorized();
  return { userId: session.user.id };
}

/** Who is signed in, without any shop or role check (for redirects after sign-in). */
export async function currentUser(headers: Headers) {
  const session = await auth.api.getSession({ headers });
  return session ? { id: session.user.id, name: session.user.name, email: session.user.email, isAdmin: session.user.role === "admin" } : null;
}
