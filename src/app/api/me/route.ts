import { withRoute } from "@/server/http/withRoute";
import { accountService } from "@/server/services/accountService";

// Any signed-in shop member: who am I and which shop am I acting for.
export const GET = withRoute({ access: { kind: "shop", action: "order.readAssigned" } }, ({ actor }) =>
  accountService.me(actor),
);
