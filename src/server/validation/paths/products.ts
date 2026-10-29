import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { IdParam } from "../common";
import {
  CreateProductBody,
  ImageParams,
  ListProductsQuery,
  StockAdjustmentBody,
  UpdateProductBody,
  UpdateVariantBody,
  VariantBody,
} from "../product";
import { z } from "../zod";
import type { PathHelpers } from "./helpers";

const ImageUpload = z
  .object({
    file: z.string().openapi({ format: "binary", description: "PNG, JPEG or WebP, up to 3 MB" }),
    colour: z.string().max(40).optional().openapi({ description: "The variant colour this photo shows" }),
  })
  .openapi("ImageUpload");

// Products, variants, stock and product photos.
export function registerProducts(r: OpenAPIRegistry, { secured, ok, error, errors }: PathHelpers) {
  r.registerPath({
    method: "get",
    path: "/api/products",
    summary: "List the shop's products (owner, manager, staff)",
    tags: ["Products"],
    security: secured,
    request: { query: ListProductsQuery },
    responses: { 200: ok("Products with variants"), 401: errors[401], 403: errors[403] },
  });
  r.registerPath({
    method: "post",
    path: "/api/products",
    summary: "Create a product with its variants (owner, manager)",
    tags: ["Products"],
    security: secured,
    request: { body: { content: { "application/json": { schema: CreateProductBody } } } },
    responses: { 201: ok("Created"), ...errors, 422: error("Price does not fit the shop currency") },
  });
  r.registerPath({
    method: "get",
    path: "/api/products/{id}",
    summary: "One product",
    tags: ["Products"],
    security: secured,
    request: { params: IdParam },
    responses: { 200: ok("Product"), ...errors },
  });
  r.registerPath({
    method: "patch",
    path: "/api/products/{id}",
    summary: "Rename, describe or archive a product (owner, manager)",
    tags: ["Products"],
    security: secured,
    request: { params: IdParam, body: { content: { "application/json": { schema: UpdateProductBody } } } },
    responses: { 200: ok("Updated product"), ...errors },
  });
  r.registerPath({
    method: "delete",
    path: "/api/products/{id}",
    summary: "Archive a product; it is never hard-deleted (owner, manager)",
    tags: ["Products"],
    security: secured,
    request: { params: IdParam },
    responses: { 200: ok("Archived product"), ...errors },
  });
  r.registerPath({
    method: "post",
    path: "/api/products/{id}/variants",
    summary: "Add a variant; initial stock is logged (owner, manager)",
    tags: ["Products"],
    security: secured,
    request: { params: IdParam, body: { content: { "application/json": { schema: VariantBody } } } },
    responses: { 201: ok("Created variant"), ...errors, 422: error("DUPLICATE_VARIANT or INVALID_PRICE") },
  });
  r.registerPath({
    method: "patch",
    path: "/api/variants/{id}",
    summary: "Change a variant's price, SKU, size or colour, or archive it (owner, manager)",
    tags: ["Products"],
    security: secured,
    request: { params: IdParam, body: { content: { "application/json": { schema: UpdateVariantBody } } } },
    responses: { 200: ok("Updated variant"), ...errors, 422: error("DUPLICATE_VARIANT or INVALID_PRICE") },
  });
  r.registerPath({
    method: "post",
    path: "/api/variants/{id}/stock-adjustments",
    summary: "Add or remove stock; logged as an ADJUST movement (owner, manager)",
    tags: ["Products"],
    security: secured,
    request: { params: IdParam, body: { content: { "application/json": { schema: StockAdjustmentBody } } } },
    responses: { 201: ok("Variant with its new stock"), ...errors, 422: error("STOCK_NEGATIVE") },
  });
  r.registerPath({
    method: "get",
    path: "/api/variants/{id}/movements",
    summary: "A variant's stock history, newest first (owner, manager, staff)",
    tags: ["Products"],
    security: secured,
    request: { params: IdParam },
    responses: { 200: ok("Stock movements"), ...errors },
  });
  r.registerPath({
    method: "post",
    path: "/api/products/{id}/images",
    summary: "Upload a product photo (owner, manager)",
    tags: ["Products"],
    security: secured,
    request: { params: IdParam, body: { content: { "multipart/form-data": { schema: ImageUpload } } } },
    responses: { 201: ok("Created image"), ...errors, 422: error("FILE_TOO_LARGE or UNSUPPORTED_FILE (type is read from the bytes)") },
  });
  r.registerPath({
    method: "delete",
    path: "/api/products/{id}/images/{imageId}",
    summary: "Remove a product photo (owner, manager)",
    tags: ["Products"],
    security: secured,
    request: { params: ImageParams },
    responses: { 204: { description: "Removed" }, ...errors },
  });
}
