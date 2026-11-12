import { withRoute } from "@/server/http/withRoute";
import { oauthService } from "@/server/services/oauthService";

// Protected resource metadata for /api/mcp (RFC 9728): where to get a token and which scopes exist.
export const GET = withRoute({ access: { kind: "public" } }, async () => oauthService.protectedResourceMetadata());
