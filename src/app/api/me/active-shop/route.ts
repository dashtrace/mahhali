import { withRoute } from "@/server/http/withRoute";
import { staffService } from "@/server/services/staffService";
import { ActiveShopBody } from "@/server/validation/team";

export const POST = withRoute(
  { access: { kind: "shop", action: "order.readAssigned" }, body: ActiveShopBody },
  ({ req, actor, body }) => staffService.switchShop(actor, body.shopId, req.headers),
);
