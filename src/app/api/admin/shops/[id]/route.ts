import { withRoute } from "@/server/http/withRoute";
import { adminService } from "@/server/services/adminService";
import { IdParam } from "@/server/validation/common";

export const GET = withRoute({ access: { kind: "admin" }, params: IdParam }, ({ params }) =>
  adminService.getShop(params.id),
);
