import { withRoute } from "@/server/http/withRoute";
import { inviteService } from "@/server/services/inviteService";
import { IdParam } from "@/server/validation/common";

export const DELETE = withRoute(
  { access: { kind: "shop", action: "staff.manage" }, params: IdParam },
  async ({ actor, params }) => {
    await inviteService.revoke(actor, params.id);
    return new Response(null, { status: 204 });
  },
);
