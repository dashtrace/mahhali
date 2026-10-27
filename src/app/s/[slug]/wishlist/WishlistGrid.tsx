"use client";

import { useWishlist } from "@/app/_storefront/wishlist";
import { ButtonLink, EmptyState } from "@/components/ui";
import type { Locale } from "@/i18n/locale";
import { storeMessages } from "@/i18n/messages/store";
import type { StoreProduct } from "../_components/load";
import { ProductTile } from "../_components/tiles";

type Tile = Pick<StoreProduct, "id" | "name" | "description" | "images" | "variants" | "rating">;

/** Saved ids (this device) resolved against the live catalogue; ids no longer for sale drop out. */
export function WishlistGrid({ slug, products, currency, locale }: { slug: string; products: Tile[]; currency: "USD" | "LBP"; locale: Locale }) {
  const m = storeMessages[locale];
  const { ids } = useWishlist(slug);
  const byId = new Map(products.map((p) => [p.id, p]));
  const saved = ids.map((id) => byId.get(id)).filter((p): p is Tile => !!p);

  if (!saved.length)
    return (
      <EmptyState
        title={m.wishEmpty}
        body={m.wishEmptyBody}
        action={
          <ButtonLink href={`/s/${slug}/shop`} tone="secondary">
            {m.browseShop}
          </ButtonLink>
        }
      />
    );
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {saved.map((p) => (
        <li key={p.id} className="flex">
          <ProductTile slug={slug} product={p} currency={currency} locale={locale} />
        </li>
      ))}
    </ul>
  );
}
