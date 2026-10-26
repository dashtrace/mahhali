import { withRoute } from "@/server/http/withRoute";
import { adminService } from "@/server/services/adminService";
import { CursorQuery } from "@/server/validation/team";

export const GET = withRoute({ access: { kind: "admin" }, query: CursorQuery }, ({ query }) =>
  adminService.auditLog(query.cursor),
);
