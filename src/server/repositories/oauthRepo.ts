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
