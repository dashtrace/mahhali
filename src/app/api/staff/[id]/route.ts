import { withRoute } from "@/server/http/withRoute";
import { staffService } from "@/server/services/staffService";
import { IdParam } from "@/server/validation/common";
import { UpdateMemberBody } from "@/server/validation/team";

// {id} is the membership id.
export const PATCH = withRoute(
  { access: { kind: "shop", action: "staff.manage" }, params: IdParam, body: UpdateMemberBody },
  ({ actor, params, body }) => staffService.update(actor, params.id, body),
);

export const DELETE = withRoute(
  { access: { kind: "shop", action: "staff.manage" }, params: IdParam },
  async ({ actor, params }) => {
    await staffService.remove(actor, params.id);
    return new Response(null, { status: 204 });
  },
);
