import { OpenAPIRegistry, OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi";
import { registerCore } from "./paths/core";
import { pathHelpers } from "./paths/helpers";
import { registerMoney } from "./paths/money";
import { registerOrders } from "./paths/orders";
import { registerProducts } from "./paths/products";
import { registerReviews } from "./paths/reviews";
import { registerShop } from "./paths/shop";
import { registerStorefront } from "./paths/storefront";
import { registerTeam } from "./paths/team";

// The API contract, built from the same Zod schemas the routes validate with.
// Each area registers its routes in validation/paths/<area>.ts; CI regenerates
// docs/openapi.json and fails if it changed.
export function buildOpenApi() {
  const r = new OpenAPIRegistry();
  const h = pathHelpers(r);
  for (const register of [registerCore, registerProducts, registerOrders, registerShop, registerMoney, registerTeam, registerReviews, registerStorefront]) {
    register(r, h);
  }
  return new OpenApiGeneratorV31(r.definitions).generateDocument({
    openapi: "3.1.0",
    info: { title: "Mahhali API", version: "0.2.0", description: "Shop Link: orders for Instagram and WhatsApp shops." },
  });
}
