import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { admin, organization } from "better-auth/plugins";
import { prisma } from "../db";
import { ac, shopRoles } from "./permissions";

/**
 * The only Better Auth endpoints a browser may call. Everything else (sign-up,
 * the organization and admin plugin endpoints) would bypass our policy, so it
 * is reachable only from our own services through auth.api.
 */
const PUBLIC_AUTH_PATHS = new Set(["/sign-in/email", "/sign-out", "/get-session", "/ok", "/error"]);

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
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
