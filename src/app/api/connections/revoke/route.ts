import { withRoute } from "@/server/http/withRoute";
import { connectService } from "@/server/services/connectService";
import { RevokeConnectionBody } from "@/server/validation/connect";

// Disconnect one AI assistant: your own, or (owner) any member's.
export const POST = withRoute(
  { access: { kind: "shop", action: "connection.manage" }, body: RevokeConnectionBody },
  ({ actor, body }) => connectService.revoke(actor, body),
);
