import { withRoute } from "@/server/http/withRoute";
import { reportingService } from "@/server/services/reportingService";
import { PeriodQuery } from "@/server/validation/money";

export const GET = withRoute(
  { access: { kind: "shop", action: "metrics.read" }, query: PeriodQuery },
  ({ actor, query }) => reportingService.metrics(actor, query),
);
