import { withRoute } from "@/server/http/withRoute";
import { categoryService } from "@/server/services/storefrontService";
import { IdParam } from "@/server/validation/common";
import { UpdateCategoryBody } from "@/server/validation/storefront";

export const PATCH = withRoute(
  { access: { kind: "shop", action: "product.write" }, params: IdParam, body: UpdateCategoryBody },
  ({ actor, params, body }) => categoryService.update(actor, params.id, body),
);

// Its products stay, uncategorised.
export const DELETE = withRoute({ access: { kind: "shop", action: "product.write" }, params: IdParam }, async ({ actor, params }) => {
  await categoryService.delete(actor, params.id);
  return new Response(null, { status: 204 });
});
