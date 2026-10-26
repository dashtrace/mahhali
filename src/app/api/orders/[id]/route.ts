import { withRoute } from "@/server/http/withRoute";
import { orderService } from "@/server/services/orderService";
import { IdParam } from "@/server/validation/common";
import { UpdateOrderBody } from "@/server/validation/order";

export const GET = withRoute({ access: { kind: "shop", action: "order.read" }, params: IdParam }, ({ actor, params }) =>
  orderService.get(actor, params.id),
);

export const PATCH = withRoute(
  { access: { kind: "shop", action: "order.assignCourier" }, params: IdParam, body: UpdateOrderBody },
  ({ actor, params, body }) => orderService.update(actor, params.id, body),
);
