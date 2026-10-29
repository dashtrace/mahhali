import { withRoute } from "@/server/http/withRoute";
import { staffService } from "@/server/services/staffService";

export const GET = withRoute({ access: { kind: "shop", action: "staff.manage" } }, ({ actor }) =>
  staffService.list(actor),
);
