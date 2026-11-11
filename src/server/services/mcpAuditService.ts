import type { McpActor } from "../http/withRoute";
import { mcpAuditRepo, type McpCallRecord } from "../repositories/mcpAuditRepo";

// The audit trail of AI assistant tool calls. Writing it never fails a call:
// a lost audit row is logged, the assistant still gets its answer.
export const mcpAuditService = {
  async record(actor: McpActor, call: Omit<McpCallRecord, "shopId" | "userId" | "clientId">) {
    try {
      await mcpAuditRepo.record({
        shopId: actor.shopId,
        userId: actor.userId,
        clientId: actor.clientId,
        ...call,
        tool: call.tool.slice(0, 64),
      });
    } catch (error) {
      console.error("mcp audit write failed", error);
    }
  },
};
