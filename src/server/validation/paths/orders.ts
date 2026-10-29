import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { IdParam, SlugParam } from "../common";
import {
  DeliveredBody,
  DeliveryOrdersQuery,
  FailedBody,
  ListOrdersQuery,
  ManualOrderBody,
  PlaceOrderBody,
  TransitionBody,
  UpdateOrderBody,
} from "../order";
import { z } from "../zod";
import type { PathHelpers } from "./helpers";

const IdempotencyHeader = z.object({
  "idempotency-key": z.string().min(8).max(80).optional().openapi({
    description: "Generated when the form loads; a retry with the same key returns the first order.",
  }),
});

// Orders: placement, board, transitions, delivery.
export function registerOrders(r: OpenAPIRegistry, { secured, cronSecured, ok, error, errors }: PathHelpers) {
  const json = <T extends z.ZodType>(schema: T) => ({ content: { "application/json": { schema } } });

  r.registerPath({
    method: "post",
    path: "/api/public/shops/{slug}/orders",
    summary: "Place a guest order; stock is reserved in the same transaction",
    tags: ["Public"],
    request: { params: SlugParam, headers: IdempotencyHeader, body: json(PlaceOrderBody) },
    responses: {
      201: ok("Placed: { number, token, status, currency, totalMinor }"),
      200: ok("Replayed: the order this idempotency key already created"),
      400: errors[400],
      404: errors[404],
      409: error("OUT_OF_STOCK: the last unit sold to someone else"),
      422: error("UNAVAILABLE: a variant is archived or not in this shop"),
      429: error("RATE_LIMITED"),
    },
  });
  r.registerPath({
    method: "get",
    path: "/api/orders",
    summary: "The order board: filter by status or courier, search by number, phone or name (owner, manager, staff)",
    tags: ["Orders"],
    security: secured,
    request: { query: ListOrdersQuery },
    responses: { 200: ok("{ orders, nextCursor, counts }"), 400: errors[400], 401: errors[401], 403: errors[403] },
  });
  r.registerPath({
    method: "post",
    path: "/api/orders",
    summary: "Enter an order for a customer who wrote by DM or WhatsApp (owner, manager, staff)",
    tags: ["Orders"],
    security: secured,
    request: { headers: IdempotencyHeader, body: json(ManualOrderBody) },
    responses: { 201: ok("The order"), ...errors, 409: error("OUT_OF_STOCK"), 422: error("UNAVAILABLE or INVALID_PRICE") },
  });
  r.registerPath({
    method: "get",
    path: "/api/orders/{id}",
    summary: "One order with its items, history and customer",
    tags: ["Orders"],
    security: secured,
    request: { params: IdParam },
    responses: { 200: ok("Order"), ...errors },
  });
  r.registerPath({
    method: "patch",
    path: "/api/orders/{id}",
    summary: "Edit the address or notes, assign or reassign the courier",
    tags: ["Orders"],
    security: secured,
    request: { params: IdParam, body: json(UpdateOrderBody) },
    responses: { 200: ok("Order"), ...errors, 422: error("ORDER_LOCKED, ORDER_CLOSED or COURIER_INACTIVE") },
  });
  r.registerPath({
    method: "post",
    path: "/api/orders/{id}/transitions",
    summary: "Move an order on the board, e.g. { to: \"CONFIRMED\" }",
    tags: ["Orders"],
    security: secured,
    request: { params: IdParam, body: json(TransitionBody) },
    responses: {
      200: ok("Order"),
      ...errors,
      409: error("STATUS_CHANGED: someone else moved it first"),
      422: error("INVALID_TRANSITION or COURIER_REQUIRED"),
    },
  });
  r.registerPath({
    method: "get",
    path: "/api/delivery/orders",
    summary: "A courier's run: delivery users see only their courier's orders",
    tags: ["Delivery"],
    security: secured,
    request: { query: DeliveryOrdersQuery },
    responses: { 200: ok("Orders with address, phone and cash to collect"), 401: errors[401], 403: errors[403] },
  });
  r.registerPath({
    method: "post",
    path: "/api/delivery/orders/{id}/delivered",
    summary: "Mark delivered with the cash collected in dollars and pounds; sends the review invite",
    tags: ["Delivery"],
    security: secured,
    request: { params: IdParam, body: json(DeliveredBody) },
    responses: { 200: ok("{ id, status }"), ...errors, 409: error("STATUS_CHANGED"), 422: error("INVALID_TRANSITION") },
  });
  r.registerPath({
    method: "post",
    path: "/api/delivery/orders/{id}/failed",
    summary: "Mark a delivery failed with a reason; the order is Returned and restocked",
    tags: ["Delivery"],
    security: secured,
    request: { params: IdParam, body: json(FailedBody) },
    responses: { 200: ok("{ id, status }"), ...errors, 409: error("STATUS_CHANGED"), 422: error("INVALID_TRANSITION") },
  });
  r.registerPath({
    method: "post",
    path: "/api/cron/expire-reservations",
    summary: "Cancel orders left in New past the shop's limit and release their stock",
    tags: ["Jobs"],
    security: cronSecured,
    responses: { 200: ok("{ cancelled }"), 401: errors[401] },
  });
}
