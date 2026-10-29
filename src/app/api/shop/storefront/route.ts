import { withRoute } from "@/server/http/withRoute";
import { storefrontService } from "@/server/services/storefrontService";
import { StorefrontBody } from "@/server/validation/storefront";

export const GET = withRoute({ access: { kind: "shop", action: "shop.settings" } }, ({ actor }) =>
  storefrontService.settings(actor),
);

export const PATCH = withRoute(
  { access: { kind: "shop", action: "shop.settings" }, body: StorefrontBody },
  ({ actor, body }) => storefrontService.update(actor, body),
);
