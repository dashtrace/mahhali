import { json } from "@/server/http/json";
import { clientIp } from "@/server/http/rateLimit";
import { withRoute } from "@/server/http/withRoute";
import { reviewService } from "@/server/services/reviewService";
import { SubmitReviewsBody } from "@/server/validation/reviews";
import { TokenParam } from "@/server/validation/tracking";

export const GET = withRoute({ access: { kind: "public" }, params: TokenParam }, ({ req, params }) =>
  reviewService.forToken(params.token, clientIp(req)),
);

export const POST = withRoute(
  { access: { kind: "public" }, params: TokenParam, body: SubmitReviewsBody },
  async ({ req, params, body }) => json(await reviewService.submit(params.token, body, clientIp(req)), 201),
);
