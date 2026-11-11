import { createHash } from "node:crypto";
import { MCP_SCOPES } from "../domain/mcpPolicy";

// Mahhali as an OAuth 2.1 authorization server for AI assistants (Claude,
// ChatGPT). They register themselves, send the user here to sign in, pick a
// shop and approve scopes, then call /api/mcp with the access token.

function appOrigin(): string {
  return (process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

/** The authorization server's issuer: Better Auth's base URL. */
export function oauthIssuer(): string {
  return `${appOrigin()}/api/auth`;
}

/** The one protected resource: the MCP endpoint. Tokens are issued for this audience. */
export function mcpResourceUrl(): string {
  return `${appOrigin()}/api/mcp`;
}

/** Where a client finds out how to get a token for /api/mcp (RFC 9728). */
export function mcpResourceMetadataUrl(): string {
  return `${appOrigin()}/.well-known/oauth-protected-resource/api/mcp`;
}

/** offline_access gives the assistant a refresh token, so the user stays connected. */
export const OAUTH_SCOPES = ["offline_access", ...MCP_SCOPES];

/**
 * Better Auth endpoints an AI assistant or our connect pages call over HTTP.
 * Everything else the plugin adds (client and consent CRUD, introspection,
 * userinfo, admin) stays reachable only from our services.
 */
export const OAUTH_HTTP_PATHS = [
  "/oauth2/authorize",
  "/oauth2/token",
  "/oauth2/register",
  "/oauth2/revoke",
  "/oauth2/consent",
  "/oauth2/continue",
];

/** Tokens are stored as SHA-256, so a database leak exposes no usable token. */
export function hashOAuthToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** RFC 9728 metadata for /api/mcp: which server issues its tokens and which scopes exist. */
export function protectedResourceMetadata() {
  return {
    resource: mcpResourceUrl(),
    resource_name: "Mahhali",
    authorization_servers: [oauthIssuer()],
    scopes_supported: OAUTH_SCOPES,
    bearer_methods_supported: ["header"],
  };
}

/** Discovery documents are public and read by browser-based MCP clients too. */
export const DISCOVERY_HEADERS = {
  "access-control-allow-origin": "*",
  "cache-control": "public, max-age=3600",
};
