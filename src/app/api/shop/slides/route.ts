import { json } from "@/server/http/json";
import { withRoute } from "@/server/http/withRoute";
import { storefrontService } from "@/server/services/storefrontService";
import { readForm } from "@/server/storage/uploads";

export const GET = withRoute({ access: { kind: "shop", action: "shop.settings" } }, ({ actor }) =>
  storefrontService.slides(actor),
);

// Multipart: `file` (PNG, JPEG or WebP, up to 3 MB) plus kicker, title and body.
export const POST = withRoute({ access: { kind: "shop", action: "shop.settings" } }, async ({ actor, req }) =>
  json(await storefrontService.addSlide(actor, await readForm(req)), 201),
);
