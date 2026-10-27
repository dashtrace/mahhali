import { MAX_CATEGORIES, MAX_SLIDES, moveTo } from "../domain/storefront";
import { badRequest, notFound, unprocessable } from "../http/errors";
import { rateLimit } from "../http/rateLimit";
import type { Actor } from "../http/withRoute";
import { shopRepo } from "../repositories/shopRepo";
import { categoryRepo, slideRepo, testimonialRepo } from "../repositories/storefrontRepo";
import { isUniqueViolation, transaction } from "../repositories/tx";
import { deleteUpload, saveUpload } from "../storage/uploads";
import {
  SlideFields,
  type StorefrontInput,
  type TestimonialInput,
  type TestimonialStatusValue,
  type UpdateCategoryInput,
  type UpdateSlideInput,
} from "../validation/storefront";

type Shop = NonNullable<Awaited<ReturnType<typeof shopRepo.findById>>>;

function storefrontOf(shop: Shop) {
  return {
    tagline: shop.tagline,
    about: shop.about,
    shippingInfo: shop.shippingInfo,
    instagramUrl: shop.instagramUrl,
    facebookUrl: shop.facebookUrl,
    logoMode: shop.logoMode,
    homeSection: shop.homeSection,
    showTestimonials: shop.showTestimonials,
  };
}

// Storefront copy, links, layout and hero slides: owner only (shop.settings).
export const storefrontService = {
  async settings(actor: Actor) {
    const shop = await shopRepo.findById(actor.shopId);
    if (!shop) throw notFound("Shop");
    return storefrontOf(shop);
  },

  async update(actor: Actor, input: StorefrontInput) {
    return storefrontOf(await shopRepo.update(actor.shopId, input));
  },

  slides(actor: Actor) {
    return slideRepo.list(actor.shopId);
  },

  /** Multipart: `file` (PNG, JPEG or WebP up to 3 MB) plus kicker, title and body. */
  async addSlide(actor: Actor, form: FormData) {
    const text = (k: string) => (typeof form.get(k) === "string" ? form.get(k) : undefined);
    const fields = SlideFields.safeParse({ kicker: text("kicker"), title: text("title"), body: text("body") });
    if (!fields.success) {
      throw badRequest("Invalid form", fields.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
    }
    const imageUrl = await saveUpload(actor.shopId, form.get("file"), "photo");
    try {
      const slide = await transaction((tx) => slideRepo.create(tx, actor.shopId, { imageUrl, ...fields.data }, MAX_SLIDES));
      if (!slide) throw unprocessable("SLIDE_LIMIT", `A shop can have up to ${MAX_SLIDES} slides.`, { max: MAX_SLIDES });
      return slide;
    } catch (error) {
      await deleteUpload(actor.shopId, imageUrl);
      throw error;
    }
  },

  /** Text changes, and a move to `position` that shifts the other slides. */
  async updateSlide(actor: Actor, id: string, input: UpdateSlideInput) {
    const { position, ...text } = input;
    await transaction(async (tx) => {
      if (!(await slideRepo.findById(actor.shopId, id, tx))) throw notFound("Slide");
      await slideRepo.update(actor.shopId, id, text, tx);
      if (position !== undefined) {
        const ids = (await slideRepo.list(actor.shopId, tx)).map((s) => s.id);
        await slideRepo.setOrder(tx, actor.shopId, moveTo(ids, id, position));
      }
    });
    return (await slideRepo.findById(actor.shopId, id))!;
  },

  async deleteSlide(actor: Actor, id: string) {
    const slide = await slideRepo.findById(actor.shopId, id);
    if (!slide || !(await slideRepo.delete(actor.shopId, id))) throw notFound("Slide");
    await deleteUpload(actor.shopId, slide.imageUrl);
  },
};

const duplicateCategory = () => unprocessable("DUPLICATE_CATEGORY", "A category with this name already exists.");

// Read with product.read, change with product.write.
export const categoryService = {
  list(actor: Actor) {
    return categoryRepo.list(actor.shopId);
  },

  async create(actor: Actor, name: string) {
    try {
      const category = await transaction((tx) => categoryRepo.create(tx, actor.shopId, name, MAX_CATEGORIES));
      if (!category) throw unprocessable("CATEGORY_LIMIT", `A shop can have up to ${MAX_CATEGORIES} categories.`, { max: MAX_CATEGORIES });
      return category;
    } catch (error) {
      if (isUniqueViolation(error)) throw duplicateCategory();
      throw error;
    }
  },

  async update(actor: Actor, id: string, input: UpdateCategoryInput) {
    try {
      await transaction(async (tx) => {
        if (!(await categoryRepo.findById(actor.shopId, id, tx))) throw notFound("Category");
        if (input.name !== undefined) await categoryRepo.rename(actor.shopId, id, input.name, tx);
        if (input.position !== undefined) {
          const ids = (await categoryRepo.list(actor.shopId, tx)).map((c) => c.id);
          await categoryRepo.setOrder(tx, actor.shopId, moveTo(ids, id, input.position));
        }
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw duplicateCategory();
      throw error;
    }
    return (await categoryRepo.findById(actor.shopId, id))!;
  },

  async delete(actor: Actor, id: string) {
    if (!(await categoryRepo.delete(actor.shopId, id))) throw notFound("Category");
  },
};

const MINUTE = 60_000;

export const testimonialService = {
  /** Public: shop feedback the customer agreed to show. It waits for the shop's approval. */
  async submit(slug: string, input: TestimonialInput, ip: string) {
    rateLimit(`testimonial:${ip}`, 5, 10 * MINUTE);
    const shop = await shopRepo.findBySlug(slug);
    if (!shop || shop.suspended) throw notFound("Shop");
    const { status } = await testimonialRepo.create(shop.id, { authorName: input.authorName, message: input.message });
    return { status };
  },

  list(actor: Actor, status: TestimonialStatusValue | undefined) {
    return testimonialRepo.list(actor.shopId, status);
  },

  async moderate(actor: Actor, id: string, status: "APPROVED" | "REJECTED") {
    const updated = await testimonialRepo.setStatus(actor.shopId, id, { status, moderatedById: actor.userId });
    if (!updated) throw notFound("Testimonial");
    return updated;
  },
};
