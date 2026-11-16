import { withRoute } from "@/server/http/withRoute";
import { oauthService } from "@/server/services/oauthService";

// OAuth authorization server metadata (RFC 8414), for AI assistants connecting to /api/mcp.
export const GET = withRoute({ access: { kind: "public" } }, () => oauthService.authorizationServerMetadata());
