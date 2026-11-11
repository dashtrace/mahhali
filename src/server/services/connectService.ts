import { auth } from "../auth/auth";
import { connectShop, grantableScopes, scopesForRole } from "../domain/mcpPolicy";
import { isShopRole } from "../domain/policy";
import { forbidden, notFound } from "../http/errors";
import type { UserActor } from "../http/withRoute";
import { membershipRepo } from "../repositories/membershipRepo";
import { oauthRepo } from "../repositories/oauthRepo";
import type { ChooseShopInput } from "../validation/connect";

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

  /** The user picked a shop: it becomes the session's active shop, which the plugin binds the connection to. */
  async chooseShop(user: UserActor, input: ChooseShopInput, headers: Headers) {
    const shops = await connectableShops(user.userId);
    if (!shops.some((s) => s.shopId === input.shopId)) throw notFound("Shop");
    await auth.api.setActiveOrganization({ headers, body: { organizationId: input.shopId } });
    return { shopId: input.shopId };
  },

  /** For the consent page: who is asking, for which shop, and the permissions the role can grant. */
  async consentDetails(user: UserActor, headers: Headers, oauthQuery: URLSearchParams) {
    const clientId = oauthQuery.get("client_id");
    const client = clientId ? await oauthRepo.findClient(clientId) : null;
    if (!client || client.disabled) throw notFound("App");
    const shops = await connectableShops(user.userId);
    const session = await auth.api.getSession({ headers });
    const shopId = connectShop(shops.map((s) => s.shopId), session?.session.activeOrganizationId);
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
};
