import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { MCP_SCOPES, canUseTool, toolRule, type McpTool } from "@/server/domain/mcpPolicy";
import type { ShopRole } from "@/server/domain/policy";
import { TOOLS } from "@/server/mcp/tools";
import { seedCourier, seedOrder, seedVariant } from "./fixtures";
import { addMember, resetDb, signUpOwner } from "./helpers";
import { callTool } from "./mcpHelpers";
import { connect } from "./oauthHelpers";

// Generated from the policy: every implemented tool, called as every role with
// every scope requested, is allowed exactly when canUseTool says so. A tool
// added without sample arguments here fails the last test.

const SAMPLE_ARGS: Partial<Record<McpTool, Record<string, unknown>>> = {
  shop_info: {},
  list_orders: {},
  get_order: { number: 1001 },
  my_deliveries: {},
  list_products: {},
  stock_levels: {},
  list_reviews: {},
  sales_metrics: {},
  cod_reconciliation: {},
  unsettled_cash: {},
};

const PHONE = "+96171123456";
const SECRETS = ["71123456", "Haddad", "maya.haddad@example.com", "Armenia St", "pharmacy", "Building 12"];

type Member = { role: ShopRole; userId: string; token: string; scopes: string[] };
const members: Member[] = [];

beforeAll(async () => {
  await resetDb();
  const owner = await signUpOwner();
  const shopId = owner.shop.id;
  const { variant } = await seedVariant(shopId, { name: "Oud perfume", options: [], optionValues: [], available: 20 });
  const courier = await seedCourier(shopId, { name: "Toters" });
  const order = await seedOrder(shopId, {
    variantId: variant.id,
    status: "DELIVERED",
    courierId: courier.id,
    customerName: "Maya Haddad",
    customerPhone: PHONE,
    customerEmail: "maya.haddad@example.com",
  });
  await prisma.order.update({ where: { id: order.id }, data: { notes: `Call ${PHONE} or maya.haddad@example.com`, failureReason: "Customer said call 71 123 456" } });
  const item = await prisma.orderItem.findFirstOrThrow({ where: { orderId: order.id } });
  await prisma.review.create({
    data: { shopId, productId: variant.productId, orderItemId: item.id, rating: 2, comment: "Reach me at 71123456", authorName: "Maya Haddad" },
  });
  await seedOrder(shopId, { variantId: variant.id, status: "OUT_FOR_DELIVERY", courierId: courier.id, customerName: "Maya Haddad", customerPhone: PHONE });

  const everything = [...MCP_SCOPES];
  const ownerConn = await connect({ cookie: owner.cookie, scopes: everything });
  members.push({ role: "owner", userId: owner.user.id, token: ownerConn.access_token, scopes: ownerConn.scope.split(" ") });
  for (const role of ["manager", "staff", "delivery"] as const) {
    const m = await addMember(shopId, role, role === "delivery" ? courier.id : undefined);
    const conn = await connect({ cookie: m.cookie, scopes: everything });
    members.push({ role, userId: m.userId, token: conn.access_token, scopes: conn.scope.split(" ") });
  }
});

const implemented = () => Object.keys(TOOLS) as McpTool[];

describe("MCP policy matrix", () => {
  it("allows each tool for exactly the roles the policy allows", async () => {
    for (const m of members) {
      for (const tool of implemented()) {
        await callTool(m.token, tool, SAMPLE_ARGS[tool] ?? {});
        const last = await prisma.mcpToolCall.findFirstOrThrow({
          where: { userId: m.userId, tool },
          orderBy: { createdAt: "desc" },
        });
        const allowed = canUseTool(m.role, m.scopes, tool);
        expect(last.outcome === "DENIED" ? "denied" : "allowed", `${m.role} ${tool}`).toBe(allowed ? "allowed" : "denied");
        if (allowed) expect(last.outcome, `${m.role} ${tool}`).toBe("OK");
      }
    }
  });

  it("never returns a customer's full phone, surname, email or street from any read tool", async () => {
    for (const m of members) {
      for (const tool of implemented().filter((t) => toolRule(t).readOnly)) {
        if (!canUseTool(m.role, m.scopes, tool)) continue;
        const res = await callTool(m.token, tool, SAMPLE_ARGS[tool] ?? {});
        expect(res.ok, `${m.role} ${tool}`).toBe(true);
        const text = JSON.stringify(res);
        for (const secret of SECRETS) expect(text, `${m.role} ${tool} leaked ${secret}`).not.toContain(secret);
        expect(text, `${m.role} ${tool} returned a full international number`).not.toMatch(/\+\d{9,}/);
      }
    }
  });

  it("has sample arguments for every implemented tool", () => {
    for (const tool of implemented()) expect(SAMPLE_ARGS, tool).toHaveProperty(tool);
  });
});
