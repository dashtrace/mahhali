import { withRoute } from "@/server/http/withRoute";
import { reviewService } from "@/server/services/reviewService";
import { ProductReviewsParams } from "@/server/validation/reviews";

export const GET = withRoute({ access: { kind: "public" }, params: ProductReviewsParams }, ({ params }) =>
  reviewService.forProduct(params.slug, params.id),
);
