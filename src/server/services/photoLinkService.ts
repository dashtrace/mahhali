import { matchColour, photosLeft, PHOTOS_PER_PRODUCT } from "../domain/photoLinks";
import { hashToken, randomToken } from "../domain/tokens";
import { conflict, notFound, unprocessable } from "../http/errors";
import { rateLimit } from "../http/rateLimit";
import type { Actor } from "../http/withRoute";
import { appUrl } from "../mail/mailer";
import { photoLinkRepo } from "../repositories/photoLinkRepo";
import { productImportRepo } from "../repositories/productImportRepo";
import { productRepo } from "../repositories/productRepo";
import { transaction } from "../repositories/tx";
import { deleteUpload, saveUpload } from "../storage/uploads";

// "Add photos" links: AI assistants can't pass image files to a tool, so after
// an import is confirmed the user gets a no-login page where they pick photos
// from their phone. The link is the key: it works for 24 hours, only for that
// import's products, and only adds photos (deleting stays in the dashboard).

export const PHOTO_LINK_HOURS = 24;
const LIMITS = {
  viewPerIp: { calls: 120, windowMs: 10 * 60_000 },
  uploadPerLink: { calls: 40, windowMs: 10 * 60_000 },
  uploadPerIp: { calls: 60, windowMs: 10 * 60_000 },
};

/** The link behind a token, while it may still be used; 404 otherwise, whatever the reason. */
async function usableLink(token: string) {
  const link = await photoLinkRepo.findByTokenHash(hashToken(token));
  if (!link || link.expiresAt <= new Date() || link.import.status !== "CONFIRMED" || link.shop.suspended) throw notFound("Link");
  return link;
}

const colours = (variants: { optionValues: string[] }[]) => [...new Set(variants.flatMap((v) => v.optionValues))];

export const photoLinkService = {
  /** A fresh link for a confirmed import the member made themselves; the previous link stops working. */
  async create(actor: Actor, importId: string) {
    const imp = await productImportRepo.findById(actor.shopId, importId);
    if (!imp || imp.userId !== actor.userId) throw notFound("Import");
    if (imp.status !== "CONFIRMED") throw conflict("IMPORT_NOT_CONFIRMED", "Photos can be added once the import is confirmed and not undone.");
    const token = randomToken(24);
    const expiresAt = new Date(Date.now() + PHOTO_LINK_HOURS * 60 * 60 * 1000);
    await photoLinkRepo.replace(actor.shopId, importId, actor.userId, hashToken(token), expiresAt);
    return {
      url: appUrl(`/p/${token}`),
      expiresAt,
      maxPhotosPerProduct: PHOTOS_PER_PRODUCT,
      next: `Give the user this link: they open it on their phone, pick photos for each product and they appear in the shop right away. It works for ${PHOTO_LINK_HOURS} hours; anyone with the link can add photos to these products, so they shouldn't share it.`,
    };
  },

  /** What the upload page shows: the import's products, their colours and current photos. */
  async forToken(token: string, ip: string) {
    rateLimit(`photo-link-view:${ip}`, LIMITS.viewPerIp.calls, LIMITS.viewPerIp.windowMs);
    const link = await usableLink(token);
    const products = await productRepo.listByImportWithPhotos(link.shopId, link.importId);
    return {
      shop: { name: link.shop.name },
      expiresAt: link.expiresAt,
      maxPhotosPerProduct: PHOTOS_PER_PRODUCT,
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        colours: colours(p.variants),
        photos: p.images.map((i) => ({ id: i.id, url: i.url, colour: i.optionValue })),
        photosLeft: photosLeft(p.images.length),
      })),
    };
  },

  /**
   * Adds the photos in a multipart form (`productId`, optional `colour`, one
   * or more `file`) to a product of the link's import. All or nothing: if one
   * file is refused, none is kept.
   */
  async upload(token: string, form: FormData, ip: string) {
    rateLimit(`photo-link-upload-ip:${ip}`, LIMITS.uploadPerIp.calls, LIMITS.uploadPerIp.windowMs);
    rateLimit(`photo-link-upload:${hashToken(token)}`, LIMITS.uploadPerLink.calls, LIMITS.uploadPerLink.windowMs);
    const link = await usableLink(token);
    const productId = String(form.get("productId") ?? "");
    const products = await productRepo.listByImportWithPhotos(link.shopId, link.importId);
    const product = products.find((p) => p.id === productId);
    if (!product) throw notFound("Product");

    const files = form.getAll("file");
    if (files.length === 0) throw unprocessable("NO_FILES", "Choose at least one photo.");
    const left = photosLeft(product.images.length);
    if (files.length > left) {
      throw unprocessable("PHOTO_LIMIT", `A product can have up to ${PHOTOS_PER_PRODUCT} photos; ${left} more can be added.`, { photosLeft: left });
    }
    const colour = String(form.get("colour") ?? "").trim();
    const optionValue = colour ? matchColour(colour, colours(product.variants)) : null;
    if (colour && !optionValue) throw unprocessable("UNKNOWN_COLOUR", `"${colour}" is not one of this product's options.`);

    const saved: string[] = [];
    try {
      for (const file of files) saved.push(await saveUpload(link.shopId, file, "photo"));
      // shortcut: two uploads at the very same moment could pass the 5-photo check together; acceptable for a 24 h link.
      await transaction(async (tx) => {
        for (const url of saved) await productRepo.addImage(link.shopId, product.id, { url, optionValue }, tx);
      });
    } catch (error) {
      await Promise.all(saved.map((url) => deleteUpload(link.shopId, url)));
      throw error;
    }
    const after = (await productRepo.listByImportWithPhotos(link.shopId, link.importId)).find((p) => p.id === product.id)!;
    return {
      productId: product.id,
      added: saved.length,
      photos: after.images.map((i) => ({ id: i.id, url: i.url, colour: i.optionValue })),
      photosLeft: photosLeft(after.images.length),
    };
  },
};
