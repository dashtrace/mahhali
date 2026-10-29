import { withRoute } from "@/server/http/withRoute";
import { staffService } from "@/server/services/staffService";

// Any shop member: the shops they can switch between.
export const GET = withRoute({ access: { kind: "shop", action: "order.readAssigned" } }, ({ actor }) =>
  staffService.myShops(actor),
);
