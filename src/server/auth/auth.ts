import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { admin, organization } from "better-auth/plugins";
import { oauthProvider } from "@better-auth/oauth-provider";
import { prisma } from "../db";
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
