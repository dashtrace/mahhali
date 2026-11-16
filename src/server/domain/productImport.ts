// Bulk product import (from a CSV, a typed or a spoken request, via an AI
// assistant or the dashboard): which rows can be created, which are
// duplicates, and which have problems. Nothing here touches the database.
import { normalizeSearch } from "./arabic";
import { toMinor, type Currency } from "./money";

export const IMPORT_MAX_PRODUCTS = 100;
export const IMPORT_PREVIEW_MINUTES = 15;
export const IMPORT_UNDO_HOURS = 24;

/** One requested product, already checked against the product schema (errors holds what it found). */
export type ImportRequestRow = {
  name: string;
  description: string | null;
  category: string | null;
  options: string[];
  variants: { optionValues: string[]; sku: string | null; price: string; stock: number }[];
  errors: string[];
};

export type PlannedVariant = { optionValues: string[]; sku: string | null; priceMinor: bigint; available: number };
export type PlannedProduct = {
  name: string;
  description: string | null;
  category: string | null;
  options: string[];
  variants: PlannedVariant[];
  /** Photos downloaded at preview time, attached on confirm. */
  photos?: ImportPhoto[];
};

export type ImportPhoto = { url: string; optionValue: string | null };

export type ImportRowReport = {
  row: number;
  name: string;
  status: "ready" | "duplicate" | "error";
  problems: string[];
};

export type ImportPlan = {
  rows: ImportRowReport[];
  products: PlannedProduct[];
  /** Categories that will be created, as the user wrote them. */
  newCategories: string[];
};

type Context = {
  currency: Currency;
  existingNames: string[];
  existingSkus: string[];
  existingCategories: string[];
  maxCategories: number;
};

const key = (s: string) => normalizeSearch(s);

export function planImport(rows: ImportRequestRow[], ctx: Context): ImportPlan {
  const names = new Set(ctx.existingNames.map(key));
  const skus = new Set(ctx.existingSkus.map(key));
  const categories = new Map(ctx.existingCategories.map((c) => [key(c), c]));
  const newCategories = new Map<string, string>();
  const report: ImportRowReport[] = [];
  const products: PlannedProduct[] = [];

  rows.forEach((r, i) => {
    const row = i + 1;
    const problems = [...r.errors];
    const variants: PlannedVariant[] = [];
    if (problems.length === 0) {
      for (const v of r.variants) {
        let priceMinor: bigint;
        try {
          priceMinor = toMinor(v.price, ctx.currency);
        } catch {
          problems.push(`Price "${v.price}" is not valid in ${ctx.currency}${ctx.currency === "LBP" ? " (whole pounds only)" : ""}.`);
          continue;
        }
        if (v.sku && skus.has(key(v.sku))) problems.push(`SKU ${v.sku} is already used.`);
        variants.push({ optionValues: v.optionValues, sku: v.sku, priceMinor, available: v.stock });
      }
    }
    if (problems.length > 0) {
      report.push({ row, name: r.name, status: "error", problems });
      return;
    }
    if (names.has(key(r.name))) {
      report.push({ row, name: r.name, status: "duplicate", problems: ["A product with this name already exists; it will be skipped."] });
      return;
    }
    if (r.category && !categories.has(key(r.category)) && !newCategories.has(key(r.category))) {
      if (categories.size + newCategories.size >= ctx.maxCategories) {
        report.push({ row, name: r.name, status: "error", problems: [`A shop can have up to ${ctx.maxCategories} categories.`] });
        return;
      }
      newCategories.set(key(r.category), r.category);
    }
    names.add(key(r.name));
    for (const v of variants) if (v.sku) skus.add(key(v.sku));
    const category = r.category ? (categories.get(key(r.category)) ?? newCategories.get(key(r.category)) ?? r.category) : null;
    products.push({ name: r.name, description: r.description, category, options: r.options, variants });
    report.push({ row, name: r.name, status: "ready", problems: [] });
  });

  return { rows: report, products, newCategories: [...newCategories.values()] };
}

/** Stored as JSON between preview and confirm: bigint prices travel as strings. */
export type StoredProduct = Omit<PlannedProduct, "variants"> & { variants: (Omit<PlannedVariant, "priceMinor"> & { priceMinor: string })[] };

export function toStored(products: PlannedProduct[]): StoredProduct[] {
  return products.map((p) => ({ ...p, variants: p.variants.map((v) => ({ ...v, priceMinor: v.priceMinor.toString() })) }));
}

export function fromStored(products: StoredProduct[]): PlannedProduct[] {
  return products.map((p) => ({ ...p, variants: p.variants.map((v) => ({ ...v, priceMinor: BigInt(v.priceMinor) })) }));
}
