import { withRoute } from "@/server/http/withRoute";
import { orderService } from "@/server/services/orderService";
import { ListOrdersQuery, ManualOrderBody } from "@/server/validation/order";

export const GET = withRoute(
  { access: { kind: "shop", action: "order.read" }, query: ListOrdersQuery },
  ({ actor, query }) => orderService.list(actor, query),
);

export const POST = withRoute(
  { access: { kind: "shop", action: "order.create" }, body: ManualOrderBody },
  ({ req, actor, body }) => orderService.createManual(actor, body, req.headers.get("idempotency-key")),
);
