import type { Metadata } from "next";
import { common } from "@/i18n/messages/common";
import { storeMessages } from "@/i18n/messages/store";
import { loadCatalogue } from "../../../_storefront/data";
import { ShopFrame } from "../../../_storefront/ShopFrame";
import { Checkout } from "./Checkout";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { shop } = await loadCatalogue((await params).slug);
  return { title: `${storeMessages[shop.locale].cartTitle} · ${shop.name}` };
}

export default async function CartPage({ params }: Params) {
  const { slug } = await params;
  const { shop, products } = await loadCatalogue(slug);
  const locale = shop.locale;
  return (
    <ShopFrame shop={shop} locale={locale}>
      <Checkout
        slug={slug}
        products={products}
        currency={shop.currency}
        deliveryFeeMinor={shop.deliveryFeeMinor}
        locale={locale}
        m={storeMessages[locale]}
        t={common[locale]}
      />
    </ShopFrame>
  );
}
