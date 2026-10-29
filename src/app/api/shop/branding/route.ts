import { withRoute } from "@/server/http/withRoute";
import { shopService } from "@/server/services/shopService";
import { BrandingBody } from "@/server/validation/shop";

export const GET = withRoute({ access: { kind: "shop", action: "shop.settings" } }, ({ actor }) =>
  shopService.branding(actor),
);

export const PATCH = withRoute(
  { access: { kind: "shop", action: "shop.settings" }, body: BrandingBody },
  ({ actor, body }) => shopService.updateBranding(actor, body),
);
