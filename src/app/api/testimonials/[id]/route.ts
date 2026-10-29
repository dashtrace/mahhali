import { withRoute } from "@/server/http/withRoute";
import { testimonialService } from "@/server/services/storefrontService";
import { IdParam } from "@/server/validation/common";
import { ModerateTestimonialBody } from "@/server/validation/storefront";

export const PATCH = withRoute(
  { access: { kind: "shop", action: "review.moderate" }, params: IdParam, body: ModerateTestimonialBody },
  ({ actor, params, body }) => testimonialService.moderate(actor, params.id, body.status),
);
