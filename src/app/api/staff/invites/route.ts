import { json } from "@/server/http/json";
import { withRoute } from "@/server/http/withRoute";
import { inviteService } from "@/server/services/inviteService";
import { InviteBody } from "@/server/validation/team";

export const POST = withRoute(
  { access: { kind: "shop", action: "staff.manage" }, body: InviteBody },
  async ({ actor, body }) => json(await inviteService.create(actor, body), 201),
);
