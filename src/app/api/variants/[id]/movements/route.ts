import { withRoute } from "@/server/http/withRoute";
import { productService } from "@/server/services/productService";
import { IdParam } from "@/server/validation/common";

export const GET = withRoute(
  { access: { kind: "shop", action: "product.read" }, params: IdParam },
  ({ actor, params }) => productService.movements(actor, params.id),
);
