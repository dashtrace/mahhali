import { withRoute } from "@/server/http/withRoute";
import { orderService } from "@/server/services/orderService";

// Host cron, every 15 minutes: releases stock held by orders nobody confirmed.
export const POST = withRoute({ access: { kind: "cron" } }, () => orderService.expireReservations());
