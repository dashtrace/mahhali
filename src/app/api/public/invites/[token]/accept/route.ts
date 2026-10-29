import { withRoute } from "@/server/http/withRoute";
import { inviteService } from "@/server/services/inviteService";
import { AcceptInviteBody, TokenParam } from "@/server/validation/team";

export const POST = withRoute(
  { access: { kind: "public" }, params: TokenParam, body: AcceptInviteBody },
  ({ params, body }) => inviteService.accept(params.token, body),
);
