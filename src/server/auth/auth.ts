import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { admin, organization } from "better-auth/plugins";
import { oauthProvider } from "@better-auth/oauth-provider";
import { prisma } from "../db";
import { connectShop, grantableScopes, needsShopPicker } from "../domain/mcpPolicy";
import { isShopRole } from "../domain/policy";
import { membershipRepo } from "../repositories/membershipRepo";
import { OAUTH_HTTP_PATHS, OAUTH_SCOPES, hashOAuthToken, mcpResourceUrl } from "./oauth";
import { ac, shopRoles } from "./permissions";

/**
 * The only Better Auth endpoints a browser may call. Everything else (sign-up,
 * the organization and admin plugin endpoints) would bypass our policy, so it
 * is reachable only from our own services through auth.api.
 */
const PUBLIC_AUTH_PATHS = new Set(["/sign-in/email", "/sign-out", "/get-session", "/ok", "/error", ...OAUTH_HTTP_PATHS]);

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: { enabled: true, minPasswordLength: 8 },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      // ctx.request is only set for HTTP calls, not for auth.api calls from our services.
      if (ctx.request && !PUBLIC_AUTH_PATHS.has(ctx.path)) throw new APIError("NOT_FOUND");
      if (ctx.path === "/oauth2/consent" && ctx.body?.accept === true) await narrowConsent(ctx);
    }),
  },
  plugins: [
    organization({
      ac,
      roles: shopRoles,
      creatorRole: "owner",
      // Shops are created by our sign-up service, not directly by clients.
      allowUserToCreateOrganization: false,
      schema: {
        organization: { modelName: "shop" },
        member: { modelName: "membership", fields: { organizationId: "shopId" } },
        invitation: { fields: { organizationId: "shopId" } },
        session: { fields: { activeOrganizationId: "activeShopId" } },
      },
    }),
    admin(),
    // AI assistants (Claude, ChatGPT) connecting to /api/mcp. See oauth.ts.
    oauthProvider({
      loginPage: "/login",
      consentPage: "/connect/consent",
      // Each connection is for one shop. Members of several shops pick it on
      // /connect/shop, which makes it the session's active shop; consents and
      // tokens then carry it as referenceId.
      postLogin: {
        page: "/connect/shop",
        shouldRedirect: async ({ user, session, isContinuation }) =>
          needsShopPicker(await connectableShopIds(user.id), activeShopOf(session), isContinuation),
        consentReferenceId: async ({ user, session }) => {
          const shopId = connectShop(await connectableShopIds(user.id), activeShopOf(session));
          if (!shopId) throw new APIError("FORBIDDEN", { error: "access_denied", error_description: "Choose a shop to connect." });
          return shopId;
        },
      },
      scopes: OAUTH_SCOPES,
      clientRegistrationDefaultScopes: OAUTH_SCOPES,
      clientRegistrationAllowedScopes: OAUTH_SCOPES,
      // Assistants register themselves (RFC 7591) without an account here.
      allowDynamicClientRegistration: true,
      allowUnauthenticatedClientRegistration: true,
      // Desktop and CLI assistants use loopback callbacks without saying they are native apps.
      clientRegistrationDefaultApplicationType: "infer",
      resources: [{ identifier: mcpResourceUrl(), name: "Mahhali MCP", allowedScopes: OAUTH_SCOPES }],
      clientRegistrationDefaultResources: [mcpResourceUrl()],
      // Opaque tokens checked against the database on every call, so a revoke
      // or a role change applies at once. No JWT signing keys to manage.
      disableJwtPlugin: true,
      storeTokens: { hash: (token) => hashOAuthToken(token) },
      accessTokenExpiresIn: 60 * 60,
      refreshTokenExpiresIn: 30 * 24 * 60 * 60,
    }),
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;

async function connectableShopIds(userId: string): Promise<string[]> {
  return (await membershipRepo.listConnectable(userId)).map((m) => m.shopId);
}

function activeShopOf(session: Record<string, unknown>): string | null {
  return typeof session.activeOrganizationId === "string" ? session.activeOrganizationId : null;
}

type ConsentCtx = Parameters<Parameters<typeof createAuthMiddleware>[0]>[0];

/**
 * Whatever the consent request asks for, the user grants only scopes their role
 * in the chosen shop allows (and that the assistant asked for). Refuses an
 * approval that would leave nothing.
 */
async function narrowConsent(ctx: ConsentCtx) {
  const session = await getSessionFromCtx(ctx);
  if (!session) return; // the plugin's own session check answers 401
  const memberships = await membershipRepo.listConnectable(session.user.id);
  const shopId = connectShop(memberships.map((m) => m.shopId), activeShopOf(session.session));
  const role = memberships.find((m) => m.shopId === shopId)?.role;
  if (!isShopRole(role)) {
    throw new APIError("FORBIDDEN", { error: "access_denied", error_description: "Choose a shop to connect." });
  }
  const requested = new URLSearchParams(String(ctx.body.oauth_query ?? "")).get("scope")?.split(" ") ?? [];
  const ticked = typeof ctx.body.scope === "string" ? ctx.body.scope.split(" ") : undefined;
  const scopes = grantableScopes(role, requested, ticked);
  if (!scopes.some((s) => s !== "offline_access")) {
    throw new APIError("BAD_REQUEST", { error: "invalid_scope", error_description: "Choose at least one permission." });
  }
  ctx.body.scope = scopes.join(" ");
}
