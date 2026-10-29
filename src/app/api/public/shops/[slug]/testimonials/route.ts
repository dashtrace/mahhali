import { json } from "@/server/http/json";
import { clientIp } from "@/server/http/rateLimit";
import { withRoute } from "@/server/http/withRoute";
import { testimonialService } from "@/server/services/storefrontService";
import { SlugParam } from "@/server/validation/common";
import { TestimonialBody } from "@/server/validation/storefront";

export const POST = withRoute(
  { access: { kind: "public" }, params: SlugParam, body: TestimonialBody },
  async ({ req, params, body }) => json(await testimonialService.submit(params.slug, body, clientIp(req)), 201),
);
