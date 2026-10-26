import { withRoute } from "@/server/http/withRoute";
import { billingService } from "@/server/services/billingService";

// No body schema: the signature covers the raw bytes, so the body is read as text.
export const POST = withRoute({ access: { kind: "public" } }, async ({ req }) =>
  billingService.webhook(await req.text(), req.headers.get("stripe-signature")),
);
