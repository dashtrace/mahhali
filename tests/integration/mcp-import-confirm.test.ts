import { beforeAll, describe, expect, it } from "vitest";
import { GET as publicCatalogue } from "@/app/api/public/shops/[slug]/catalogue/route";
import { GET as listProducts } from "@/app/api/products/route";
import { prisma } from "@/server/db";
import { seedVariant } from "./fixtures";
import { addMember, call, resetDb, signUpOwner } from "./helpers";
import { callTool } from "./mcpHelpers";
import { connect } from "./oauthHelpers";

let owner: Awaited<ReturnType<typeof signUpOwner>>;
let ownerToken: string;
let managerToken: string;
let staffToken: string;
let n = 0;

beforeAll(async () => {
  await resetDb();
  owner = await signUpOwner();
  ownerToken = (await connect({ cookie: owner.cookie, scopes: ["catalogue:read", "catalogue:write"] })).access_token;
  const manager = await addMember(owner.shop.id, "manager");
  managerToken = (await connect({ cookie: manager.cookie, scopes: ["catalogue:write"] })).access_token;
  const staff = await addMember(owner.shop.id, "staff");
  staffToken = (await connect({ cookie: staff.cookie, scopes: ["catalogue:read"] })).access_token;
});

/** Products with names unique to each test. */
function batch(category = "Hoodies") {
  n += 1;
  return [
    {
      name: `Hoodie ${n}`,
      category,
      options: ["Size"],
      variants: [
        { optionValues: ["M"], price: "25", stock: 10, sku: `HD-${n}-M` },
        { optionValues: ["L"], price: "25", stock: 4, sku: `HD-${n}-L` },
      ],
    },
    { name: `عطر ${n}`, variants: [{ price: "45", stock: 7 }] },
  ];
}

async function ok(token: string, tool: string, args: Record<string, unknown>) {
  const res = await callTool(token, tool, args);
  if (!res.ok) throw new Error(`${tool} refused: ${res.error}`);
  return res.data;
}
const preview = async (token: string, products = batch()) => (await ok(token, "preview_product_import", { products })).importId as string;
const productsOf = (importId: string) => prisma.product.findMany({ where: { importId }, include: { variants: true }, orderBy: { name: "asc" } });

