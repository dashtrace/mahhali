import { badRequest, conflict, notFound, unprocessable } from "../http/errors";
import type { Actor } from "../http/withRoute";
import { toMinor, type Currency } from "../domain/money";
import { browseProducts, type BrowseOptions, type HomeSection, type LogoMode } from "../domain/storefront";
import { remapValues } from "../domain/variants";
import { productRepo } from "../repositories/productRepo";
import { shopRepo } from "../repositories/shopRepo";
import { categoryRepo, slideRepo, testimonialRepo } from "../repositories/storefrontRepo";
import { isUniqueViolation, transaction } from "../repositories/tx";
import { deleteUpload, saveUpload } from "../storage/uploads";
import {
  ImageFields,
  type CreateProductInput,
  type ProductSpec,
  type SetOptionsInput,
  type StockAdjustmentInput,
  type UpdateProductInput,
  type UpdateVariantInput,
  type VariantInput,
} from "../validation/product";

const duplicateVariant = () => unprocessable("DUPLICATE_VARIANT", "Each combination of option values can appear once.");

/** A variant holds one value per product option. */
function checkValues(values: string[] | undefined, options: string[]) {
  if (values !== undefined && values.length !== options.length) {
    throw unprocessable("OPTION_VALUES_MISMATCH", `Give one value for each option (${options.length}).`);
  }
}

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

/** A product may only be filed under a category of its own shop. */
async function checkCategory(actor: Actor, categoryId: string | null | undefined) {
  if (categoryId && !(await categoryRepo.findById(actor.shopId, categoryId))) throw notFound("Category");
}

export const productService = {
  /** Lets the products page poll cheaply and reload only when something changed. */
  async version(actor: Actor) {
    return { version: await productRepo.version(actor.shopId) };
  },

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
    await checkCategory(actor, input.categoryId);
    const { variants: lines, description, ...fields } = input;
    const variants = lines.map((v) => ({
      optionValues: v.optionValues,
      sku: v.sku,
      priceMinor: priceMinor(v.price, currency),
      available: v.stock,
    }));
    try {
      return await transaction((tx) =>
        productRepo.create(tx, actor.shopId, { ...fields, description: description ?? null, variants }, actor.userId),
      );
    } catch (error) {
      if (isUniqueViolation(error)) throw duplicateVariant();
      throw error;
    }
  },

  async update(actor: Actor, id: string, input: Partial<UpdateProductInput>) {
    await checkCategory(actor, input.categoryId);
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
    checkValues(input.optionValues, product.options);
    const variant = {
      optionValues: input.optionValues,
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

  /** Renames, adds, removes or reorders options; every variant, hidden ones too, keeps its values in step. */
  async setOptions(actor: Actor, productId: string, input: SetOptionsInput) {
    try {
      // shortcut: no row lock, so a variant added in the same instant keeps the old value count; lock the product row if that shows up.
      await transaction(async (tx) => {
        const product = await productRepo.findById(actor.shopId, productId, tx);
        if (!product) throw notFound("Product");
        const from = input.options.map((o) => {
          if (o.from === null) return null;
          const i = product.options.indexOf(o.from);
          if (i < 0) throw conflict("OPTIONS_CHANGED", "The options changed since you opened them. Reload and try again.");
          return i;
        });
        // A rename alone leaves every value where it is.
        const moved = from.length !== product.options.length || from.some((f, i) => f !== i);
        const variants = moved ? product.variants.map((v) => ({ id: v.id, optionValues: remapValues(v.optionValues, from) })) : [];
        await productRepo.setOptions(tx, actor.shopId, productId, input.options.map((o) => o.name), variants);
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw unprocessable("DUPLICATE_VARIANT", "Two variants would end up the same (hidden ones count too). Change or remove one first.");
      }
      throw error;
    }
    return this.get(actor, productId);
  },

  async updateVariant(actor: Actor, id: string, input: UpdateVariantInput) {
    const variant = await productRepo.findVariant(actor.shopId, id);
    if (!variant) throw notFound("Variant");
    checkValues(input.optionValues, variant.product.options);
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
    const fields = ImageFields.safeParse({ optionValue: form.get("optionValue") ?? undefined });
    if (!fields.success) {
      throw badRequest("Invalid form", fields.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
    }
    const url = await saveUpload(actor.shopId, form.get("file"), "photo");
    try {
      return await productRepo.addImage(actor.shopId, productId, { url, optionValue: fields.data.optionValue });
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

async function publicShop(slug: string) {
  const shop = await shopRepo.findBySlug(slug);
  if (!shop || shop.suspended) throw notFound("Shop");
  return shop;
}

/** The public product list with sales counts and category names, newest first. */
async function publicProducts(shopId: string) {
  const [products, sold, categories] = await Promise.all([
    productRepo.catalogue(shopId),
    productRepo.soldCounts(shopId),
    categoryRepo.list(shopId),
  ]);
  const names = new Map(categories.map((c) => [c.id, c.name]));
  return {
    categories,
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      categoryId: p.categoryId,
      categoryName: p.categoryId ? (names.get(p.categoryId) ?? null) : null,
      featured: p.featured,
      specs: (p.specs as ProductSpec[] | null) ?? [],
      customization: p.customLabel
        ? { label: p.customLabel, placeholder: p.customPlaceholder, required: p.customRequired, maxLength: p.customMaxLength }
        : null,
      soldCount: sold.get(p.id) ?? 0,
      createdAt: p.createdAt.toISOString(),
      rating: { average: Number(p.ratingAvg), count: p.ratingCount },
      options: p.options,
      images: p.images.map((i) => ({ url: i.url, optionValue: i.optionValue })),
      // Customers see how many are left only up to the per-order cap (20), so larger stock stays private.
      variants: p.variants.map((v) => ({
        id: v.id,
        optionValues: v.optionValues,
        priceMinor: v.priceMinor,
        inStock: v.available > 0,
        left: Math.min(v.available, 20),
      })),
    })),
  };
}

export type CatalogueProduct = Awaited<ReturnType<typeof publicProducts>>["products"][number];

export const catalogueService = {
  async forShop(slug: string) {
    const shop = await publicShop(slug);
    const [{ products, categories }, slides, testimonials] = await Promise.all([
      publicProducts(shop.id),
      slideRepo.list(shop.id),
      shop.showTestimonials ? testimonialRepo.approved(shop.id, 12) : [],
    ]);
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
        tagline: shop.tagline,
        about: shop.about,
        shippingInfo: shop.shippingInfo,
        instagramUrl: shop.instagramUrl,
        facebookUrl: shop.facebookUrl,
        logoMode: shop.logoMode as LogoMode,
        homeSection: shop.homeSection as HomeSection,
        homeCategoryId: shop.homeCategoryId,
        showTestimonials: shop.showTestimonials,
        slides: slides.map((s) => ({ id: s.id, imageUrl: s.imageUrl, kicker: s.kicker, title: s.title, body: s.body })),
        categories: categories.map((c) => ({
          id: c.id,
          name: c.name,
          productCount: products.filter((p) => p.categoryId === c.id).length,
        })),
      },
      products,
      testimonials: testimonials.map((t) => ({ ...t, createdAt: t.createdAt.toISOString() })),
    };
  },

  /** The shop listing page: search, category, collection, price range and one page of results. */
  async browse(slug: string, opts: BrowseOptions = {}) {
    const shop = await publicShop(slug);
    return browseProducts((await publicProducts(shop.id)).products, opts);
  },
};
