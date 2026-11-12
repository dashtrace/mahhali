import { withRoute } from "@/server/http/withRoute";
import { connectService } from "@/server/services/connectService";

// Disconnect every AI assistant from the shop.
export const POST = withRoute({ access: { kind: "shop", action: "connection.manageAll" } }, ({ actor }) =>
  connectService.revokeAll(actor),
);
