import { withRoute } from "@/server/http/withRoute";
import { catalogueService } from "@/server/services/productService";
import { SlugParam } from "@/server/validation/common";

export const GET = withRoute({ access: { kind: "public" }, params: SlugParam }, ({ params }) =>
  catalogueService.forShop(params.slug),
);