describe("confirming and undoing a product import", () => {
  it("creates every product live, with variants, stock, categories and dashboard links", async () => {
    const products = batch();
    const importId = await preview(ownerToken, products);
    const d = await ok(ownerToken, "confirm_product_import", { importId });
    expect(d.replayed).toBe(false);
    expect(d.categoriesCreated).toEqual(["Hoodies"]);
    expect(d.products.map((p: { name: string }) => p.name).sort()).toEqual([products[0].name, products[1].name].sort());
    expect(d.products[0].dashboardUrl).toMatch(/^http:\/\/localhost:3000\/dashboard\/products\//);

    const created = await productsOf(importId);
    expect(created.every((p) => p.status === "ACTIVE")).toBe(true);
    const hoodie = created.find((p) => p.name === products[0].name)!;
    const skus = products[0].variants.map((v) => (v as { sku: string }).sku);
    expect(hoodie.variants.map((v) => [v.optionValues, v.priceMinor, v.available, v.sku])).toEqual([
      [["M"], 2500n, 10, skus[0]],
      [["L"], 2500n, 4, skus[1]],
    ]);
    const category = await prisma.category.findFirstOrThrow({ where: { shopId: owner.shop.id, name: "Hoodies" } });
    expect(hoodie.categoryId).toBe(category.id);
    expect(await prisma.stockMovement.count({ where: { variantId: { in: hoodie.variants.map((v) => v.id) } } })).toBe(2);
    expect((await prisma.productImport.findUniqueOrThrow({ where: { id: importId } })).status).toBe("CONFIRMED");

    // In the dashboard and on the public catalogue at once.
    const dashboard = await call(listProducts, "/api/products", { cookie: owner.cookie });
    expect(dashboard.body.map((p: { name: string }) => p.name)).toEqual(expect.arrayContaining([products[0].name, products[1].name]));
    const catalogue = await call(publicCatalogue, `/api/public/shops/${owner.shop.slug}/catalogue`, {}, { slug: owner.shop.slug });
    expect(JSON.stringify(catalogue.body)).toContain(products[1].name);
  });

  it("returns the same products when confirmed again, and when confirmed twice at once", async () => {
    const importId = await preview(ownerToken);
    const [a, b, c] = await Promise.all([1, 2, 3].map(() => ok(ownerToken, "confirm_product_import", { importId })));
    expect([a, b, c].filter((r) => !r.replayed)).toHaveLength(1);
    const again = await ok(ownerToken, "confirm_product_import", { importId });
    expect(again.replayed).toBe(true);
    expect(again.products.map((p: { id: string }) => p.id).sort()).toEqual(a.products.map((p: { id: string }) => p.id).sort());
    expect(await productsOf(importId)).toHaveLength(2);
  });

  it("lets only the member who previewed it confirm it", async () => {
    const importId = await preview(ownerToken);
    expect(await callTool(managerToken, "confirm_product_import", { importId })).toEqual({ ok: false, error: "Import not found." });
    const stranger = await signUpOwner();
    const theirToken = (await connect({ cookie: stranger.cookie, scopes: ["catalogue:write"] })).access_token;
    expect((await callTool(theirToken, "confirm_product_import", { importId })).ok).toBe(false);
    expect(await productsOf(importId)).toHaveLength(0);
  });

  it("refuses a preview a newer one replaced", async () => {
    const first = await preview(ownerToken);
    await preview(ownerToken);
    const res = await callTool(ownerToken, "confirm_product_import", { importId: first });
    expect(res).toEqual({ ok: false, error: "A newer preview replaced this one. Confirm the latest preview." });
  });

  it("refuses an expired preview", async () => {
    const importId = await preview(ownerToken);
    await prisma.productImport.update({ where: { id: importId }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await callTool(ownerToken, "confirm_product_import", { importId })).toEqual({ ok: false, error: "This preview expired. Preview the products again." });
  });

  it("refuses when the shop changed since the preview, and keeps the preview", async () => {
    const products = batch();
    const importId = await preview(ownerToken, products);
    await seedVariant(owner.shop.id, { name: products[1].name, options: [], optionValues: [] });
    const res = await callTool(ownerToken, "confirm_product_import", { importId });
    expect(res).toEqual({ ok: false, error: "The shop changed since this preview. Preview the products again." });
    expect(await productsOf(importId)).toHaveLength(0);
    expect((await prisma.productImport.findUniqueOrThrow({ where: { id: importId } })).status).toBe("PREVIEWED");
  });

  it("creates nothing at all if one product fails half way", async () => {
    const products = batch("Rolled back category");
    const importId = await preview(ownerToken, products);
    // Corrupt the second product so its insert fails after the first one was written.
    const saved = await prisma.productImport.findUniqueOrThrow({ where: { id: importId } });
    const rows = saved.rows as { variants: { optionValues: string[] }[] }[];
    rows[1].variants = [rows[1].variants[0], rows[1].variants[0]];
    await prisma.productImport.update({ where: { id: importId }, data: { rows } });

    expect((await callTool(ownerToken, "confirm_product_import", { importId })).ok).toBe(false);
    expect(await productsOf(importId)).toHaveLength(0);
    expect(await prisma.product.count({ where: { shopId: owner.shop.id, name: products[0].name } })).toBe(0);
    expect(await prisma.category.count({ where: { shopId: owner.shop.id, name: "Rolled back category" } })).toBe(0);
    expect((await prisma.productImport.findUniqueOrThrow({ where: { id: importId } })).status).toBe("PREVIEWED");
  });

  it("undoes exactly the products of one import, once", async () => {
    const keep = await preview(ownerToken);
    await ok(ownerToken, "confirm_product_import", { importId: keep });
    const importId = await preview(ownerToken);
    await ok(ownerToken, "confirm_product_import", { importId });

    const d = await ok(ownerToken, "undo_product_import", { importId });
    expect(d).toEqual({ importId, archived: 2, alreadyUndone: false });
    expect((await productsOf(importId)).every((p) => p.status === "ARCHIVED")).toBe(true);
    expect((await productsOf(keep)).every((p) => p.status === "ACTIVE")).toBe(true);
    expect(await ok(ownerToken, "undo_product_import", { importId })).toEqual({ importId, archived: 0, alreadyUndone: true });
    expect(await callTool(ownerToken, "confirm_product_import", { importId })).toEqual({ ok: false, error: "This import was undone." });
  });

  it("lets a manager undo an owner's import, within 24 hours only", async () => {
    const importId = await preview(ownerToken);
    await ok(ownerToken, "confirm_product_import", { importId });
    await prisma.productImport.update({ where: { id: importId }, data: { confirmedAt: new Date(Date.now() - 25 * 60 * 60 * 1000) } });
    expect(await callTool(managerToken, "undo_product_import", { importId })).toEqual({
      ok: false,
      error: "An import can be undone within 24 hours.",
    });
    await prisma.productImport.update({ where: { id: importId }, data: { confirmedAt: new Date() } });
    expect((await ok(managerToken, "undo_product_import", { importId })).archived).toBe(2);
  });

  it("refuses to undo a preview that was never confirmed", async () => {
    const importId = await preview(ownerToken);
    expect(await callTool(ownerToken, "undo_product_import", { importId })).toEqual({ ok: false, error: "Only a confirmed import can be undone." });
  });

  it("keeps Arabic names exactly as written", async () => {
    const products = [{ name: "حقيبة يد جلد طبيعي", description: "صناعة لبنانية", variants: [{ price: "60", stock: 3 }] }];
    const importId = await preview(ownerToken, products);
    await ok(ownerToken, "confirm_product_import", { importId });
    const [p] = await productsOf(importId);
    expect([p.name, p.description]).toEqual(["حقيبة يد جلد طبيعي", "صناعة لبنانية"]);
  });

  it("is not available to staff", async () => {
    expect((await callTool(staffToken, "confirm_product_import", { importId: "x" })).ok).toBe(false);
    expect((await callTool(staffToken, "undo_product_import", { importId: "x" })).ok).toBe(false);
  });
});
