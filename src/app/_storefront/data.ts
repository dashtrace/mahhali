import { notFound } from "next/navigation";
import { cache } from "react";
import { isLocale, type Locale } from "@/i18n/locale";
import { AppError } from "@/server/http/errors";
import { plain } from "@/server/http/json";
import { catalogueService } from "@/server/services/productService";

/** Public pages speak the shop's language, not the visitor's cookie. */
export function shopLocale(language: unknown): Locale {
  return isLocale(language) ? language : "en";
}

/** A service call for a public page: 404 becomes the not-found page, other AppErrors come back to show. */
export async function attempt<T>(call: Promise<T>): Promise<{ ok: true; data: T } | { ok: false; error: AppError }> {
  try {
    return { ok: true, data: await call };
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
    if (error.status === 404) notFound();
    return { ok: false, error };
  }
}

/** The shop and its products, once per request (metadata and page share it). */
export const loadCatalogue = cache(async (slug: string) => {
  const res = await attempt(catalogueService.forShop(slug));
  if (!res.ok) throw res.error;
  const data = plain(res.data);
  return { products: data.products, shop: { ...data.shop, locale: shopLocale(data.shop.language) } };
});

/**
 * For pages that load a slim shop (tracking, reviews): what the frame shows on every
 * other page, plus the products. A suspended shop has no catalogue but its order
 * links keep working, so those keep the slim shop.
 */
export async function withCatalogue<S extends { slug: string }>(shop: S) {
  const res = await catalogueService.forShop(shop.slug).catch((error) => {
    if (error instanceof AppError) return null;
    throw error;
  });
  if (!res) return { shop, products: [] as CatalogueProduct[] };
  const { products, shop: full } = plain(res);
  const { tagline, about, shippingInfo, showTestimonials, logoMode, instagramUrl, facebookUrl, categories } = full;
  return { shop: { ...shop, tagline, about, shippingInfo, showTestimonials, logoMode, instagramUrl, facebookUrl, categories }, products };
}

export type CatalogueProduct =Awaited<ReturnType<typeof loadCatalogue>>["products"][number];
