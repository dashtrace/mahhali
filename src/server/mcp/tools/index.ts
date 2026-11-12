import type { McpTool } from "../../domain/mcpPolicy";
import type { ToolDef } from "../defineTool";
import { listProducts, listReviews, stockLevels } from "./catalogue";
import { codReconciliation, salesMetrics, unsettledCash } from "./finance";
import { confirmProductImport, photoUploadLink, previewProductImport, undoProductImport } from "./imports";
import { getOrder, listOrders, myDeliveries } from "./orders";
import { shopInfo } from "./shop";

// Every tool the MCP server can offer. Policy (who may call what) is in domain/mcpPolicy.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- each tool narrows its own input
export const TOOLS: Partial<Record<McpTool, ToolDef<any>>> = {
  shop_info: shopInfo,
  list_orders: listOrders,
  get_order: getOrder,
  my_deliveries: myDeliveries,
  list_products: listProducts,
  stock_levels: stockLevels,
  list_reviews: listReviews,
  sales_metrics: salesMetrics,
  cod_reconciliation: codReconciliation,
  unsettled_cash: unsettledCash,
  preview_product_import: previewProductImport,
  confirm_product_import: confirmProductImport,
  undo_product_import: undoProductImport,
  photo_upload_link: photoUploadLink,
};
