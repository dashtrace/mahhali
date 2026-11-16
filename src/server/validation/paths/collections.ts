import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { IdParam } from "../common";
import { CollectionBody, UpdateCollectionBody } from "../collections";
import type { PathHelpers } from "./helpers";

export function registerCollections(r: OpenAPIRegistry, { secured, ok, errors }: PathHelpers) {
  for (const path of ["/api/categories/{id}/collections", "/api/collections/{id}/sections"]) {
    r.registerPath({ method: "post", path, tags: ["Products"], security: secured,
      summary: "Add an optional collection or section under its parent; at most 30 (owner, manager)",
      request: { params: IdParam, body: { content: { "application/json": { schema: CollectionBody } } } },
      responses: { ...errors, 201: ok("Created item"), 422: { description: "Duplicate sibling name or parent limit reached" } },
    });
  }
  for (const path of ["/api/collections/{id}", "/api/sections/{id}"]) {
    r.registerPath({ method: "patch", path, tags: ["Products"], security: secured,
      summary: "Rename or reorder a collection or section (owner, manager)",
      request: { params: IdParam, body: { content: { "application/json": { schema: UpdateCollectionBody } } } },
      responses: { ...errors, 200: ok("Updated item"), 422: { description: "Duplicate sibling name" } },
    });
    r.registerPath({ method: "delete", path, tags: ["Products"], security: secured,
      summary: "Remove an item and its sections; products remain in their category (owner, manager)",
      request: { params: IdParam }, responses: { ...errors, 204: { description: "Deleted" } },
    });
  }
}
