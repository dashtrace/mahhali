import { withRoute } from "@/server/http/withRoute";
import { courierService } from "@/server/services/courierService";
import { IdParam } from "@/server/validation/common";
import { UpdateCourierBody } from "@/server/validation/courier";

export const PATCH = withRoute(
  { access: { kind: "shop", action: "courier.write" }, params: IdParam, body: UpdateCourierBody },
  ({ actor, params, body }) => courierService.update(actor, params.id, body),
);
