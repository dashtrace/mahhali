import { withRoute } from "@/server/http/withRoute";
import { billingService } from "@/server/services/billingService";

export const GET = withRoute({ access: { kind: "public" } }, async () => billingService.plans());
