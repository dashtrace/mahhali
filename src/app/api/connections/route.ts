import { withRoute } from "@/server/http/withRoute";
import { connectService } from "@/server/services/connectService";

// AI assistants connected to the shop: the owner sees everyone's, members their own.
export const GET = withRoute({ access: { kind: "shop", action: "connection.manage" } }, ({ actor }) =>
  connectService.connections(actor),
);
