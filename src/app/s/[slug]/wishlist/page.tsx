import type { Metadata } from "next";
import { storeMessages } from "@/i18n/messages/store";
import { ShopFrame } from "../../../_storefront/ShopFrame";
import { loadStore } from "../_components/load";
import { PageHead } from "../_components/tiles";
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
  const tiles = products.map(({ id, name, description, images, variants, categoryName, customization }) => ({ id, name, description, images, variants, categoryName, customization }));

  return (
    <ShopFrame shop={shop} locale={locale} page>
      <PageHead eyebrow={m.wishEyebrow} title={m.wishTitle} lead={m.wishLead} />
      <WishlistGrid slug={slug} products={tiles} currency={shop.currency} locale={locale} />
    </ShopFrame>
  );
}
