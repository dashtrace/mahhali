import { withRoute } from "@/server/http/withRoute";
import { productService } from "@/server/services/productService";
import { ImageParams } from "@/server/validation/product";

export const DELETE = withRoute(
  { access: { kind: "shop", action: "product.write" }, params: ImageParams },
  async ({ actor, params }) => {
    await productService.deleteImage(actor, params.id, params.imageId);
    return new Response(null, { status: 204 });
  },
);
