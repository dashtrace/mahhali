import { json } from "@/server/http/json";
import { withRoute } from "@/server/http/withRoute";
import { courierService } from "@/server/services/courierService";
import { CreateCourierBody, ListCouriersQuery } from "@/server/validation/courier";

export const GET = withRoute(
  { access: { kind: "shop", action: "courier.read" }, query: ListCouriersQuery },
  ({ actor, query }) => courierService.list(actor, query),
);

export const POST = withRoute(
  { access: { kind: "shop", action: "courier.write" }, body: CreateCourierBody },
  async ({ actor, body }) => json(await courierService.create(actor, body), 201),
);
