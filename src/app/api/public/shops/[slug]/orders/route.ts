import { clientIp } from "@/server/http/rateLimit";
import { withRoute } from "@/server/http/withRoute";
import { orderService } from "@/server/services/orderService";
import { SlugParam } from "@/server/validation/common";
import { PlaceOrderBody } from "@/server/validation/order";

// A guest order from the catalogue: reserves stock in the same transaction.
export const POST = withRoute({ access: { kind: "public" }, params: SlugParam, body: PlaceOrderBody }, ({ req, params, body }) =>
  orderService.placeFromCatalogue(params.slug, body, {
    idempotencyKey: req.headers.get("idempotency-key"),
    ip: clientIp(req),
  }),
);
