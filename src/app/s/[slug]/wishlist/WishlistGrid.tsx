"use client";

import Link from "next/link";
import { useWishlist } from "@/app/_storefront/wishlist";
import { ArrowOut } from "@/components/Icon";
import type { Locale } from "@/i18n/locale";
import { storeMessages } from "@/i18n/messages/store";
import { PageEmpty, ProductTile, type TileProduct } from "../_components/tiles";

/** Saved ids (this device) resolved against the live catalogue; ids no longer for sale drop out. */
export function WishlistGrid({ slug, products, currency, locale }: { slug: string; products: TileProduct[]; currency: "USD" | "LBP"; locale: Locale }) {
  const m = storeMessages[locale];
  const { ids } = useWishlist(slug);
  const byId = new Map(products.map((p) => [p.id, p]));
  const saved = ids.map((id) => byId.get(id)).filter((p): p is TileProduct => !!p);

  if (!saved.length)
    return (
      <PageEmpty
        title={m.wishEmpty}
        body={m.wishEmptyBody}
        action={
          <Link href={`/s/${slug}/shop`} className="sl-text-cta">
            {m.browseShop}
            <ArrowOut />
          </Link>
        }
      />
    );
  return (
    <ul className="sl-card-grid sl-card-grid-saved">
      {saved.map((p) => (
        <li key={p.id}>
          <ProductTile slug={slug} product={p} currency={currency} locale={locale} />
        </li>
      ))}
    </ul>
  );
}
