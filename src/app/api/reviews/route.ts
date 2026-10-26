import { withRoute } from "@/server/http/withRoute";
import { reviewService } from "@/server/services/reviewService";
import { ListReviewsQuery } from "@/server/validation/reviews";

export const GET = withRoute(
  { access: { kind: "shop", action: "review.read" }, query: ListReviewsQuery },
  ({ actor, query }) => reviewService.list(actor, query.status),
);
