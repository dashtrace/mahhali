import { withRoute } from "@/server/http/withRoute";
import { testimonialService } from "@/server/services/storefrontService";
import { ListTestimonialsQuery } from "@/server/validation/storefront";

export const GET = withRoute(
  { access: { kind: "shop", action: "review.read" }, query: ListTestimonialsQuery },
  ({ actor, query }) => testimonialService.list(actor, query.status),
);
