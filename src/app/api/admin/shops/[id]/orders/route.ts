import { withRoute } from "@/server/http/withRoute";
import { adminService } from "@/server/services/adminService";
import { IdParam } from "@/server/validation/common";
import { CursorQuery } from "@/server/validation/team";

export const GET = withRoute({ access: { kind: "admin" }, params: IdParam, query: CursorQuery }, ({ params, query }) =>
  adminService.shopOrders(params.id, query.cursor),
);
