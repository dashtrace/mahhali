import { clientIp } from "@/server/http/rateLimit";
import { withRoute } from "@/server/http/withRoute";
import { trackingService } from "@/server/services/trackingService";
import { TokenParam } from "@/server/validation/tracking";

export const GET = withRoute({ access: { kind: "public" }, params: TokenParam }, ({ req, params }) =>
  trackingService.view(params.token, clientIp(req)),
);
