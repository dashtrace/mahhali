import { createHash, randomBytes } from "node:crypto";
import { GET as authGet, POST as authPost } from "@/app/api/auth/[...all]/route";
import { POST as chooseShopRoute } from "@/app/api/connect/shop/route";
import { call } from "./helpers";

// Drives the OAuth flow an AI assistant goes through, against the real
// handlers: register, authorize with PKCE, pick a shop, consent, get tokens.

const BASE = "http://localhost:3000";
export const MCP_RESOURCE = `${BASE}/api/mcp`;
export const REDIRECT_URI = "https://claude.ai/api/mcp/auth_callback";

export async function registerClient(name = "Claude", redirectUri = REDIRECT_URI): Promise<string> {
  const res = await authPost(
    new Request(`${BASE}/api/auth/oauth2/register`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE },
      body: JSON.stringify({
        client_name: name,
        redirect_uris: [redirectUri],
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
      }),
    }),
  );
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${await res.text()}`);
  return (await res.json()).client_id;
}

export function pkce() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

/** Where a step of the flow sends the browser next, from a redirect or a { redirect, url } body. */
async function nextUrl(res: Response): Promise<URL> {
  const location = res.headers.get("location");
  if (location) return new URL(location, BASE);
  const text = await res.text();
  const body = text ? JSON.parse(text) : {};
  if (!body.url) throw new Error(`no redirect: ${res.status} ${text}`);
  return new URL(body.url, BASE);
}

export async function authorize(opts: { clientId: string; cookie: string; challenge: string; scope: string; state?: string }) {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: opts.clientId,
    redirect_uri: REDIRECT_URI,
    scope: opts.scope,
    state: opts.state ?? "state-123",
    code_challenge: opts.challenge,
    code_challenge_method: "S256",
    resource: MCP_RESOURCE,
  });
  const res = await authGet(
    new Request(`${BASE}/api/auth/oauth2/authorize?${params}`, {
      headers: { cookie: opts.cookie, accept: "text/html", "sec-fetch-mode": "navigate" },
    }),
  );
  return nextUrl(res);
}

/** The query string a connect page would pass back as oauthQuery. */
export const oauthQueryOf = (url: URL) => url.search.slice(1);

/** What the browser does on a connect page: POST to a plugin endpoint with the session cookie and the page's query. */
async function postAuth(path: string, cookie: string, body: Record<string, unknown>) {
  const res = await authPost(
    new Request(`${BASE}/api/auth${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE, cookie },
      body: JSON.stringify(body),
    }),
  );
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

/** The shop picker: our route sets the shop, then the page resumes the flow. */
export async function chooseShop(cookie: string, shopId: string, oauthQuery: string) {
  const picked = await call(chooseShopRoute, "/api/connect/shop", { method: "POST", cookie, body: { shopId } });
  if (picked.status !== 200) return picked;
  return postAuth("/oauth2/continue", cookie, { postLogin: true, oauth_query: oauthQuery });
}

/** The consent page's approve or deny. Omitting scopes accepts everything requested (before our narrowing). */
export function consent(cookie: string, body: { accept: boolean; scopes?: string[]; oauthQuery: string }) {
  return postAuth("/oauth2/consent", cookie, {
    accept: body.accept,
    ...(body.scopes ? { scope: body.scopes.join(" ") } : {}),
    oauth_query: body.oauthQuery,
  });
}

export async function exchangeCode(clientId: string, code: string, verifier: string) {
  const res = await authPost(
    new Request(`${BASE}/api/auth/oauth2/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", origin: BASE },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
        client_id: clientId,
        code_verifier: verifier,
        resource: MCP_RESOURCE,
      }),
    }),
  );
  return { status: res.status, body: await res.json() };
}

/**
 * The whole flow for a signed-in member: returns the tokens for the shop they
 * pick (or their only shop) and the scopes they leave ticked.
 */
export async function connect(opts: { cookie: string; shopId?: string; scopes: string[]; clientId?: string }) {
  const clientId = opts.clientId ?? (await registerClient());
  const { verifier, challenge } = pkce();
  let url = await authorize({ clientId, cookie: opts.cookie, challenge, scope: ["offline_access", ...opts.scopes].join(" ") });
  if (url.pathname === "/connect/shop") {
    if (!opts.shopId) throw new Error("this user must pick a shop");
    const picked = await chooseShop(opts.cookie, opts.shopId, oauthQueryOf(url));
    if (picked.status !== 200) throw new Error(`choose shop failed: ${picked.status} ${JSON.stringify(picked.body)}`);
    url = new URL(picked.body.url, BASE);
  }
  if (url.pathname === "/connect/consent") {
    const res = await consent(opts.cookie, { accept: true, scopes: opts.scopes, oauthQuery: oauthQueryOf(url) });
    if (res.status !== 200) throw new Error(`consent failed: ${res.status} ${JSON.stringify(res.body)}`);
    url = new URL(res.body.url, BASE);
  }
  const code = url.searchParams.get("code");
  if (!code) throw new Error(`no code in ${url}`);
  const tokens = await exchangeCode(clientId, code, verifier);
  if (tokens.status !== 200) throw new Error(`token failed: ${tokens.status} ${JSON.stringify(tokens.body)}`);
  return { clientId, ...(tokens.body as { access_token: string; refresh_token?: string; scope: string; expires_in: number }) };
}
