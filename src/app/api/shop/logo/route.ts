import { withRoute } from "@/server/http/withRoute";
import { shopService } from "@/server/services/shopService";
import { readForm } from "@/server/storage/uploads";

// Multipart: `file` (PNG, JPEG, WebP or SVG, up to 1 MB).
export const POST = withRoute({ access: { kind: "shop", action: "shop.settings" } }, async ({ actor, req }) =>
  shopService.setLogo(actor, await readForm(req)),
);

export const DELETE = withRoute({ access: { kind: "shop", action: "shop.settings" } }, async ({ actor }) => {
  await shopService.removeLogo(actor);
  return new Response(null, { status: 204 });
});
