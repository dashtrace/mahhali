import { json } from "@/server/http/json";
import { withRoute } from "@/server/http/withRoute";
import { categoryService } from "@/server/services/storefrontService";
import { CategoryBody } from "@/server/validation/storefront";

export const GET = withRoute({ access: { kind: "shop", action: "product.read" } }, ({ actor }) =>
  categoryService.list(actor),
);

export const POST = withRoute(
  { access: { kind: "shop", action: "product.write" }, body: CategoryBody },
  async ({ actor, body }) => json(await categoryService.create(actor, body.name), 201),
);
