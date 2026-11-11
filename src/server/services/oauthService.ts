import { metadataResponse } from "@better-auth/oauth-provider";
import { auth } from "../auth/auth";
import { DISCOVERY_HEADERS, protectedResourceMetadata } from "../auth/oauth";
import { json } from "../http/json";

export const oauthService = {
  /**
   * RFC 8414 document for our authorization server, built by the OAuth provider
   * plugin. Called without the request: the plugin's HTTP endpoint is closed by
   * the hook in auth.ts, and this route is the public way in.
   */
  async authorizationServerMetadata(): Promise<Response> {
    return metadataResponse(await auth.api.getOAuthServerConfig({ asResponse: false }), DISCOVERY_HEADERS);
  },

  /** RFC 9728 document for the MCP endpoint. */
  protectedResourceMetadata(): Response {
    return json(protectedResourceMetadata(), 200, DISCOVERY_HEADERS);
  },
};
