import { withRoute } from "@/server/http/withRoute";
import { adminService } from "@/server/services/adminService";
import { AdminShopsQuery } from "@/server/validation/team";

export const GET = withRoute({ access: { kind: "admin" }, query: AdminShopsQuery }, ({ query }) =>
  adminService.listShops(query.q),
);
