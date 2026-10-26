import { withRoute } from "@/server/http/withRoute";
import { reportingService } from "@/server/services/reportingService";
import { CourierPeriodQuery } from "@/server/validation/money";

export const GET = withRoute(
  { access: { kind: "shop", action: "reconciliation.read" }, query: CourierPeriodQuery },
  ({ actor, query }) => reportingService.reconciliation(actor, query),
);
