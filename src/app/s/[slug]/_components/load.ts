import { cache } from "react";
import { attempt, shopLocale } from "@/app/_storefront/data";
import { plain } from "@/server/http/json";
import { catalogueService } from "@/server/services/productService";

/** loadCatalogue plus the approved testimonials (home, About). Once per request; unknown shop -> 404. */
export const loadStore = cache(async (slug: string) => {
  const res = await attempt(catalogueService.forShop(slug));
  if (!res.ok) throw res.error;
  const data = plain(res.data);
  return { ...data, shop: { ...data.shop, locale: shopLocale(data.shop.language) } };
});

export type StoreData = Awaited<ReturnType<typeof loadStore>>;
export type StoreShop = StoreData["shop"];
export type StoreProduct = StoreData["products"][number];
