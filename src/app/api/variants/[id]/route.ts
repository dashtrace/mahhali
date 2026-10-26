import { withRoute } from "@/server/http/withRoute";
import { productService } from "@/server/services/productService";
import { IdParam } from "@/server/validation/common";
import { UpdateVariantBody } from "@/server/validation/product";

export const PATCH = withRoute(
  { access: { kind: "shop", action: "product.write" }, params: IdParam, body: UpdateVariantBody },
  ({ actor, params, body }) => productService.updateVariant(actor, params.id, body),
);
