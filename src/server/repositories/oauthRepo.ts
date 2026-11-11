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
};
