import { json } from "@/server/http/json";
import { clientIp } from "@/server/http/rateLimit";
import { withRoute } from "@/server/http/withRoute";
import { photoLinkService } from "@/server/services/photoLinkService";
import { readForm } from "@/server/storage/uploads";
import { TokenParam } from "@/server/validation/tracking";

// Multipart: `productId`, optional `colour`, and one or more `file` (PNG, JPEG or WebP, up to 3 MB each).
export const POST = withRoute({ access: { kind: "public" }, params: TokenParam }, async ({ req, params }) =>
  json(await photoLinkService.upload(params.token, await readForm(req), clientIp(req)), 201),
);
