import { assistantService } from "../../services/assistantService";
import { GetOrderToolInput, ListOrdersToolInput, MyDeliveriesToolInput } from "../../validation/mcp";
import { defineTool } from "../defineTool";

export const listOrders = defineTool({
  name: "list_orders",
  title: "List orders",
  description:
    "Orders in this shop, newest first, with status, items, total, cash to collect, courier and counts per status. Filter by status, a search (order number, phone digits, customer or item name), a date range or a courier. Customer details are partly hidden.",
  input: ListOrdersToolInput,
  run: (actor, input) => assistantService.listOrders(actor, input),
});

export const getOrder = defineTool({
  name: "get_order",
  title: "Order details",
  description:
    "One order by its number: items and prices, totals, delivery area, courier, cash collected, and its status history with who changed what. Customer details are partly hidden.",
  input: GetOrderToolInput,
  run: (actor, input) => assistantService.getOrder(actor, input.number),
});

export const myDeliveries = defineTool({
  name: "my_deliveries",
  title: "Deliveries",
  description:
    "Orders being delivered (packed or out for delivery), or recently delivered and returned ones. A delivery member sees only the orders assigned to them.",
  input: MyDeliveriesToolInput,
  run: (actor, input) => assistantService.myDeliveries(actor, input),
});
