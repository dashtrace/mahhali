import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { seedVariant } from "./fixtures";
import { resetDb, signUpOwner } from "./helpers";

// The database itself refuses imports and audit rows that break the rules,
// whatever the service layer does.

let shopId: string;
let userId: string;

const importRow = (overrides: Record<string, unknown> = {}) => ({
  shopId,
  userId,
  source: "MCP" as const,
  rows: [],
  report: {},
  productCount: 1,
  variantCount: 1,
  expiresAt: new Date(Date.now() + 15 * 60_000),
  ...overrides,
});

beforeAll(async () => {
  await resetDb();
  const owner = await signUpOwner();
  shopId = owner.shop.id;
  userId = owner.user.id;
});

describe("MCP connector schema", () => {
  it("creates the OAuth provider tables", async () => {
    const tables = await prisma.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'oauth_%' ORDER BY tablename`;
    expect(tables.map((t) => t.tablename)).toEqual([
      "oauth_access_token",
      "oauth_client",
      "oauth_client_assertion",
      "oauth_client_resource",
      "oauth_consent",
      "oauth_refresh_token",
      "oauth_resource",
    ]);
  });

  it("limits a preview to between 1 and 100 products", async () => {
    await expect(prisma.productImport.create({ data: importRow({ productCount: 0, variantCount: 0 }) })).rejects.toThrow();
    await expect(prisma.productImport.create({ data: importRow({ productCount: 101, variantCount: 101 }) })).rejects.toThrow();
    await expect(prisma.productImport.create({ data: importRow({ productCount: 2, variantCount: 1 }) })).rejects.toThrow();
    await expect(prisma.productImport.create({ data: importRow({ productCount: 100, variantCount: 250 }) })).resolves.toBeTruthy();
  });

  it("requires the dates that go with a confirmed or undone import", async () => {
    await expect(prisma.productImport.create({ data: importRow({ status: "CONFIRMED" }) })).rejects.toThrow();
    await expect(
      prisma.productImport.create({ data: importRow({ status: "UNDONE", confirmedAt: new Date() }) }),
    ).rejects.toThrow();
    await expect(
      prisma.productImport.create({ data: importRow({ status: "CONFIRMED", confirmedAt: new Date() }) }),
    ).resolves.toBeTruthy();
  });

  it("keeps a product when its import record is deleted", async () => {
    const imp = await prisma.productImport.create({ data: importRow() });
    const { product } = await seedVariant(shopId);
    await prisma.product.update({ where: { id: product.id }, data: { importId: imp.id } });
    await prisma.productImport.delete({ where: { id: imp.id } });
    const after = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(after.importId).toBeNull();
  });

  it("refuses a negative duration in the audit log", async () => {
    const base = { shopId, userId, clientId: "client", tool: "shop_info", outcome: "OK" as const };
    await expect(prisma.mcpToolCall.create({ data: { ...base, durationMs: -1 } })).rejects.toThrow();
    await expect(prisma.mcpToolCall.create({ data: { ...base, durationMs: 0 } })).resolves.toBeTruthy();
  });
});
