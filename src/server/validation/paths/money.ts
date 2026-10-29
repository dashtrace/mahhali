import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { CourierPeriodQuery, CreateRemittanceBody, PeriodQuery, UnsettledQuery } from "../money";
import type { PathHelpers } from "./helpers";

// Remittances, reconciliation and outcome metrics.
export function registerMoney(r: OpenAPIRegistry, { secured, ok, error, errors }: PathHelpers) {
  r.registerPath({
    method: "post",
    path: "/api/remittances",
    summary: "Record cash a courier handed over, one line per order it pays for (owner, manager)",
    tags: ["Money"],
    security: secured,
    request: { body: { content: { "application/json": { schema: CreateRemittanceBody } } } },
    responses: {
      201: ok("The remittance with its lines"),
      ...errors,
      409: error("An order was already settled (ALREADY_SETTLED)"),
      422: error("Order not assigned to this courier (WRONG_COURIER), fee not in whole pounds, or no exchange rate"),
    },
  });
  r.registerPath({
    method: "get",
    path: "/api/remittances",
    summary: "Remittances received in a period, newest first, with lines and order numbers (owner, manager)",
    tags: ["Money"],
    security: secured,
    request: { query: CourierPeriodQuery },
    responses: { 200: ok("{ from, to, remittances }"), ...errors },
  });
  r.registerPath({
    method: "get",
    path: "/api/reconciliation/unsettled",
    summary: "A courier's delivered orders not yet paid for, with what is due and what was reported at the door",
    tags: ["Money"],
    security: secured,
    request: { query: UnsettledQuery },
    responses: { 200: ok("Orders, oldest delivery first"), ...errors },
  });
  r.registerPath({
    method: "get",
    path: "/api/reconciliation",
    summary: "Cash-on-delivery reconciliation per courier: expected, received, and every gap (owner, manager)",
    tags: ["Money"],
    security: secured,
    request: { query: CourierPeriodQuery },
    responses: { 200: ok("{ from, to, currency, toleranceMinor, couriers, totals }"), ...errors },
  });
  r.registerPath({
    method: "get",
    path: "/api/metrics",
    summary: "Outcome metrics: median minutes to confirm, orders per day, orders by status, COD gaps, baseline",
    tags: ["Money"],
    security: secured,
    request: { query: PeriodQuery },
    responses: { 200: ok("Metrics for the period"), 400: errors[400], 401: errors[401], 403: errors[403] },
  });
}
