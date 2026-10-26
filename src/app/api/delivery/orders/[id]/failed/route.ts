import { withRoute } from "@/server/http/withRoute";
import { orderService } from "@/server/services/orderService";
import { IdParam } from "@/server/validation/common";
import { FailedBody } from "@/server/validation/order";

export const POST = withRoute(
  { access: { kind: "shop", action: "order.markDelivered" }, params: IdParam, body: FailedBody },
  ({ actor, params, body }) => orderService.markFailed(actor, params.id, body.reason),
);
