import type { McpOutcome } from "@prisma/client";
import { db, type Db } from "./tx";

export type McpCallRecord = {
  shopId: string;
  userId: string;
  clientId: string;
  tool: string;
  outcome: McpOutcome;
  errorCode?: string | null;
  durationMs: number;
};

// One row per AI assistant tool call. Never the call's input or output.
export const mcpAuditRepo = {
  record(call: McpCallRecord, client: Db = db) {
    return client.mcpToolCall.create({ data: { ...call, errorCode: call.errorCode ?? null } });
  },

  list(shopId: string, opts: { take: number }, client: Db = db) {
    return client.mcpToolCall.findMany({ where: { shopId }, orderBy: { createdAt: "desc" }, take: opts.take });
  },
};
