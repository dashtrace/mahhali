import { json } from "@/server/http/json";
import { withRoute } from "@/server/http/withRoute";
import { productService } from "@/server/services/productService";
import { IdParam } from "@/server/validation/common";
import { StockAdjustmentBody } from "@/server/validation/product";

export const POST = withRoute(
  { access: { kind: "shop", action: "stock.adjust" }, params: IdParam, body: StockAdjustmentBody },
  async ({ actor, params, body }) => json(await productService.adjustStock(actor, params.id, body), 201),
);
