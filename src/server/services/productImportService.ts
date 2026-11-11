import { normalizeSearch } from "../domain/arabic";
import {
  IMPORT_PREVIEW_MINUTES,
  IMPORT_UNDO_HOURS,
  fromStored,
  planImport,
  toStored,
  type ImportRequestRow,
  type PlannedProduct,
  type StoredProduct,
} from "../domain/productImport";
import { MAX_CATEGORIES } from "../domain/storefront";
import type { Actor } from "../http/withRoute";
import { productImportRepo } from "../repositories/productImportRepo";
import { productRepo } from "../repositories/productRepo";
import { shopRepo } from "../repositories/shopRepo";
import { categoryRepo } from "../repositories/storefrontRepo";
import { transaction, type Db } from "../repositories/tx";
import { conflict, notFound, unprocessable } from "../http/errors";
import { appUrl } from "../mail/mailer";
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

/** Same check as the preview, against the shop as it is now: something may have been added in between. */
async function recheck(tx: Db, shopId: string, currency: "USD" | "LBP", products: PlannedProduct[]) {
  const [existing, categories] = await Promise.all([
    productRepo.list(shopId, { includeArchived: true }, tx),
    categoryRepo.list(shopId, tx),
  ]);
  const plan = planImport(
    products.map((p) => ({
      ...p,
      variants: p.variants.map((v) => ({ optionValues: v.optionValues, sku: v.sku, price: fromMinorText(v.priceMinor, currency), stock: v.available })),
      errors: [],
    })),
    {
      currency,
      existingNames: existing.map((p) => p.name),
      existingSkus: existing.flatMap((p) => p.variants.flatMap((v) => (v.sku ? [v.sku] : []))),
      existingCategories: categories.map((c) => c.name),
      maxCategories: MAX_CATEGORIES,
    },
  );
  const changed = plan.rows.filter((r) => r.status !== "ready");
  if (changed.length > 0) {
    throw conflict("IMPORT_STALE", "The shop changed since this preview. Preview the products again.", {
      rows: changed.map((r) => ({ name: r.name, problems: r.problems })),
    });
  }
  return { categories, newCategories: plan.newCategories };
}

const fromMinorText = (minor: bigint, currency: "USD" | "LBP") =>
  currency === "USD" ? `${minor / 100n}.${(minor % 100n).toString().padStart(2, "0")}` : minor.toString();

const created = (shopId: string, importId: string) =>
  productRepo.listByImport(shopId, importId).then((products) =>
    products.map((p) => ({ id: p.id, name: p.name, status: p.status, dashboardUrl: appUrl(`/dashboard/products/${p.id}`) })),
  );

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

  /**
   * Creates every product of the preview in one transaction, live in the
   * dashboard and the catalogue. Only the member who previewed it, before it
   * expires and while it is their latest preview. Confirming again returns
   * what the first confirm created.
   */
  async confirm(actor: Actor, importId: string) {
    const shop = await shopRepo.findById(actor.shopId);
    if (!shop) throw notFound("Shop");
    const result = await transaction(async (tx) => {
      const now = new Date();
      if (!(await productImportRepo.confirm(tx, actor.shopId, importId, actor.userId, now))) {
        const existing = await productImportRepo.findById(actor.shopId, importId, tx);
        if (!existing || existing.userId !== actor.userId) throw notFound("Import");
        if (existing.status === "CONFIRMED") return { replayed: true, categoriesCreated: [] as string[] };
        if (existing.status === "SUPERSEDED") throw conflict("IMPORT_REPLACED", "A newer preview replaced this one. Confirm the latest preview.");
        if (existing.status === "UNDONE") throw conflict("IMPORT_UNDONE", "This import was undone.");
        throw conflict("IMPORT_EXPIRED", "This preview expired. Preview the products again.");
      }
      const imp = (await productImportRepo.findById(actor.shopId, importId, tx))!;
      const products = fromStored(imp.rows as StoredProduct[]);
      const { categories, newCategories } = await recheck(tx, actor.shopId, shop.currency, products);
      const categoryIds = new Map(categories.map((c) => [normalizeSearch(c.name), c.id]));
      for (const name of newCategories) {
        const category = await categoryRepo.create(tx, actor.shopId, name, MAX_CATEGORIES);
        if (!category) throw unprocessable("CATEGORY_LIMIT", `A shop can have up to ${MAX_CATEGORIES} categories.`);
        categoryIds.set(normalizeSearch(name), category.id);
      }
      for (const p of products) {
        await productRepo.create(
          tx,
          actor.shopId,
          {
            name: p.name,
            description: p.description,
            options: p.options,
            variants: p.variants,
            categoryId: p.category ? (categoryIds.get(normalizeSearch(p.category)) ?? null) : null,
            importId,
          },
          actor.userId,
        );
      }
      return { replayed: false, categoriesCreated: newCategories };
    });
    const products = await created(actor.shopId, importId);
    return {
      importId,
      replayed: result.replayed,
      products,
      categoriesCreated: result.categoriesCreated,
      productsPage: appUrl("/dashboard/products"),
      undo: `undo_product_import with this importId archives these products within ${IMPORT_UNDO_HOURS} hours.`,
    };
  },

  /** Archives every product a confirmed import created, within 24 hours of confirming. Orders keep their items. */
  async undo(actor: Actor, importId: string) {
    const now = new Date();
    const since = new Date(now.getTime() - IMPORT_UNDO_HOURS * 60 * 60 * 1000);
    const archived = await transaction(async (tx) => {
      if (!(await productImportRepo.undo(tx, actor.shopId, importId, since, now))) {
        const existing = await productImportRepo.findById(actor.shopId, importId, tx);
        if (!existing) throw notFound("Import");
        if (existing.status === "UNDONE") return null;
        if (existing.status !== "CONFIRMED") throw conflict("IMPORT_NOT_CONFIRMED", "Only a confirmed import can be undone.");
        throw conflict("UNDO_EXPIRED", `An import can be undone within ${IMPORT_UNDO_HOURS} hours.`);
      }
      return (await productRepo.archiveByImport(tx, actor.shopId, importId)).count;
    });
    return { importId, archived: archived ?? 0, alreadyUndone: archived === null };
  },
};
