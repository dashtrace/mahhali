import { withRoute } from "@/server/http/withRoute";
import { storefrontService } from "@/server/services/storefrontService";
import { readForm } from "@/server/storage/uploads";
import { IdParam } from "@/server/validation/common";

export const POST = withRoute({ access: { kind: "shop", action: "shop.settings" }, params: IdParam }, async ({ actor, params, req }) =>
  storefrontService.setSlideImage(actor, params.id, await readForm(req), true),
);
export const DELETE = withRoute({ access: { kind: "shop", action: "shop.settings" }, params: IdParam }, ({ actor, params }) =>
  storefrontService.removeSlideMobileImage(actor, params.id),
);
