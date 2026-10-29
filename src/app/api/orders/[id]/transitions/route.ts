import { withRoute } from "@/server/http/withRoute";
import { orderService } from "@/server/services/orderService";
import { IdParam } from "@/server/validation/common";
import { TransitionBody } from "@/server/validation/order";

export const POST = withRoute(
  { access: { kind: "shop", action: "order.transition" }, params: IdParam, body: TransitionBody },
  ({ actor, params, body }) => orderService.transition(actor, params.id, body),
);
