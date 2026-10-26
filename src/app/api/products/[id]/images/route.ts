import { json } from "@/server/http/json";
import { withRoute } from "@/server/http/withRoute";
import { productService } from "@/server/services/productService";
import { readForm } from "@/server/storage/uploads";
import { IdParam } from "@/server/validation/common";

// Multipart: `file` (PNG, JPEG or WebP, up to 3 MB) and an optional `colour`.
export const POST = withRoute(
  { access: { kind: "shop", action: "product.write" }, params: IdParam },
  async ({ actor, params, req }) => json(await productService.addImage(actor, params.id, await readForm(req)), 201),
);
