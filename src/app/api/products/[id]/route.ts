import { withRoute } from "@/server/http/withRoute";
import { productService } from "@/server/services/productService";
import { IdParam } from "@/server/validation/common";
import { UpdateProductBody } from "@/server/validation/product";

export const GET = withRoute(
  { access: { kind: "shop", action: "product.read" }, params: IdParam },
  ({ actor, params }) => productService.get(actor, params.id),
);

export const PATCH = withRoute(
  { access: { kind: "shop", action: "product.write" }, params: IdParam, body: UpdateProductBody },
  ({ actor, params, body }) => productService.update(actor, params.id, body),
);
