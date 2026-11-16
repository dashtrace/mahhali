import type { ZodType } from "zod";
import type { McpTool } from "../domain/mcpPolicy";
import type { McpActor } from "../http/withRoute";

/**
 * One tool an AI assistant can call. Which roles and scopes may call it lives
 * in domain/mcpPolicy.ts; the handler only calls services, as a route does.
 */
export type ToolDef<I = unknown> = {
  name: McpTool;
  title: string;
  /** Read by the assistant to decide when to call the tool: say what it answers and what it never does. */
  description: string;
  input: ZodType<I>;
  run: (actor: McpActor, input: I) => Promise<unknown>;
};

export function defineTool<I>(def: ToolDef<I>): ToolDef<I> {
  return def;
}
