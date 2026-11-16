import { db, type Db } from "./tx";

// OAuth clients are the AI assistants themselves (Claude, ChatGPT), shared by
// every shop, so these lookups are keyed by client, not shop.
export const oauthRepo = {
  findClient(clientId: string, client: Db = db) {
    return client.oauthClient.findUnique({
      where: { clientId },
      select: { clientId: true, name: true, icon: true, uri: true, disabled: true },
    });
  },

  /** AI assistant connections to a shop: one consent per app and member. userId narrows to one member. */
  listConnections(shopId: string, userId: string | undefined, client: Db = db) {
    return client.oauthConsent.findMany({
      where: { referenceId: shopId, ...(userId ? { userId } : {}) },
      select: {
        clientId: true,
        userId: true,
        scopes: true,
        createdAt: true,
        client: { select: { name: true, icon: true, uri: true } },
        user: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  /**
   * Disconnects an app: revokes its tokens for this shop and deletes the
   * consent, so the next MCP call gets 401 and reconnecting asks again.
   * clientId and userId narrow it; neither means the whole shop.
   */
  async revoke(tx: Db, shopId: string, by: { clientId?: string; userId?: string }, now: Date) {
    const where = { referenceId: shopId, ...(by.clientId ? { clientId: by.clientId } : {}), ...(by.userId ? { userId: by.userId } : {}) };
    await tx.oauthAccessToken.updateMany({ where: { ...where, revoked: null }, data: { revoked: now } });
    await tx.oauthRefreshToken.updateMany({ where: { ...where, revoked: null }, data: { revoked: now } });
    const { count } = await tx.oauthConsent.deleteMany({ where });
    return count;
  },

  /** An access token by its stored hash, with what /api/mcp checks on every call. */
  findAccessToken(tokenHash: string, client: Db = db) {
    return client.oauthAccessToken.findUnique({
      where: { token: tokenHash },
      select: {
        clientId: true,
        userId: true,
        referenceId: true,
        scopes: true,
        resources: true,
        expiresAt: true,
        revoked: true,
        client: { select: { disabled: true } },
        user: { select: { banned: true, banExpires: true } },
      },
    });
  },
};
