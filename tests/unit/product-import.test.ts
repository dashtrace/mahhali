import { describe, expect, it } from "vitest";
import { fromStored, planImport, toStored, type ImportRequestRow } from "@/server/domain/productImport";

const row = (over: Partial<ImportRequestRow> = {}): ImportRequestRow => ({
  name: "Black hoodie",
  description: null,
  category: null,
  options: ["Size"],
  variants: [
    { optionValues: ["M"], sku: null, price: "25", stock: 10 },
    { optionValues: ["L"], sku: null, price: "25.50", stock: 5 },
  ],
  errors: [],
  ...over,
});

const ctx = { currency: "USD" as const, existingNames: [], existingSkus: [], existingCategories: [], maxCategories: 30 };

describe("planning a product import", () => {
  it("prices variants in the shop's currency", () => {
    const plan = planImport([row()], ctx);
    expect(plan.rows).toEqual([{ row: 1, name: "Black hoodie", status: "ready", problems: [] }]);
    expect(plan.products[0].variants.map((v) => v.priceMinor)).toEqual([2500n, 2550n]);
  });

  it("refuses pound amounts with decimals", () => {
    const plan = planImport([row({ variants: [{ optionValues: ["M"], sku: null, price: "25.50", stock: 1 }] })], { ...ctx, currency: "LBP" });
    expect(plan.rows[0].status).toBe("error");
    expect(plan.rows[0].problems[0]).toContain("whole pounds");
    expect(plan.products).toEqual([]);
  });

  it("skips products whose name already exists, however the Arabic is spelled", () => {
    const plan = planImport([row({ name: "حقيبة جلد" }), row({ name: "Shirt" })], { ...ctx, existingNames: ["حقيبه جلد"] });
    expect(plan.rows.map((r) => r.status)).toEqual(["duplicate", "ready"]);
    expect(plan.products.map((p) => p.name)).toEqual(["Shirt"]);
  });

  it("skips the second of two rows with the same name", () => {
    const plan = planImport([row(), row({ name: "black HOODIE" })], ctx);
    expect(plan.rows.map((r) => r.status)).toEqual(["ready", "duplicate"]);
  });

  it("refuses a SKU already used in the shop or earlier in the batch", () => {
    const withSku = (name: string, sku: string) => row({ name, options: [], variants: [{ optionValues: [], sku, price: "5", stock: 1 }] });
    const plan = planImport([withSku("A", "SKU-1"), withSku("B", "sku-1"), withSku("C", "OLD")], { ...ctx, existingSkus: ["OLD"] });
    expect(plan.rows.map((r) => r.status)).toEqual(["ready", "error", "error"]);
  });

  it("keeps schema problems found earlier", () => {
    const plan = planImport([row({ errors: ["Give each variant one value per option"] })], ctx);
    expect(plan.rows[0]).toMatchObject({ status: "error", problems: ["Give each variant one value per option"] });
  });

  it("lists new categories once and reuses existing ones", () => {
    const plan = planImport(
      [row({ name: "A", category: "Hoodies" }), row({ name: "B", category: "hoodies" }), row({ name: "C", category: "عطور" })],
      { ...ctx, existingCategories: ["عطور"] },
    );
    expect(plan.newCategories).toEqual(["Hoodies"]);
    expect(plan.products.map((p) => p.category)).toEqual(["Hoodies", "Hoodies", "عطور"]);
  });

  it("refuses rows that would need a category past the shop's limit", () => {
    const plan = planImport([row({ name: "A", category: "New" })], { ...ctx, existingCategories: ["x", "y"], maxCategories: 2 });
    expect(plan.rows[0].status).toBe("error");
  });

  it("stores prices as strings and reads them back as bigint", () => {
    const products = planImport([row()], ctx).products;
    expect(JSON.parse(JSON.stringify(toStored(products)))[0].variants[0].priceMinor).toBe("2500");
    expect(fromStored(toStored(products))).toEqual(products);
  });
});
