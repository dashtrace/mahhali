import { withRoute } from "@/server/http/withRoute";
import { handleMcpRequest } from "@/server/mcp/server";

// MCP endpoint for AI assistants (Streamable HTTP, stateless). The OAuth access
// token decides the shop and member; each tool checks role and granted scopes.
const handler = withRoute({ access: { kind: "mcp" } }, ({ req, actor }) => handleMcpRequest(req, actor));

export { handler as DELETE, handler as GET, handler as POST };
