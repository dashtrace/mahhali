import { withRoute } from "@/server/http/withRoute";
import { reviewService } from "@/server/services/reviewService";
import { IdParam } from "@/server/validation/common";
import { ModerateReviewBody } from "@/server/validation/reviews";

export const PATCH = withRoute(
  { access: { kind: "shop", action: "review.moderate" }, params: IdParam, body: ModerateReviewBody },
  ({ actor, params, body }) => reviewService.moderate(actor, params.id, body.status),
);
