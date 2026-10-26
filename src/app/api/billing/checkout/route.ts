import { withRoute } from "@/server/http/withRoute";
import { billingService } from "@/server/services/billingService";

export const POST = withRoute({ access: { kind: "shop", action: "billing.manage" } }, ({ actor }) =>
  billingService.checkout(actor),
);
