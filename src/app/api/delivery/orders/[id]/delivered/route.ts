import { withRoute } from "@/server/http/withRoute";
import { orderService } from "@/server/services/orderService";
import { IdParam } from "@/server/validation/common";
import { DeliveredBody } from "@/server/validation/order";

export const POST = withRoute(
  { access: { kind: "shop", action: "order.markDelivered" }, params: IdParam, body: DeliveredBody },
  ({ actor, params, body }) => orderService.markDelivered(actor, params.id, body),
);
