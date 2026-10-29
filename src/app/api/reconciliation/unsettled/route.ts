import { withRoute } from "@/server/http/withRoute";
import { remittanceService } from "@/server/services/remittanceService";
import { UnsettledQuery } from "@/server/validation/money";

export const GET = withRoute(
  { access: { kind: "shop", action: "reconciliation.read" }, query: UnsettledQuery },
  ({ actor, query }) => remittanceService.unsettled(actor, query.courierId),
);
