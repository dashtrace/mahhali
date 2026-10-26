import { withRoute } from "@/server/http/withRoute";
import { reviewService } from "@/server/services/reviewService";

export const POST = withRoute({ access: { kind: "cron" } }, () => reviewService.retryEmails());
