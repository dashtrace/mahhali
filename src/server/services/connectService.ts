import { auth } from "../auth/auth";
import { can } from "../domain/policy";
import { connectShop, grantableScopes, scopesForRole } from "../domain/mcpPolicy";
import { isShopRole } from "../domain/policy";
import { forbidden, notFound } from "../http/errors";
import type { Actor, UserActor } from "../http/withRoute";
import { mcpAuditRepo } from "../repositories/mcpAuditRepo";
import { transaction } from "../repositories/tx";
import { membershipRepo } from "../repositories/membershipRepo";
import { oauthRepo } from "../repositories/oauthRepo";
import type { ChooseShopInput, RevokeConnectionInput } from "../validation/connect";

// Connecting an AI assistant (Claude, ChatGPT) to one shop. The OAuth provider
// plugin runs the flow; the pages call its continue and consent endpoints from
// the browser. This service backs the shop picker and the consent screen, and
// auth.ts narrows every consent to what the role allows.

async function connectableShops(userId: string) {
  const memberships = await membershipRepo.listConnectable(userId);
  return memberships.flatMap((m) =>
    isShopRole(m.role)
      ? [{ shopId: m.shopId, name: m.shop.name, logo: m.shop.logo, role: m.role, scopes: scopesForRole(m.role) }]
      : [],
  );
}

export const connectService = {
  /** For the shop picker: the shops the user can connect, with their role in each. */
  shops(user: UserActor) {
    return connectableShops(user.userId);
  },

  /**
   * The user picked a shop: stored on their session as connectShopId, which the
   * plugin binds the connection to. The dashboard's active shop does not change.
   */
  async chooseShop(user: UserActor, input: ChooseShopInput, headers: Headers) {
    const shops = await connectableShops(user.userId);
    if (!shops.some((s) => s.shopId === input.shopId)) throw notFound("Shop");
    const session = await auth.api.getSession({ headers });
    if (!session) throw notFound("Session");
    await membershipRepo.setConnectShop(user.userId, session.session.token, input.shopId);
    return { shopId: input.shopId };
  },

  /** For the consent page: who is asking, for which shop, and the permissions the role can grant. */
  async consentDetails(user: UserActor, headers: Headers, oauthQuery: URLSearchParams) {
    const clientId = oauthQuery.get("client_id");
    const client = clientId ? await oauthRepo.findClient(clientId) : null;
    if (!client || client.disabled) throw notFound("App");
    const shops = await connectableShops(user.userId);
    const session = await auth.api.getSession({ headers });
    const shopId = connectShop(shops.map((s) => s.shopId), session?.session.connectShopId);
    const shop = shops.find((s) => s.shopId === shopId);
    if (!shop) throw forbidden("Choose a shop to connect.");
    const requested = oauthQuery.get("scope")?.split(" ") ?? [];
    return {
      client: { name: client.name ?? "An AI assistant", icon: client.icon, uri: client.uri },
      shop: { id: shop.shopId, name: shop.name, logo: shop.logo },
      role: shop.role,
      scopes: grantableScopes(shop.role, requested).filter((s) => s !== "offline_access"),
    };
  },

  /** Connected apps: the owner sees every member's, other members their own. */
  async connections(actor: Actor) {
    const all = can(actor.role, "connection.manageAll");
    const [consents, usage] = await Promise.all([
      oauthRepo.listConnections(actor.shopId, all ? undefined : actor.userId),
      mcpAuditRepo.lastUsed(actor.shopId),
    ]);
    const lastUsed = new Map(usage.map((u) => [`${u.userId}:${u.clientId}`, u._max.createdAt]));
    return consents.map((c) => ({
      clientId: c.clientId,
      app: { name: c.client.name ?? "AI assistant", icon: c.client.icon, uri: c.client.uri },
      member: { userId: c.userId, name: c.user?.name ?? null, isYou: c.userId === actor.userId },
      scopes: c.scopes.filter((s) => s !== "offline_access"),
      connectedAt: c.createdAt,
      lastUsedAt: lastUsed.get(`${c.userId}:${c.clientId}`) ?? null,
    }));
  },

  /** Disconnects one app for one member; it stops working on its next call. */
  async revoke(actor: Actor, input: RevokeConnectionInput) {
    const userId = input.userId ?? actor.userId;
    // Someone else's connection is "not found" unless you may manage everyone's.
    if (userId !== actor.userId && !can(actor.role, "connection.manageAll")) throw notFound("Connection");
    const count = await transaction((tx) => oauthRepo.revoke(tx, actor.shopId, { clientId: input.clientId, userId }, new Date()));
    if (count === 0) throw notFound("Connection");
    return { revoked: count };
  },

  /** Owner only (connection.manageAll, checked by the route): disconnects every app from the shop. */
  async revokeAll(actor: Actor) {
    return { revoked: await transaction((tx) => oauthRepo.revoke(tx, actor.shopId, {}, new Date())) };
  },
};
