import { withRoute } from "@/server/http/withRoute";
import { orderService } from "@/server/services/orderService";
import { DeliveryOrdersQuery } from "@/server/validation/order";

// Delivery users see only their courier's orders; desk roles may pick a courier.
export const GET = withRoute(
  { access: { kind: "shop", action: "order.readAssigned" }, query: DeliveryOrdersQuery },
  ({ actor, query }) => orderService.deliveryList(actor, query),
);
