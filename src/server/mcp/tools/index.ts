import type { McpTool } from "../../domain/mcpPolicy";
import type { ToolDef } from "../defineTool";
import { getOrder, listOrders, myDeliveries } from "./orders";
import { shopInfo } from "./shop";

// Every tool the MCP server can offer. Policy (who may call what) is in domain/mcpPolicy.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- each tool narrows its own input
export const TOOLS: Partial<Record<McpTool, ToolDef<any>>> = {
  shop_info: shopInfo,
  list_orders: listOrders,
  get_order: getOrder,
  my_deliveries: myDeliveries,
};
