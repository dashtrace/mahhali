import { beforeAll, describe, expect, it } from "vitest";
import { GET as asMetadataRoot } from "@/app/.well-known/oauth-authorization-server/route";
import { GET as asMetadataPath } from "@/app/.well-known/oauth-authorization-server/api/auth/route";
import { GET as prMetadataRoot } from "@/app/.well-known/oauth-protected-resource/route";
import { GET as prMetadataPath } from "@/app/.well-known/oauth-protected-resource/api/mcp/route";
import { GET as authGet, POST as authPost } from "@/app/api/auth/[...all]/route";
import { prisma } from "@/server/db";
import { MCP_SCOPES } from "@/server/domain/mcpPolicy";
import { call, resetDb, signUpOwner } from "./helpers";

const ISSUER = "http://localhost:3000/api/auth";
const MCP = "http://localhost:3000/api/mcp";

beforeAll(resetDb);

async function hit(method: "GET" | "POST", path: string, body?: unknown, cookie?: string) {
  const headers = new Headers({ origin: "http://localhost:3000" });
  if (cookie) headers.set("cookie", cookie);
  if (body !== undefined) headers.set("content-type", "application/json");
  const req = new Request(`http://localhost:3000/api/auth${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return (method === "GET" ? authGet : authPost)(req);
}

export function registerClient(redirectUri = "https://claude.ai/api/mcp/auth_callback") {
  return hit("POST", "/oauth2/register", {
    client_name: "Claude",
    redirect_uris: [redirectUri],
    token_endpoint_auth_method: "none",
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
  });
}

describe("OAuth discovery for AI assistants", () => {
  it("publishes the authorization server metadata at both well-known paths", async () => {
    for (const route of [asMetadataRoot, asMetadataPath]) {
      const res = await call(route, "/.well-known/oauth-authorization-server");
      expect(res.status).toBe(200);
      expect(res.headers.get("access-control-allow-origin")).toBe("*");
      expect(res.body.issuer).toBe(ISSUER);
      expect(res.body.authorization_endpoint).toBe(`${ISSUER}/oauth2/authorize`);
      expect(res.body.token_endpoint).toBe(`${ISSUER}/oauth2/token`);
      expect(res.body.registration_endpoint).toBe(`${ISSUER}/oauth2/register`);
      expect(res.body.code_challenge_methods_supported).toContain("S256");
      expect(res.body.scopes_supported).toEqual(expect.arrayContaining([...MCP_SCOPES, "offline_access"]));
    }
  });

  it("publishes the MCP endpoint's resource metadata at both well-known paths", async () => {
    for (const route of [prMetadataRoot, prMetadataPath]) {
      const res = await call(route, "/.well-known/oauth-protected-resource/api/mcp");
      expect(res.status).toBe(200);
      expect(res.headers.get("access-control-allow-origin")).toBe("*");
      expect(res.body).toEqual({
        resource: MCP,
        resource_name: "Mahhali",
        authorization_servers: [ISSUER],
        scopes_supported: ["offline_access", ...MCP_SCOPES],
        bearer_methods_supported: ["header"],
      });
    }
  });

  it("lets an assistant register itself without an account and links it to the MCP resource", async () => {
    const res = await registerClient();
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.client_id).toEqual(expect.any(String));
    expect(body.redirect_uris).toEqual(["https://claude.ai/api/mcp/auth_callback"]);

    const client = await prisma.oauthClient.findUniqueOrThrow({ where: { clientId: body.client_id } });
    expect(client.userId).toBeNull();
    const links = await prisma.oauthClientResource.findMany({ where: { clientId: body.client_id } });
    expect(links.map((l) => l.resourceId)).toEqual([MCP]);
  });

  it("refuses scopes outside our list at registration", async () => {
    const res = await hit("POST", "/oauth2/register", {
      client_name: "Greedy",
      redirect_uris: ["https://example.com/cb"],
      token_endpoint_auth_method: "none",
      scope: "orders:read admin:all",
    });
    expect(res.status).toBe(400);
  });

  it("keeps the plugin's management endpoints closed over HTTP, even for a signed-in owner", async () => {
    const owner = await signUpOwner();
    const closed: ["GET" | "POST", string][] = [
      ["GET", "/oauth2/get-clients"],
      ["GET", "/oauth2/get-consents"],
      ["POST", "/oauth2/create-client"],
      ["POST", "/oauth2/delete-client"],
      ["POST", "/oauth2/update-consent"],
      ["GET", "/oauth2/userinfo"],
      ["GET", "/admin/oauth2/resources"],
      ["POST", "/admin/oauth2/create-client"],
      ["GET", "/.well-known/openid-configuration"],
    ];
    for (const [method, path] of closed) {
      const res = await hit(method, path, method === "POST" ? {} : undefined, owner.cookie);
      expect(res.status, `${method} ${path}`).toBe(404);
    }
    // Introspection only takes form bodies; with one it is still closed.
    const introspect = await authPost(
      new Request("http://localhost:3000/api/auth/oauth2/introspect", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", origin: "http://localhost:3000" },
        body: "token=anything",
      }),
    );
    expect(introspect.status).toBe(404);
  });
});
