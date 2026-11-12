import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { seedVariant } from "./fixtures";
import { addMember, resetDb, signUpOwner } from "./helpers";
import { callTool } from "./mcpHelpers";
import { connect } from "./oauthHelpers";

let shopId: string;
let ownerToken: string;
let ownerId: string;
let managerToken: string;
let staffToken: string;

const hoodie = {
  name: "Black hoodie",
  category: "Hoodies",
  options: ["Size"],
  variants: [
    { optionValues: ["M"], price: "25", stock: 10, sku: "HD-M" },
    { optionValues: ["L"], price: 25.5, stock: 4, sku: "HD-L" },
  ],
};
const oud = { name: "عطر عود", description: "عطر شرقي", variants: [{ price: "45", stock: 7 }] };

beforeAll(async () => {
  await resetDb();
  const owner = await signUpOwner();
  shopId = owner.shop.id;
  ownerId = owner.user.id;
  await seedVariant(shopId, { name: "Linen shirt", options: [], optionValues: [] });
  ownerToken = (await connect({ cookie: owner.cookie, scopes: ["catalogue:read", "catalogue:write"] })).access_token;
  const manager = await addMember(shopId, "manager");
  managerToken = (await connect({ cookie: manager.cookie, scopes: ["catalogue:write"] })).access_token;
  const staff = await addMember(shopId, "staff");
  staffToken = (await connect({ cookie: staff.cookie, scopes: ["catalogue:read", "catalogue:write"] })).access_token;
});

async function preview(token: string, products: unknown[]) {
  const res = await callTool(token, "preview_product_import", { products });
  if (!res.ok) throw new Error(`preview refused: ${res.error}`);
  return res.data;
}

describe("previewing a product import", () => {
  it("checks the products, saves a preview and creates nothing", async () => {
    const before = await prisma.product.count({ where: { shopId } });
    const d = await preview(ownerToken, [hoodie, oud]);
    expect(d.importId).toEqual(expect.any(String));
    expect(new Date(d.expiresAt).getTime()).toBeGreaterThan(Date.now() + 14 * 60_000);
    expect(d.summary).toEqual({ ready: 2, variants: 3, duplicates: 0, errors: 0, newCategories: ["Hoodies"] });
    expect(d.rows[0].product.variants).toEqual([
      { options: ["M"], sku: "HD-M", price: { minor: 2500, text: "$25.00" }, stock: 10 },
      { options: ["L"], sku: "HD-L", price: { minor: 2550, text: "$25.50" }, stock: 4 },
    ]);
    expect(d.rows[1]).toMatchObject({ row: 2, name: "عطر عود", status: "ready" });
    expect(await prisma.product.count({ where: { shopId } })).toBe(before);
    expect(await prisma.category.count({ where: { shopId } })).toBe(0);
    const saved = await prisma.productImport.findUniqueOrThrow({ where: { id: d.importId } });
    expect(saved).toMatchObject({ shopId, userId: ownerId, source: "MCP", status: "PREVIEWED", productCount: 2, variantCount: 3 });
  });

  it("reports each problem row and keeps the good ones", async () => {
    const d = await preview(ownerToken, [
      hoodie,
      { name: "Linen shirt", variants: [{ price: "20" }] },
      { name: "Cap", variants: [{ price: "$12" }] },
      { name: "Scarf", options: ["Colour"], variants: [{ optionValues: [], price: "10" }] },
      { name: "Socks", variants: [{ price: "3", sku: "HD-M" }] },
    ]);
    expect(d.rows.map((r: { status: string }) => r.status)).toEqual(["ready", "duplicate", "error", "error", "error"]);
    expect(d.rows[2].problems.join(" ")).toContain("digits");
    expect(d.summary).toMatchObject({ ready: 1, duplicates: 1, errors: 3 });
  });

  it("replaces the user's previous preview", async () => {
    const first = await preview(ownerToken, [hoodie]);
    const second = await preview(ownerToken, [{ ...hoodie, variants: [{ optionValues: ["M"], price: "30", stock: 1 }] }]);
    expect((await prisma.productImport.findUniqueOrThrow({ where: { id: first.importId } })).status).toBe("SUPERSEDED");
    expect((await prisma.productImport.findUniqueOrThrow({ where: { id: second.importId } })).status).toBe("PREVIEWED");
  });

  it("leaves another member's preview alone", async () => {
    const mine = await preview(ownerToken, [hoodie]);
    await preview(managerToken, [oud]);
    expect((await prisma.productImport.findUniqueOrThrow({ where: { id: mine.importId } })).status).toBe("PREVIEWED");
  });

  it("saves nothing when no row can be imported", async () => {
    const d = await preview(ownerToken, [{ name: "Linen shirt", variants: [{ price: "20" }] }]);
    expect(d.importId).toBeNull();
    expect(d.summary.ready).toBe(0);
  });

  it("prices in pounds for an LBP shop", async () => {
    const lbp = await signUpOwner({ currency: "LBP", usdLbpRate: "89500" });
    const token = (await connect({ cookie: lbp.cookie, scopes: ["catalogue:write"] })).access_token;
    const d = await preview(token, [{ name: "Za'atar", variants: [{ price: "450000" }] }, { name: "Labneh", variants: [{ price: "2.5" }] }]);
    const price = d.rows[0].product.variants[0].price;
    expect(price.minor).toBe(450000);
    expect(price.text.replace(/\s/g, " ")).toBe("LBP 450,000"); // Intl puts a no-break space after the code
    expect(d.rows[1].status).toBe("error");
  });

  it("refuses more than 100 products in one preview", async () => {
    const many = Array.from({ length: 101 }, (_, i) => ({ name: `P${i}`, variants: [{ price: "1" }] }));
    expect((await callTool(ownerToken, "preview_product_import", { products: many })).ok).toBe(false);
  });

  it("is not available to staff, even with the scope requested", async () => {
    expect((await callTool(staffToken, "preview_product_import", { products: [oud] })).ok).toBe(false);
  });
});
