import { toolsFor } from "../../domain/mcpPolicy";
import { shopService } from "../../services/shopService";
import { ShopInfoInput } from "../../validation/mcp";
import { defineTool } from "../defineTool";

export const shopInfo = defineTool({
  name: "shop_info",
  title: "Shop and role",
  description:
    "The shop this connection is for (name, currency, exchange rate, language), the user's role in it, and the tools this connection may use. Call it first when unsure what the user can do.",
  input: ShopInfoInput,
  run: async (actor) => ({
    shop: await shopService.summary(actor),
    role: actor.role,
    tools: toolsFor(actor.role, actor.scopes),
  }),
});
