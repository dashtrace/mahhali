"use client";

import Link from "next/link";
import { addToCart, useCart } from "@/app/_storefront/cart";
import { showToast } from "@/app/_storefront/Toast";
import { Icon } from "@/components/Icon";
import { fill, type Locale } from "@/i18n/locale";
import { storeMessages } from "@/i18n/messages/store";

type Sellable = {
  variants: { id: string; inStock: boolean; left?: number }[];
  customization?: { required: boolean } | null;
};

/** The variant a tile may add straight away: there is no choice to make and no required note to skip. */
export function quickAddVariant(product: Sellable) {
  const [only, another] = product.variants;
  return only?.inStock && !another && !product.customization?.required ? only : null;
}

/** The tile's round add button. Anything it can't add directly opens the product page instead. */
export function QuickAdd({ slug, product, locale }: { slug: string; product: Sellable & { id: string; name: string }; locale: Locale }) {
  const m = storeMessages[locale];
  const { roomFor } = useCart(slug);
  const variant = quickAddVariant(product);

  if (!variant || roomFor(variant.id, variant.left) <= 0) {
    return (
      <Link href={`/s/${slug}/p/${product.id}`} aria-label={fill(m.viewProduct, { name: product.name })} className="sl-tile-add">
        <Icon name="plus" className="size-[17px]" />
      </Link>
    );
  }
  return (
    <button
      type="button"
      aria-label={`${m.addToCart}: ${product.name}`}
      className="sl-tile-add"
      onClick={() => {
        addToCart(slug, { variantId: variant.id, qty: 1 });
        showToast(m.addedToCart);
      }}
    >
      <Icon name="plus" className="size-[17px]" />
    </button>
  );
}
