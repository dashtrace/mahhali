import { withRoute } from "@/server/http/withRoute";
import { inviteService } from "@/server/services/inviteService";
import { TokenParam } from "@/server/validation/team";

export const GET = withRoute({ access: { kind: "public" }, params: TokenParam }, ({ params }) =>
  inviteService.show(params.token),
);
