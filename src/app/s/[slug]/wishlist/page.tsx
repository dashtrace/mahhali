import type { Metadata } from "next";
import { storeMessages } from "@/i18n/messages/store";
import { ShopFrame } from "../../../_storefront/ShopFrame";
import { loadStore } from "../_components/load";
import { WishlistGrid } from "./WishlistGrid";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { shop } = await loadStore((await params).slug);
  return { title: `${storeMessages[shop.locale].wishTitle} · ${shop.name}` };
}

export default async function WishlistPage({ params }: Params) {
  const { slug } = await params;
  const { shop, products } = await loadStore(slug);
  const locale = shop.locale;
  const m = storeMessages[locale];
  // Only what a card needs crosses to the browser.
  const tiles = products.map(({ id, name, description, images, variants, rating }) => ({ id, name, description, images, variants, rating }));

  return (
    <ShopFrame shop={shop} locale={locale}>
      <h1 className="sl-heading mt-1 text-[26px] leading-tight">{m.wishTitle}</h1>
      <p className="mb-4 mt-1 text-[13px] text-sl-muted">{m.wishNote}</p>
      <WishlistGrid slug={slug} products={tiles} currency={shop.currency} locale={locale} />
    </ShopFrame>
  );
}
