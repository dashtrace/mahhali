import { OpenAPIRegistry, OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi";
import { ErrorBody, IdParam, SlugParam } from "./common";
import { CreateProductBody, ListProductsQuery, UpdateProductBody } from "./product";
import { SignupBody } from "./signup";
import { z } from "./zod";

// The API contract, built from the same Zod schemas the routes validate with.
// Add each new route here; CI regenerates docs/openapi.json and fails if it changed.
export function buildOpenApi() {
  const r = new OpenAPIRegistry();
  const cookie = r.registerComponent("securitySchemes", "session", {
    type: "apiKey",
    in: "cookie",
    name: "better-auth.session_token",
  });
  const secured = [{ [cookie.name]: [] }];
  const error = (description: string) => ({ description, content: { "application/json": { schema: ErrorBody } } });
  const ok = (description: string) => ({ description, content: { "application/json": { schema: z.unknown() } } });
  const errors = {
    400: error("Invalid input"),
    401: error("Not signed in"),
    403: error("Role not allowed"),
    404: error("Not found, or belongs to another shop"),
  };

  r.registerPath({
    method: "post",
    path: "/api/signup",
    summary: "Sign up a business: owner account, shop and owner membership",
    tags: ["Accounts"],
    request: { body: { content: { "application/json": { schema: SignupBody } } } },
    responses: { 201: ok("Signed up; session cookie set"), 400: errors[400], 409: error("Email or shop link taken") },
  });
  r.registerPath({
    method: "get",
    path: "/api/me",
    summary: "The signed-in user's shop and role",
    tags: ["Accounts"],
    security: secured,
    responses: { 200: ok("Current actor"), 401: errors[401], 403: errors[403] },
  });
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
    method: "get",
    path: "/api/public/shops/{slug}/catalogue",
    summary: "Public catalogue for a shop's Instagram bio link",
    tags: ["Public"],
    request: { params: SlugParam },
    responses: { 200: ok("Shop and active products"), 404: errors[404] },
  });
  r.registerPath({
    method: "get",
    path: "/api/health",
    summary: "Liveness check",
    tags: ["Public"],
    responses: { 200: ok("OK") },
  });

  return new OpenApiGeneratorV31(r.definitions).generateDocument({
    openapi: "3.1.0",
    info: { title: "Mahhali API", version: "0.1.0", description: "Shop Link: orders for Instagram and WhatsApp shops." },
  });
}
