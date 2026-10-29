import { withRoute } from "@/server/http/withRoute";
import { adminService } from "@/server/services/adminService";
import { IdParam } from "@/server/validation/common";
import { SuspendBody } from "@/server/validation/team";

// Suspended shops: the catalogue returns 404 and members get 403 (withRoute).
export const POST = withRoute({ access: { kind: "admin" }, params: IdParam, body: SuspendBody }, ({ params, body }) =>
  adminService.suspend(params.id, body.suspended),
);
