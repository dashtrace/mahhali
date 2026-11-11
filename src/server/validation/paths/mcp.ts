import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { ChooseShopBody } from "../connect";
import type { PathHelpers } from "./helpers";

// AI assistants (Claude, ChatGPT): OAuth discovery and connecting one to a shop.
export function registerMcp(r: OpenAPIRegistry, { secured, ok, errors }: PathHelpers) {
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
