import { badRequest, notFound, unprocessable } from "../http/errors";
import type { Actor } from "../http/withRoute";
import { toMinor, type Currency } from "../domain/money";
import { productRepo } from "../repositories/productRepo";
import { shopRepo } from "../repositories/shopRepo";
import { isUniqueViolation, transaction } from "../repositories/tx";
import { deleteUpload, saveUpload } from "../storage/uploads";
import {
  ImageFields,
  type CreateProductInput,
  type StockAdjustmentInput,
  type UpdateProductInput,
  type UpdateVariantInput,
  type VariantInput,
} from "../validation/product";

const duplicateVariant = () => unprocessable("DUPLICATE_VARIANT", "Each size and colour combination can appear once.");

function priceMinor(amount: string, currency: Currency) {
  try {
    return toMinor(amount, currency);
  } catch {
    // e.g. "12.50" for a shop that prices in whole pounds
    throw unprocessable("INVALID_PRICE", `Prices must be whole ${currency === "LBP" ? "pounds" : "amounts with up to two decimals"}.`);
  }
}

async function currencyOf(actor: Actor) {
  const shop = await shopRepo.findById(actor.shopId);
  if (!shop) throw notFound("Shop");
  return shop.currency;
}

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
    const currency = await currencyOf(actor);
    const variants = input.variants.map((v) => ({
      size: v.size,
      colour: v.colour,
      sku: v.sku,
      priceMinor: priceMinor(v.price, currency),
      available: v.stock,
    }));
    try {
      return await transaction((tx) =>
        productRepo.create(tx, actor.shopId, { name: input.name, description: input.description ?? null, variants }, actor.userId),
      );
    } catch (error) {
      if (isUniqueViolation(error)) throw duplicateVariant();
      throw error;
    }
  },

  async update(actor: Actor, id: string, input: UpdateProductInput) {
    const updated = await productRepo.update(actor.shopId, id, input);
    if (!updated) throw notFound("Product");
    return this.get(actor, id);
  },

  /** "Deleting" a product archives it: old orders still point at its variants. */
  archive(actor: Actor, id: string) {
    return this.update(actor, id, { status: "ARCHIVED" });
  },

  async addVariant(actor: Actor, productId: string, input: VariantInput) {
    const product = await this.get(actor, productId);
    // Checked here too because Postgres treats two empty sizes as different.
    if (product.variants.some((v) => v.size === input.size && v.colour === input.colour)) throw duplicateVariant();
    const variant = {
      size: input.size,
      colour: input.colour,
      sku: input.sku,
      priceMinor: priceMinor(input.price, await currencyOf(actor)),
      available: input.stock,
    };
    try {
      return await transaction((tx) => productRepo.addVariant(tx, actor.shopId, productId, variant, actor.userId));
    } catch (error) {
      if (isUniqueViolation(error)) throw duplicateVariant();
      throw error;
    }
  },

  async updateVariant(actor: Actor, id: string, input: UpdateVariantInput) {
    const variant = await productRepo.findVariant(actor.shopId, id);
    if (!variant) throw notFound("Variant");
    const size = input.size === undefined ? variant.size : input.size;
    const colour = input.colour === undefined ? variant.colour : input.colour;
    if (variant.product.variants.some((v) => v.id !== id && v.size === size && v.colour === colour)) throw duplicateVariant();
    const { price, ...rest } = input;
    try {
      const updated = await productRepo.updateVariant(actor.shopId, id, {
        ...rest,
        ...(price === undefined ? {} : { priceMinor: priceMinor(price, await currencyOf(actor)) }),
      });
      if (!updated) throw notFound("Variant");
      return updated;
    } catch (error) {
      if (isUniqueViolation(error)) throw duplicateVariant();
      throw error;
    }
  },

  async adjustStock(actor: Actor, id: string, input: StockAdjustmentInput) {
    if (!(await productRepo.findVariant(actor.shopId, id))) throw notFound("Variant");
    const updated = await transaction((tx) => productRepo.adjustStock(tx, actor.shopId, id, input.delta, input.note, actor.userId));
    if (!updated) throw unprocessable("STOCK_NEGATIVE", "Stock cannot go below zero.");
    return updated;
  },

  async movements(actor: Actor, id: string) {
    if (!(await productRepo.findVariant(actor.shopId, id))) throw notFound("Variant");
    return productRepo.movements(actor.shopId, id);
  },

  async addImage(actor: Actor, productId: string, form: FormData) {
    await this.get(actor, productId);
    const fields = ImageFields.safeParse({ colour: form.get("colour") ?? undefined });
    if (!fields.success) {
      throw badRequest("Invalid form", fields.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
    }
    const url = await saveUpload(actor.shopId, form.get("file"), "photo");
    try {
      return await productRepo.addImage(actor.shopId, productId, { url, colour: fields.data.colour });
    } catch (error) {
      await deleteUpload(actor.shopId, url);
      throw error;
    }
  },

  async deleteImage(actor: Actor, productId: string, imageId: string) {
    const image = await productRepo.findImage(actor.shopId, productId, imageId);
    if (!image) throw notFound("Image");
    await productRepo.deleteImage(actor.shopId, image.id);
    await deleteUpload(actor.shopId, image.url);
  },
};

export const catalogueService = {
  async forShop(slug: string) {
    const shop = await shopRepo.findBySlug(slug);
    if (!shop || shop.suspended) throw notFound("Shop");
    const products = await productRepo.catalogue(shop.id);
    return {
      shop: {
        name: shop.name,
        slug: shop.slug,
        logo: shop.logo,
        currency: shop.currency,
        theme: shop.theme,
        language: shop.language,
        whatsappPhone: shop.whatsappPhone,
        deliveryFeeMinor: shop.deliveryFeeMinor,
      },
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
