import { withRoute } from "@/server/http/withRoute";
import { productService } from "@/server/services/productService";

// A short fingerprint of the product list; the products page polls it and reloads only when it changes.
export const GET = withRoute({ access: { kind: "shop", action: "product.read" } }, ({ actor }) => productService.version(actor));
