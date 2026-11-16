import { withRoute } from "@/server/http/withRoute";
import { json } from "@/server/http/json";
import { collectionService } from "@/server/services/collectionService";
import { IdParam } from "@/server/validation/common";
import { CollectionBody } from "@/server/validation/collections";

export const POST = withRoute(
  { access: { kind: "shop", action: "product.write" }, params: IdParam, body: CollectionBody },
  async ({ actor, params, body }) => json(await collectionService.create(actor, params.id, body.name, false), 201),
);
