import { json } from "@/server/http/json";
import { withRoute } from "@/server/http/withRoute";
import { productService } from "@/server/services/productService";
import { IdParam } from "@/server/validation/common";
import { SetOptionsBody } from "@/server/validation/product";

export const PUT = withRoute(
  { access: { kind: "shop", action: "product.write" }, params: IdParam, body: SetOptionsBody },
  async ({ actor, params, body }) => json(await productService.setOptions(actor, params.id, body)),
);
