import { notFound, unprocessable } from "../http/errors";
import type { Actor } from "../http/withRoute";
import { toMinor } from "../domain/money";
import { productRepo } from "../repositories/productRepo";
import { shopRepo } from "../repositories/shopRepo";
import { isUniqueViolation, transaction } from "../repositories/tx";
import type { CreateProductInput, UpdateProductInput } from "../validation/product";

export const productService = {
  list(actor: Actor, opts: { includeArchived: boolean }) {
    return productRepo.list(actor.shopId, opts);
  },

  async get(actor: Actor, id: string) {
    const product = await productRepo.findById(actor.shopId, id);
    if (!product) throw notFound("Product");
    return product;
  },

  async create(actor: Actor, input: CreateProductInput) {
    const shop = await shopRepo.findById(actor.shopId);
    if (!shop) throw notFound("Shop");
    let variants;
    try {
      variants = input.variants.map((v) => ({
        size: v.size,
        colour: v.colour,
        sku: v.sku,
        priceMinor: toMinor(v.price, shop.currency),
        available: v.stock,
      }));
    } catch {
      // e.g. "12.50" for a shop that prices in whole pounds
      throw unprocessable("INVALID_PRICE", `Prices must be whole ${shop.currency === "LBP" ? "pounds" : "amounts with up to two decimals"}.`);
    }
    try {
      return await transaction((tx) =>
        productRepo.create(tx, actor.shopId, { name: input.name, description: input.description ?? null, variants }, actor.userId),
      );
    } catch (error) {
      if (isUniqueViolation(error)) throw unprocessable("DUPLICATE_VARIANT", "Each size and colour combination can appear once.");
      throw error;
    }
  },

  async update(actor: Actor, id: string, input: UpdateProductInput) {
    const updated = await productRepo.update(actor.shopId, id, input);
    if (!updated) throw notFound("Product");
    return this.get(actor, id);
  },
};

export const catalogueService = {
  async forShop(slug: string) {
    const shop = await shopRepo.findBySlug(slug);
    if (!shop || shop.suspended) throw notFound("Shop");
    const products = await productRepo.catalogue(shop.id);
    return {
      shop: { name: shop.name, slug: shop.slug, logo: shop.logo, currency: shop.currency, theme: shop.theme },
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        rating: { average: Number(p.ratingAvg), count: p.ratingCount },
        images: p.images.map((i) => ({ url: i.url, colour: i.colour })),
        // Customers see whether a variant can be ordered, not the stock count.
        variants: p.variants.map((v) => ({
          id: v.id,
          size: v.size,
          colour: v.colour,
          priceMinor: v.priceMinor,
          inStock: v.available > 0,
        })),
      })),
    };
  },
};
