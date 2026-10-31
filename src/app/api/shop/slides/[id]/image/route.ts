import { withRoute } from "@/server/http/withRoute";
import { storefrontService } from "@/server/services/storefrontService";
import { readForm } from "@/server/storage/uploads";
import { IdParam } from "@/server/validation/common";

// Multipart: `file` (PNG, JPEG or WebP, up to 3 MB). Replaces the slide's image.
export const POST = withRoute({ access: { kind: "shop", action: "shop.settings" }, params: IdParam }, async ({ actor, params, req }) =>
  storefrontService.setSlideImage(actor, params.id, await readForm(req)),
);
