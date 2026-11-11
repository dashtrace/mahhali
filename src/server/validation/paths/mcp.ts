import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { ChooseShopBody } from "../connect";
import type { PathHelpers } from "./helpers";

// AI assistants (Claude, ChatGPT): OAuth discovery and connecting one to a shop.
export function registerMcp(r: OpenAPIRegistry, { secured, ok, error, errors }: PathHelpers) {
  const oauth = r.registerComponent("securitySchemes", "mcpOAuth", {
    type: "oauth2",
    description: "Access tokens for AI assistants, bound to one shop. Clients register themselves (RFC 7591) and must use PKCE.",
    flows: {
      authorizationCode: {
        authorizationUrl: "/api/auth/oauth2/authorize",
        tokenUrl: "/api/auth/oauth2/token",
        refreshUrl: "/api/auth/oauth2/token",
        scopes: {
          "orders:read": "See orders and deliveries",
          "catalogue:read": "See products, stock and reviews",
          "catalogue:write": "Add products (preview, confirm, undo)",
          "finance:read": "See sales and cash on delivery",
          offline_access: "Stay connected with a refresh token",
        },
      },
    },
  });
  r.registerPath({
    method: "post",
    path: "/api/mcp",
    summary: "MCP endpoint (Streamable HTTP, stateless JSON-RPC) for AI assistants",
    description: "Tools are listed per connection: only those the member's role and the granted scopes allow.",
    tags: ["AI assistants"],
    security: [{ [oauth.name]: [] }],
    responses: {
      200: ok("JSON-RPC response"),
      400: error("Body is not JSON (JSON-RPC parse error)"),
      401: error("Token missing, expired or revoked; WWW-Authenticate points to the resource metadata"),
      403: error("No longer a member of the shop, or the shop is suspended"),
      405: error("GET and DELETE: no event stream or session in stateless mode"),
      429: error("Too many calls from this connection"),
    },
  });
  r.registerPath({
    method: "get",
    path: "/api/connect/shop",
    summary: "Shops the signed-in user can connect an AI assistant to, with their role in each",
    tags: ["AI assistants"],
    security: secured,
    responses: { 200: ok("Shops, roles and the scopes each role can grant"), 401: errors[401] },
  });
  r.registerPath({
    method: "post",
    path: "/api/connect/shop",
    summary: "Pick the shop an AI assistant connection is for",
    tags: ["AI assistants"],
    security: secured,
    request: { body: { content: { "application/json": { schema: ChooseShopBody } } } },
    responses: { 200: ok("Shop chosen; continue the OAuth flow"), 400: errors[400], 401: errors[401], 404: errors[404] },
  });
  for (const path of ["/.well-known/oauth-authorization-server", "/.well-known/oauth-authorization-server/api/auth"]) {
    r.registerPath({
      method: "get",
      path,
      summary: "OAuth authorization server metadata (RFC 8414)",
      tags: ["AI assistants"],
      responses: { 200: ok("Issuer, endpoints, scopes and supported grants") },
    });
  }
  for (const path of ["/.well-known/oauth-protected-resource", "/.well-known/oauth-protected-resource/api/mcp"]) {
    r.registerPath({
      method: "get",
      path,
      summary: "Protected resource metadata for /api/mcp (RFC 9728)",
      tags: ["AI assistants"],
      responses: { 200: ok("Resource, authorization server and scopes") },
    });
  }
}
