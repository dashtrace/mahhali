import { withRoute } from "@/server/http/withRoute";
import { connectService } from "@/server/services/connectService";
import { ChooseShopBody } from "@/server/validation/connect";

// Connecting an AI assistant: the shops the user can connect, and picking one.
export const GET = withRoute({ access: { kind: "user" } }, ({ actor }) => connectService.shops(actor));

export const POST = withRoute({ access: { kind: "user" }, body: ChooseShopBody }, ({ req, actor, body }) =>
  connectService.chooseShop(actor, body, req.headers),
);
