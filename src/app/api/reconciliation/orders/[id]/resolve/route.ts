import { json } from "@/server/http/json";
import { withRoute } from "@/server/http/withRoute";
import { remittanceService } from "@/server/services/remittanceService";
import { AcceptCashOrderBody } from "@/server/validation/money";
import { z } from "@/server/validation/zod";

export const POST = withRoute(
  { access: { kind: "shop", action: "remittance.write" }, params: z.object({ id: z.string().min(1) }), body: AcceptCashOrderBody },
  async ({ actor, params, body }) => json(await remittanceService.acceptOrderDifference(actor, params.id, body.reason), 201),
);
