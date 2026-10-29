import { withRoute } from "@/server/http/withRoute";

// Any signed-in shop member: who am I and which shop am I acting for.
export const GET = withRoute({ access: { kind: "shop", action: "order.readAssigned" } }, async ({ actor }) => ({
  userId: actor.userId,
  shopId: actor.shopId,
  role: actor.role,
  courierId: actor.courierId,
}));
