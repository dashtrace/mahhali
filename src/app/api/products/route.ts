import { json } from "@/server/http/json";
import { withRoute } from "@/server/http/withRoute";
import { productService } from "@/server/services/productService";
import { CreateProductBody, ListProductsQuery } from "@/server/validation/product";

export const GET = withRoute(
  { access: { kind: "shop", action: "product.read" }, query: ListProductsQuery },
  ({ actor, query }) => productService.list(actor, query),
);

export const POST = withRoute(
  { access: { kind: "shop", action: "product.write" }, body: CreateProductBody },
  async ({ actor, body }) => json(await productService.create(actor, body), 201),
);
