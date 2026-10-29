import { clientIp } from "@/server/http/rateLimit";
import { withRoute } from "@/server/http/withRoute";
import { trackingService } from "@/server/services/trackingService";
import { SlugParam } from "@/server/validation/common";
import { TrackBody } from "@/server/validation/tracking";

export const POST = withRoute({ access: { kind: "public" }, params: SlugParam, body: TrackBody }, ({ req, params, body }) =>
  trackingService.findToken(params.slug, body, clientIp(req)),
);
