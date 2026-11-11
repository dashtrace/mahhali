import {
  IMPORT_PREVIEW_MINUTES,
  planImport,
  toStored,
  type ImportRequestRow,
  type PlannedProduct,
} from "../domain/productImport";
import { MAX_CATEGORIES } from "../domain/storefront";
import type { Actor } from "../http/withRoute";
import { productImportRepo } from "../repositories/productImportRepo";
import { productRepo } from "../repositories/productRepo";
import { shopRepo } from "../repositories/shopRepo";
import { categoryRepo } from "../repositories/storefrontRepo";
import { transaction } from "../repositories/tx";
import { notFound } from "../http/errors";
import type { PreviewImportToolInput } from "../validation/mcp";
import { CreateProductBody } from "../validation/product";
import { money } from "./assistantService";

type ImportSource = "MCP" | "DASHBOARD";

// Bulk product import: preview (nothing created), confirm (all or nothing),
// undo (archive what was created). The AI assistant shows the preview to the
// user and confirms only when they say so; the dashboard CSV upload uses the
// same steps.

/** Each row through the same schema as a product created in the dashboard. */
function checkRows(products: PreviewImportToolInput["products"]): ImportRequestRow[] {
  return products.map((p) => {
    const row = {
      name: p.name.trim(),
      description: p.description?.trim() || null,
      category: p.category?.trim() || null,
      options: (p.options ?? []).map((o) => o.trim()),
      variants: p.variants.map((v) => ({
        optionValues: (v.optionValues ?? []).map((o) => o.trim()),
        sku: v.sku?.trim() || null,
        price: String(v.price).trim(),
        stock: v.stock ?? 0,
      })),
    };
    const parsed = CreateProductBody.safeParse({ ...row, categoryId: undefined });
    const errors = parsed.success
      ? []
      : parsed.error.issues.map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message));
    return { ...row, errors };
  });
}

function preview(p: PlannedProduct, currency: "USD" | "LBP") {
  return {
    name: p.name,
    category: p.category,
    options: p.options,
    variants: p.variants.map((v) => ({ options: v.optionValues, sku: v.sku, price: money(v.priceMinor, currency), stock: v.available })),
  };
}

export const productImportService = {
  /**
   * Checks the products and saves them as a preview the user must confirm
   * within 15 minutes. Creates no products. A newer preview replaces the
   * user's previous one, which can then no longer be confirmed.
   */
  async preview(actor: Actor, input: PreviewImportToolInput, source: ImportSource) {
    const shop = await shopRepo.findById(actor.shopId);
    if (!shop) throw notFound("Shop");
    const [existing, categories] = await Promise.all([
      productRepo.list(actor.shopId, { includeArchived: true }),
      categoryRepo.list(actor.shopId),
    ]);
    const plan = planImport(checkRows(input.products), {
      currency: shop.currency,
      existingNames: existing.map((p) => p.name),
      existingSkus: existing.flatMap((p) => p.variants.flatMap((v) => (v.sku ? [v.sku] : []))),
      existingCategories: categories.map((c) => c.name),
      maxCategories: MAX_CATEGORIES,
    });

    const byName = new Map(plan.products.map((p) => [p.name, p]));
    const rows = plan.rows.map((r) => {
      const product = r.status === "ready" ? byName.get(r.name) : undefined;
      return { ...r, ...(product ? { product: preview(product, shop.currency) } : {}) };
    });
    const variantCount = plan.products.reduce((n, p) => n + p.variants.length, 0);
    const summary = {
      ready: plan.products.length,
      variants: variantCount,
      duplicates: plan.rows.filter((r) => r.status === "duplicate").length,
      errors: plan.rows.filter((r) => r.status === "error").length,
      newCategories: plan.newCategories,
    };

    let saved: { id: string; expiresAt: Date } | null = null;
    if (plan.products.length > 0) {
      const expiresAt = new Date(Date.now() + IMPORT_PREVIEW_MINUTES * 60_000);
      saved = await transaction(async (tx) => {
        await productImportRepo.supersedePreviews(tx, actor.shopId, actor.userId);
        return productImportRepo.create(tx, {
          shopId: actor.shopId,
          userId: actor.userId,
          source,
          rows: toStored(plan.products),
          report: { summary, rows: plan.rows, newCategories: plan.newCategories },
          productCount: plan.products.length,
          variantCount,
          expiresAt,
        });
      });
    }
    return {
      importId: saved?.id ?? null,
      expiresAt: saved?.expiresAt ?? null,
      currency: shop.currency,
      summary,
      rows,
      next: saved
        ? "Show the user every ready product with its variants, prices and stock, and the skipped or failed rows. Call confirm_product_import with this importId only after they confirm."
        : "Nothing can be imported: show the user the problems so they can fix them.",
    };
  },
};
