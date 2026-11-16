import { assistantService } from "../../services/assistantService";
import { CodReconciliationToolInput, SalesMetricsToolInput, UnsettledCashToolInput } from "../../validation/mcp";
import { defineTool } from "../defineTool";

export const salesMetrics = defineTool({
  name: "sales_metrics",
  title: "Sales",
  description:
    "For a period (the last 30 days by default): orders created and per day, orders by status, delivered orders and their revenue, best-selling items, median minutes to confirm an order, and cash-on-delivery gaps.",
  input: SalesMetricsToolInput,
  run: (actor, input) => assistantService.salesMetrics(actor, input),
});

export const codReconciliation = defineTool({
  name: "cod_reconciliation",
  title: "Cash on delivery by courier",
  description:
    "Cash on delivery per courier for a period: what was due, what was handed over in dollars and pounds, unpaid orders, and orders paid short or over.",
  input: CodReconciliationToolInput,
  run: (actor, input) => assistantService.codReconciliation(actor, input),
});

export const unsettledCash = defineTool({
  name: "unsettled_cash",
  title: "Cash couriers still owe",
  description: "Delivered orders whose cash a courier has not handed over yet, per courier, with what is due in each currency.",
  input: UnsettledCashToolInput,
  run: (actor, input) => assistantService.unsettledCash(actor, input),
});
