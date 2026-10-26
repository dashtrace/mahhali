import { json } from "@/server/http/json";
import { withRoute } from "@/server/http/withRoute";
import { remittanceService } from "@/server/services/remittanceService";
import { CourierPeriodQuery, CreateRemittanceBody } from "@/server/validation/money";

export const GET = withRoute(
  { access: { kind: "shop", action: "reconciliation.read" }, query: CourierPeriodQuery },
  ({ actor, query }) => remittanceService.list(actor, query),
);

export const POST = withRoute(
  { access: { kind: "shop", action: "remittance.write" }, body: CreateRemittanceBody },
  async ({ actor, body }) => json(await remittanceService.create(actor, body), 201),
);
