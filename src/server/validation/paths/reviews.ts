import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { IdParam, SlugParam } from "../common";
import { ListReviewsQuery, ModerateReviewBody, ProductReviewsParams, SubmitReviewsBody } from "../reviews";
import { TokenParam, TrackBody } from "../tracking";
import type { PathHelpers } from "./helpers";

// Order tracking, verified reviews and scheduled jobs.
export function registerReviews(r: OpenAPIRegistry, { secured, cronSecured, ok, error, errors }: PathHelpers) {
  const limited = error("Too many attempts; see the retry-after header");
  const gone = error("REVIEW_LINK_USED or REVIEW_LINK_EXPIRED");

  r.registerPath({
    method: "get",
    path: "/api/public/orders/{token}",
    summary: "Customer's tracking page: status timeline, items, totals, courier, first name only",
    tags: ["Tracking"],
    request: { params: TokenParam },
    responses: { 200: ok("Tracking view"), 404: errors[404], 429: limited },
  });
  r.registerPath({
    method: "post",
    path: "/api/public/shops/{slug}/track",
    summary: "Find the tracking token from order number and phone; one generic 404 if anything is wrong",
    tags: ["Tracking"],
    request: { params: SlugParam, body: { content: { "application/json": { schema: TrackBody } } } },
    responses: { 200: ok("{ token }"), 400: errors[400], 404: errors[404], 429: limited },
  });
  r.registerPath({
    method: "get",
    path: "/api/public/reviews/{token}",
    summary: "Items of a delivered order that can still be reviewed (emailed token or tracking token)",
    tags: ["Reviews"],
    request: { params: TokenParam },
    responses: { 200: ok("Shop, order number and items"), 404: errors[404], 410: gone, 429: limited },
  });
  r.registerPath({
    method: "post",
    path: "/api/public/reviews/{token}",
    summary: "Submit ratings for the order's items; the link works once",
    tags: ["Reviews"],
    request: { params: TokenParam, body: { content: { "application/json": { schema: SubmitReviewsBody } } } },
    responses: {
      201: ok("{ reviewed }"),
      400: errors[400],
      404: errors[404],
      410: gone,
      422: error("An item is not part of this order"),
      429: limited,
    },
  });
  r.registerPath({
    method: "get",
    path: "/api/public/shops/{slug}/products/{id}/reviews",
    summary: "Published verified-buyer reviews of a product with its average rating",
    tags: ["Reviews"],
    request: { params: ProductReviewsParams },
    responses: { 200: ok("Average, count and reviews"), 404: errors[404] },
  });
  r.registerPath({
    method: "get",
    path: "/api/reviews",
    summary: "All of the shop's reviews, hidden ones included (owner, manager, staff)",
    tags: ["Reviews"],
    security: secured,
    request: { query: ListReviewsQuery },
    responses: { 200: ok("Reviews, newest first"), 400: errors[400], 401: errors[401], 403: errors[403] },
  });
  r.registerPath({
    method: "patch",
    path: "/api/reviews/{id}",
    summary: "Hide a review or publish it again (owner, manager)",
    tags: ["Reviews"],
    security: secured,
    request: { params: IdParam, body: { content: { "application/json": { schema: ModerateReviewBody } } } },
    responses: { 200: ok("Updated review"), ...errors },
  });
  r.registerPath({
    method: "post",
    path: "/api/cron/review-emails",
    summary: "Retry review emails that were not sent (host cron)",
    tags: ["Jobs"],
    security: cronSecured,
    responses: { 200: ok("{ attempted, sent }"), 401: error("Missing or wrong x-cron-secret") },
  });
}
