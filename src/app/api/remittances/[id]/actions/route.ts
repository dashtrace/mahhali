import { json } from "@/server/http/json";
import { withRoute } from "@/server/http/withRoute";
import { remittanceService } from "@/server/services/remittanceService";
import { RemittanceActionBody } from "@/server/validation/money";
import { z } from "@/server/validation/zod";

export const POST = withRoute(
  { access: { kind: "shop", action: "remittance.write" }, params: z.object({ id: z.string().min(1) }), body: RemittanceActionBody },
  async ({ actor, params, body }) => json(
    body.kind === "PAYMENT"
      ? await remittanceService.addPayment(actor, params.id, body)
      : await remittanceService.acceptDifference(actor, params.id, body.reason),
    201,
  ),
);
