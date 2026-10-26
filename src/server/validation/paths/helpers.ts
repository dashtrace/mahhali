import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { ErrorBody } from "../common";
import { z } from "../zod";

/** Shared response shapes for the per-area path files. */
export function pathHelpers(r: OpenAPIRegistry) {
  const cookie = r.registerComponent("securitySchemes", "session", {
    type: "apiKey",
    in: "cookie",
    name: "better-auth.session_token",
  });
  const cron = r.registerComponent("securitySchemes", "cronSecret", {
    type: "apiKey",
    in: "header",
    name: "x-cron-secret",
  });
  const error = (description: string) => ({ description, content: { "application/json": { schema: ErrorBody } } });
  const ok = (description: string) => ({ description, content: { "application/json": { schema: z.unknown() } } });
  return {
    secured: [{ [cookie.name]: [] }],
    cronSecured: [{ [cron.name]: [] }],
    error,
    ok,
    errors: {
      400: error("Invalid input"),
      401: error("Not signed in"),
      403: error("Role not allowed"),
      404: error("Not found, or belongs to another shop"),
    },
  };
}

export type PathHelpers = ReturnType<typeof pathHelpers>;
