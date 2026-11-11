import { productImportService } from "../../services/productImportService";
import { PreviewImportToolInput } from "../../validation/mcp";
import { defineTool } from "../defineTool";

export const previewProductImport = defineTool({
  name: "preview_product_import",
  title: "Preview a product import",
  description: [
    "Checks up to 100 new products and saves them as a preview. Creates nothing.",
    "Use it when the user wants to add products from a CSV file or by describing them (typed or spoken, English or Arabic).",
    "From a CSV with one row per variant, group rows by product name: each product lists its option names (e.g. Size, Colour) and one variant per row with its option values, price, stock and SKU.",
    "Prices are in the shop's currency (shop_info). Split bigger files into several previews, one at a time.",
    "Then show the user the result and wait for them to confirm or ask for changes; for changes, call this again with the corrected list.",
  ].join(" "),
  input: PreviewImportToolInput,
  run: (actor, input) => productImportService.preview(actor, input, "MCP"),
});
