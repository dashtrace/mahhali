import { withRoute } from "@/server/http/withRoute";
import { shopService } from "@/server/services/shopService";
import { ShopSettingsBody } from "@/server/validation/shop";

export const GET = withRoute({ access: { kind: "shop", action: "shop.settings" } }, ({ actor }) =>
  shopService.settings(actor),
);

export const PATCH = withRoute(
  { access: { kind: "shop", action: "shop.settings" }, body: ShopSettingsBody },
  ({ actor, body }) => shopService.updateSettings(actor, body),
);
