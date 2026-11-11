import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import type { PathHelpers } from "./helpers";

// AI assistants (Claude, ChatGPT): OAuth discovery for the MCP endpoint.
export function registerMcp(r: OpenAPIRegistry, { ok }: PathHelpers) {
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
