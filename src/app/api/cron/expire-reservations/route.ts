import { withRoute } from "@/server/http/withRoute";
import { orderService } from "@/server/services/orderService";
import { productImportService } from "@/server/services/productImportService";

// Host cron, every 15 minutes: releases stock held by orders nobody confirmed,
// and deletes product import previews nobody confirmed.
export const POST = withRoute({ access: { kind: "cron" } }, async () => ({
  ...(await orderService.expireReservations()),
  ...(await productImportService.deleteExpiredPreviews()),
}));
