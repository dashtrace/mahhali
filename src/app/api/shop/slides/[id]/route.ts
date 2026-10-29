import { withRoute } from "@/server/http/withRoute";
import { storefrontService } from "@/server/services/storefrontService";
import { IdParam } from "@/server/validation/common";
import { UpdateSlideBody } from "@/server/validation/storefront";

export const PATCH = withRoute(
  { access: { kind: "shop", action: "shop.settings" }, params: IdParam, body: UpdateSlideBody },
  ({ actor, params, body }) => storefrontService.updateSlide(actor, params.id, body),
);

export const DELETE = withRoute({ access: { kind: "shop", action: "shop.settings" }, params: IdParam }, async ({ actor, params }) => {
  await storefrontService.deleteSlide(actor, params.id);
  return new Response(null, { status: 204 });
});
