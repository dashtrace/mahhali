import { describe, expect, it } from "vitest";
import {
  MCP_SCOPES,
  MCP_TOOLS,
  canUseTool,
  scopesForRole,
  toolRule,
  toolsFor,
} from "@/server/domain/mcpPolicy";
import { SHOP_ROLES, can } from "@/server/domain/policy";

const ALL_SCOPES = [...MCP_SCOPES];

describe("MCP tool policy", () => {
  it("never lets a tool do more than the role can do in the dashboard", () => {
    for (const role of SHOP_ROLES) {
      for (const tool of MCP_TOOLS) {
        const { action } = toolRule(tool);
        expect(canUseTool(role, ALL_SCOPES, tool), `${role} ${tool}`).toBe(action === null || can(role, action));
      }
    }
  });

  it("refuses a tool whose scope the user did not grant", () => {
    for (const role of SHOP_ROLES) {
      for (const tool of MCP_TOOLS) {
        const { scope } = toolRule(tool);
        if (scope === null) continue;
        const without = ALL_SCOPES.filter((s) => s !== scope);
        expect(canUseTool(role, without, tool), `${role} ${tool}`).toBe(false);
      }
    }
  });

  it("gives each role the expected tools", () => {
    expect(toolsFor("owner", ALL_SCOPES)).toEqual(MCP_TOOLS);
    expect(toolsFor("manager", ALL_SCOPES)).toEqual(MCP_TOOLS);
    expect(toolsFor("staff", ALL_SCOPES)).toEqual([
      "shop_info", "list_orders", "get_order", "my_deliveries", "list_products", "stock_levels", "list_reviews",
    ]);
    expect(toolsFor("delivery", ALL_SCOPES)).toEqual(["shop_info", "my_deliveries"]);
  });

  it("offers only the scopes a role can use", () => {
    expect(scopesForRole("owner")).toEqual(ALL_SCOPES);
    expect(scopesForRole("manager")).toEqual(ALL_SCOPES);
    expect(scopesForRole("staff")).toEqual(["orders:read", "catalogue:read"]);
    expect(scopesForRole("delivery")).toEqual(["orders:read"]);
  });

  it("keeps shop_info available with no scopes so a connection can always say who it is", () => {
    for (const role of SHOP_ROLES) expect(toolsFor(role, [])).toEqual(["shop_info"]);
  });

  it("marks only confirm and undo as writes", () => {
    expect(MCP_TOOLS.filter((t) => !toolRule(t).readOnly)).toEqual(["confirm_product_import", "undo_product_import"]);
  });
});
