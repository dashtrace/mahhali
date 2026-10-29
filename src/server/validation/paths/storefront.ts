import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { IdParam, SlugParam } from "../common";
import {
  CategoryBody,
  ListTestimonialsQuery,
  ModerateTestimonialBody,
  StorefrontBody,
  TestimonialBody,
  UpdateCategoryBody,
  UpdateSlideBody,
} from "../storefront";
import { z } from "../zod";
import type { PathHelpers } from "./helpers";

const SlideUpload = z
  .object({
    file: z.string().openapi({ format: "binary", description: "PNG, JPEG or WebP, up to 3 MB" }),
    kicker: z.string().max(40).optional(),
    title: z.string().min(1).max(80),
    body: z.string().max(160).optional(),
  })
  .openapi("SlideUpload");

// Storefront copy and layout, hero slides, categories and testimonials.
export function registerStorefront(r: OpenAPIRegistry, { secured, ok, error, errors }: PathHelpers) {
  const json = (schema: z.ZodType) => ({ content: { "application/json": { schema } } });
  const deleted = { 204: { description: "Deleted" }, 401: errors[401], 403: errors[403], 404: errors[404] };

  r.registerPath({
    method: "get",
    path: "/api/shop/storefront",
    summary: "Storefront copy, social links, logo mode, home section and testimonials switch (owner)",
    tags: ["Storefront"],
    security: secured,
    responses: { 200: ok("Storefront settings"), 401: errors[401], 403: errors[403] },
  });
  r.registerPath({
    method: "patch",
    path: "/api/shop/storefront",
    summary: "Change storefront settings; an empty string clears a text field (owner)",
    tags: ["Storefront"],
    security: secured,
    request: { body: json(StorefrontBody) },
    responses: { 200: ok("Updated storefront settings"), 400: errors[400], 401: errors[401], 403: errors[403] },
  });
  r.registerPath({
    method: "get",
    path: "/api/shop/slides",
    summary: "Hero slides in carousel order (owner)",
    tags: ["Storefront"],
    security: secured,
    responses: { 200: ok("Slides"), 401: errors[401], 403: errors[403] },
  });
  r.registerPath({
    method: "post",
    path: "/api/shop/slides",
    summary: "Add a hero slide with its image; at most 6 per shop (owner)",
    tags: ["Storefront"],
    security: secured,
    request: { body: { content: { "multipart/form-data": { schema: SlideUpload } } } },
    responses: {
      201: ok("Created slide"),
      400: errors[400],
      401: errors[401],
      403: errors[403],
      422: error("SLIDE_LIMIT, FILE_TOO_LARGE or UNSUPPORTED_FILE"),
    },
  });
  r.registerPath({
    method: "patch",
    path: "/api/shop/slides/{id}",
    summary: "Edit a slide's text or move it to another position (owner)",
    tags: ["Storefront"],
    security: secured,
    request: { params: IdParam, body: json(UpdateSlideBody) },
    responses: { 200: ok("Updated slide"), ...errors },
  });
  r.registerPath({
    method: "delete",
    path: "/api/shop/slides/{id}",
    summary: "Remove a slide and its image (owner)",
    tags: ["Storefront"],
    security: secured,
    request: { params: IdParam },
    responses: deleted,
  });
  r.registerPath({
    method: "get",
    path: "/api/categories",
    summary: "The shop's product categories in order (owner, manager, staff)",
    tags: ["Products"],
    security: secured,
    responses: { 200: ok("Categories"), 401: errors[401], 403: errors[403] },
  });
  r.registerPath({
    method: "post",
    path: "/api/categories",
    summary: "Add a category; at most 30 per shop (owner, manager)",
    tags: ["Products"],
    security: secured,
    request: { body: json(CategoryBody) },
    responses: {
      201: ok("Created category"),
      400: errors[400],
      401: errors[401],
      403: errors[403],
      422: error("DUPLICATE_CATEGORY or CATEGORY_LIMIT"),
    },
  });
  r.registerPath({
    method: "patch",
    path: "/api/categories/{id}",
    summary: "Rename a category or move it to another position (owner, manager)",
    tags: ["Products"],
    security: secured,
    request: { params: IdParam, body: json(UpdateCategoryBody) },
    responses: { 200: ok("Updated category"), ...errors, 422: error("DUPLICATE_CATEGORY") },
  });
  r.registerPath({
    method: "delete",
    path: "/api/categories/{id}",
    summary: "Delete a category; its products become uncategorised (owner, manager)",
    tags: ["Products"],
    security: secured,
    request: { params: IdParam },
    responses: deleted,
  });
  r.registerPath({
    method: "get",
    path: "/api/testimonials",
    summary: "Shop testimonials sent by customers, newest first (owner, manager, staff)",
    tags: ["Reviews"],
    security: secured,
    request: { query: ListTestimonialsQuery },
    responses: { 200: ok("Testimonials"), 400: errors[400], 401: errors[401], 403: errors[403] },
  });
  r.registerPath({
    method: "patch",
    path: "/api/testimonials/{id}",
    summary: "Approve a testimonial for the storefront or reject it (owner, manager)",
    tags: ["Reviews"],
    security: secured,
    request: { params: IdParam, body: json(ModerateTestimonialBody) },
    responses: { 200: ok("Moderated testimonial"), ...errors },
  });
  r.registerPath({
    method: "post",
    path: "/api/public/shops/{slug}/testimonials",
    summary: "Send shop feedback for public display; consent must be true and the shop approves it first",
    tags: ["Public"],
    request: { params: SlugParam, body: json(TestimonialBody) },
    responses: {
      201: ok('{ status: "PENDING" }'),
      400: errors[400],
      404: errors[404],
      429: error("Too many attempts; see the retry-after header"),
    },
  });
}
