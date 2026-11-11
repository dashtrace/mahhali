// What an AI assistant connected over MCP may do. A tool runs only when the
// member's role allows its action (policy.ts) AND the user granted its scope
// when connecting, so a token can never do more than the member could in the
// dashboard.
import { can, type Action, type ShopRole } from "./policy";

export const MCP_SCOPES = ["orders:read", "catalogue:read", "catalogue:write", "finance:read"] as const;
export type McpScope = (typeof MCP_SCOPES)[number];

export function isMcpScope(value: string): value is McpScope {
  return (MCP_SCOPES as readonly string[]).includes(value);
}

type ToolRule = {
  /** null: any member of the shop. */
  action: Action | null;
  /** null: needs no particular scope. */
  scope: McpScope | null;
  readOnly: boolean;
};

const TOOLS = {
  shop_info: { action: null, scope: null, readOnly: true },
  list_orders: { action: "order.read", scope: "orders:read", readOnly: true },
  get_order: { action: "order.read", scope: "orders:read", readOnly: true },
  my_deliveries: { action: "order.readAssigned", scope: "orders:read", readOnly: true },
  list_products: { action: "product.read", scope: "catalogue:read", readOnly: true },
  stock_levels: { action: "product.read", scope: "catalogue:read", readOnly: true },
  list_reviews: { action: "review.read", scope: "catalogue:read", readOnly: true },
  sales_metrics: { action: "metrics.read", scope: "finance:read", readOnly: true },
  cod_reconciliation: { action: "reconciliation.read", scope: "finance:read", readOnly: true },
  unsettled_cash: { action: "reconciliation.read", scope: "finance:read", readOnly: true },
  preview_product_import: { action: "product.write", scope: "catalogue:write", readOnly: true },
  confirm_product_import: { action: "product.write", scope: "catalogue:write", readOnly: false },
  undo_product_import: { action: "product.write", scope: "catalogue:write", readOnly: false },
} as const satisfies Record<string, ToolRule>;

export type McpTool = keyof typeof TOOLS;
export const MCP_TOOLS = Object.keys(TOOLS) as McpTool[];

export function toolRule(tool: McpTool): ToolRule {
  return TOOLS[tool];
}

function roleAllows(role: ShopRole, tool: McpTool): boolean {
  const { action } = TOOLS[tool];
  return action === null || can(role, action);
}

export function canUseTool(role: ShopRole, scopes: readonly string[], tool: McpTool): boolean {
  const { scope } = TOOLS[tool];
  return roleAllows(role, tool) && (scope === null || scopes.includes(scope));
}

/** The tools a connection may see and call. */
export function toolsFor(role: ShopRole, scopes: readonly string[]): McpTool[] {
  return MCP_TOOLS.filter((tool) => canUseTool(role, scopes, tool));
}

/** The scopes worth offering on the consent page: those with at least one tool the role may use. */
export function scopesForRole(role: ShopRole): McpScope[] {
  return MCP_SCOPES.filter((scope) =>
    MCP_TOOLS.some((tool) => TOOLS[tool].scope === scope && roleAllows(role, tool)),
  );
}
