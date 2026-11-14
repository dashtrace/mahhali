import { withRoute } from "@/server/http/withRoute";
import { collectionService } from "@/server/services/collectionService";
import { IdParam } from "@/server/validation/common";
import { UpdateCollectionBody } from "@/server/validation/collections";

export const PATCH = withRoute(
  { access: { kind: "shop", action: "product.write" }, params: IdParam, body: UpdateCollectionBody },
  ({ actor, params, body }) => collectionService.update(actor, params.id, body, false),
);
export const DELETE = withRoute({ access: { kind: "shop", action: "product.write" }, params: IdParam }, async ({ actor, params }) => {
  await collectionService.delete(actor, params.id, false);
  return new Response(null, { status: 204 });
});
