import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { IdParam } from "../common";
import { CreateCourierBody, ListCouriersQuery, UpdateCourierBody } from "../courier";
import { BrandingBody, ShopSettingsBody } from "../shop";
import { z } from "../zod";
import type { PathHelpers } from "./helpers";

const LogoUpload = z
  .object({ file: z.string().openapi({ format: "binary", description: "PNG, JPEG, WebP or SVG, up to 1 MB" }) })
  .openapi("LogoUpload");

// Couriers, shop settings, branding and the logo.
export function registerShop(r: OpenAPIRegistry, { secured, ok, error, errors }: PathHelpers) {
  r.registerPath({
    method: "get",
    path: "/api/couriers",
    summary: "List the shop's couriers (owner, manager, staff)",
    tags: ["Couriers"],
    security: secured,
    request: { query: ListCouriersQuery },
    responses: { 200: ok("Couriers"), 401: errors[401], 403: errors[403] },
  });
  r.registerPath({
    method: "post",
    path: "/api/couriers",
    summary: "Add a delivery company or person (owner, manager)",
    tags: ["Couriers"],
    security: secured,
    request: { body: { content: { "application/json": { schema: CreateCourierBody } } } },
    responses: { 201: ok("Created courier"), 400: errors[400], 401: errors[401], 403: errors[403] },
  });
  r.registerPath({
    method: "patch",
    path: "/api/couriers/{id}",
    summary: "Rename, re-type or deactivate a courier (owner, manager)",
    tags: ["Couriers"],
    security: secured,
    request: { params: IdParam, body: { content: { "application/json": { schema: UpdateCourierBody } } } },
    responses: { 200: ok("Updated courier"), ...errors },
  });
  r.registerPath({
    method: "get",
    path: "/api/shop/settings",
    summary: "Shop settings (owner)",
    tags: ["Shop"],
    security: secured,
    responses: { 200: ok("Settings; money in minor units"), 401: errors[401], 403: errors[403] },
  });
  r.registerPath({
    method: "patch",
    path: "/api/shop/settings",
    summary: "Change shop settings; the currency is fixed at sign-up (owner)",
    tags: ["Shop"],
    security: secured,
    request: { body: { content: { "application/json": { schema: ShopSettingsBody } } } },
    responses: {
      200: ok("Updated settings"),
      400: errors[400],
      401: errors[401],
      403: errors[403],
      422: error("Amount does not fit the shop currency"),
    },
  });
  r.registerPath({
    method: "get",
    path: "/api/shop/branding",
    summary: "Theme, logo and the ready-made palettes (owner)",
    tags: ["Shop"],
    security: secured,
    responses: { 200: ok("Branding"), 401: errors[401], 403: errors[403] },
  });
  r.registerPath({
    method: "patch",
    path: "/api/shop/branding",
    summary: "Set custom theme colours or pick a palette (owner)",
    tags: ["Shop"],
    security: secured,
    request: { body: { content: { "application/json": { schema: BrandingBody } } } },
    responses: {
      200: ok("Updated branding"),
      400: errors[400],
      401: errors[401],
      403: errors[403],
      422: error("LOW_CONTRAST: text below WCAG AA; details list the failing pairs"),
    },
  });
  r.registerPath({
    method: "post",
    path: "/api/shop/logo",
    summary: "Upload the shop logo (owner)",
    tags: ["Shop"],
    security: secured,
    request: { body: { content: { "multipart/form-data": { schema: LogoUpload } } } },
    responses: {
      200: ok("{ logo: url }"),
      400: errors[400],
      401: errors[401],
      403: errors[403],
      422: error("FILE_TOO_LARGE or UNSUPPORTED_FILE (type is read from the bytes)"),
    },
  });
  r.registerPath({
    method: "delete",
    path: "/api/shop/logo",
    summary: "Remove the shop logo (owner)",
    tags: ["Shop"],
    security: secured,
    responses: { 204: { description: "Removed" }, 401: errors[401], 403: errors[403] },
  });
  r.registerPath({
    method: "get",
    path: "/uploads/{shopId}/{file}",
    summary: "An uploaded logo or photo (served by Caddy in production)",
    tags: ["Public"],
    request: { params: z.object({ shopId: z.string(), file: z.string() }) },
    responses: { 200: { description: "The image" }, 404: errors[404] },
  });
}
