import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { SlugParam } from "../common";
import { SignupBody } from "../signup";
import type { PathHelpers } from "./helpers";

// Accounts, health and the public catalogue.
export function registerCore(r: OpenAPIRegistry, { secured, ok, error, errors }: PathHelpers) {
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
    responses: { 200: ok("Current actor and shop"), 401: errors[401], 403: errors[403] },
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
}
