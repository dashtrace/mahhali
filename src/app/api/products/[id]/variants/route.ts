import { json } from "@/server/http/json";
import { withRoute } from "@/server/http/withRoute";
import { productService } from "@/server/services/productService";
import { IdParam } from "@/server/validation/common";
import { VariantBody } from "@/server/validation/product";

export const POST = withRoute(
  { access: { kind: "shop", action: "product.write" }, params: IdParam, body: VariantBody },
  async ({ actor, params, body }) => json(await productService.addVariant(actor, params.id, body), 201),
);
