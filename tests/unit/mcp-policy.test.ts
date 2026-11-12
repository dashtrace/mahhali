import { describe, expect, it } from "vitest";
import {
  MCP_SCOPES,
  MCP_TOOLS,
  canUseTool,
  connectShop,
  grantableScopes,
  needsShopPicker,
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

  it("marks only confirm, undo and new photo links as writes", () => {
    expect(MCP_TOOLS.filter((t) => !toolRule(t).readOnly)).toEqual(["confirm_product_import", "undo_product_import", "photo_upload_link"]);
  });
});

describe("which shop a connection is for", () => {
  it("uses the shop the user picked, if they can still connect it", () => {
    expect(connectShop(["a", "b"], "b")).toBe("b");
    expect(connectShop(["a", "b"], "gone")).toBeNull();
    expect(connectShop(["a", "b"], null)).toBeNull();
  });

  it("uses the only shop of a one-shop member", () => {
    expect(connectShop(["a"], null)).toBe("a");
    expect(connectShop(["a"], "gone")).toBe("a");
    expect(connectShop([], null)).toBeNull();
  });

  it("shows the picker to members of several shops until they pick one", () => {
    expect(needsShopPicker(["a"], null, false)).toBe(false);
    expect(needsShopPicker(["a", "b"], "a", false)).toBe(true);
    expect(needsShopPicker(["a", "b"], "a", true)).toBe(false);
    expect(needsShopPicker(["a", "b"], "gone", true)).toBe(true);
    expect(needsShopPicker([], null, true)).toBe(true);
  });
});

describe("scopes a consent grants", () => {
  const everything = ["offline_access", ...ALL_SCOPES];

  it("keeps what the role allows and the assistant asked for", () => {
    expect(grantableScopes("owner", everything)).toEqual([...ALL_SCOPES, "offline_access"]);
    expect(grantableScopes("staff", everything)).toEqual(["orders:read", "catalogue:read", "offline_access"]);
    expect(grantableScopes("delivery", everything)).toEqual(["orders:read", "offline_access"]);
    expect(grantableScopes("owner", ["orders:read"])).toEqual(["orders:read"]);
  });

  it("drops what the user unticked", () => {
    expect(grantableScopes("owner", everything, ["orders:read", "offline_access"])).toEqual(["orders:read", "offline_access"]);
  });

  it("ignores scopes it does not know", () => {
    expect(grantableScopes("owner", ["orders:read", "admin:all"], ["orders:read", "admin:all"])).toEqual(["orders:read"]);
  });
});
