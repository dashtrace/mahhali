import { DELETE, GET, POST } from "@/app/api/mcp/route";

// Speaks MCP (JSON-RPC over Streamable HTTP) to /api/mcp, as Claude or ChatGPT would.

let nextId = 1;

export async function mcp(token: string | null, method: string, params?: unknown, opts: { httpMethod?: "GET" | "POST" | "DELETE" } = {}) {
  const headers = new Headers({ accept: "application/json, text/event-stream", "content-type": "application/json" });
  if (token) headers.set("authorization", `Bearer ${token}`);
  const httpMethod = opts.httpMethod ?? "POST";
  const req = new Request("http://localhost:3000/api/mcp", {
    method: httpMethod,
    headers,
    body: httpMethod === "POST" ? JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, ...(params ? { params } : {}) }) : undefined,
  });
  const handler = { GET, POST, DELETE }[httpMethod];
  const res = await handler(req, { params: Promise.resolve({}) });
  const text = await res.text();
  return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : null };
}

export async function listTools(token: string): Promise<string[]> {
  const res = await mcp(token, "tools/list");
  if (res.status !== 200 || !res.body.result) throw new Error(`tools/list failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.result.tools.map((t: { name: string }) => t.name);
}

/** Calls a tool; returns the parsed JSON it answered, or the error text when it refused. */
export async function callTool(token: string, name: string, args: Record<string, unknown> = {}) {
  const res = await mcp(token, "tools/call", { name, arguments: args });
  if (res.status !== 200) throw new Error(`tools/call ${name} failed: ${res.status} ${JSON.stringify(res.body)}`);
  if (res.body.error) return { ok: false as const, error: String(res.body.error.message) };
  const result = res.body.result;
  const text: string = result.content?.[0]?.text ?? "";
  if (result.isError) return { ok: false as const, error: text };
  return { ok: true as const, data: JSON.parse(text) };
}
