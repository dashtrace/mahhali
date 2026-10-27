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

export type CatalogueProduct = Awaited<ReturnType<typeof loadCatalogue>>["products"][number];
