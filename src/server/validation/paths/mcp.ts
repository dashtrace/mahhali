import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "../zod";
import { ChooseShopBody, RevokeConnectionBody } from "../connect";
import { TokenParam } from "../tracking";
import type { PathHelpers } from "./helpers";

const PhotoLinkUpload = z
  .object({
    productId: z.string().openapi({ description: "A product of the link's import" }),
    colour: z.string().max(60).optional().openapi({ description: "One of the product's option values; the photos show for every variant when left out" }),
    file: z.array(z.string().openapi({ format: "binary" })).openapi({ description: "One or more PNG, JPEG or WebP photos, up to 3 MB each" }),
  })
  .openapi("PhotoLinkUpload");

// AI assistants (Claude, ChatGPT): OAuth discovery, connecting one to a shop,
// and the "Add photos" page for imported products.
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
    method: "get",
    path: "/api/connections",
    summary: "AI assistants connected to the shop: everyone's for the owner, your own for other members",
    tags: ["AI assistants"],
    security: secured,
    responses: { 200: ok("App, member, permissions, connected and last used"), 401: errors[401], 403: errors[403] },
  });
  r.registerPath({
    method: "post",
    path: "/api/connections/revoke",
    summary: "Disconnect one AI assistant (your own, or any member's for the owner); its next call gets 401",
    tags: ["AI assistants"],
    security: secured,
    request: { body: { content: { "application/json": { schema: RevokeConnectionBody } } } },
    responses: { 200: ok("Disconnected"), 400: errors[400], 401: errors[401], 403: errors[403], 404: errors[404] },
  });
  r.registerPath({
    method: "post",
    path: "/api/connections/revoke-all",
    summary: "Disconnect every AI assistant from the shop (owner)",
    tags: ["AI assistants"],
    security: secured,
    responses: { 200: ok("How many connections were removed"), 401: errors[401], 403: errors[403] },
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
  const limited = error("Too many attempts; see the retry-after header");
  r.registerPath({
    method: "get",
    path: "/api/public/photo-links/{token}",
    summary: "Add photos page: the products of one confirmed import, their colours and photos (no login; the link works 24 h)",
    tags: ["AI assistants"],
    request: { params: TokenParam },
    responses: { 200: ok("Shop name, expiry and products"), 400: errors[400], 404: error("Unknown, expired or undone link"), 429: limited },
  });
  r.registerPath({
    method: "post",
    path: "/api/public/photo-links/{token}/photos",
    summary: "Add photos to one product of the link's import, up to 5 per product; all or nothing",
    tags: ["AI assistants"],
    request: { params: TokenParam, body: { content: { "multipart/form-data": { schema: PhotoLinkUpload } } } },
    responses: {
      201: ok("{ productId, added, photos, photosLeft }"),
      400: errors[400],
      404: error("Unknown, expired or undone link, or a product outside the import"),
      422: error("NO_FILES, PHOTO_LIMIT, UNKNOWN_COLOUR, FILE_TOO_LARGE or UNSUPPORTED_FILE"),
      429: limited,
    },
  });
}
