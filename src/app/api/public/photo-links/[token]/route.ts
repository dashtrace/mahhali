import { clientIp } from "@/server/http/rateLimit";
import { withRoute } from "@/server/http/withRoute";
import { photoLinkService } from "@/server/services/photoLinkService";
import { TokenParam } from "@/server/validation/tracking";

// The "Add photos" page's data: the products of one confirmed import and their photos.
export const GET = withRoute({ access: { kind: "public" }, params: TokenParam }, ({ req, params }) =>
  photoLinkService.forToken(params.token, clientIp(req)),
);
