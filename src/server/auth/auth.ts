import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { admin, organization } from "better-auth/plugins";
import { prisma } from "../db";
import { ac, shopRoles } from "./permissions";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: { enabled: true, minPasswordLength: 8 },
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
