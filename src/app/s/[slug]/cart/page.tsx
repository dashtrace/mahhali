import type { Metadata } from "next";
import { checkoutMessages } from "@/i18n/messages/checkout";
import { loadCatalogue } from "../../../_storefront/data";
import { ShopFrame } from "../../../_storefront/ShopFrame";
import { Checkout } from "./Checkout";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ step?: string }> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ slug }, { step }] = await Promise.all([params, searchParams]);
  const { shop } = await loadCatalogue(slug);
  const m = checkoutMessages[shop.locale];
  return { title: `${step === "checkout" ? m.checkoutTitle : m.cartTitle} · ${shop.name}`, robots: { index: false } };
}

// Cart and checkout share one route: ?step=checkout shows the form, so the back button returns to the cart.
export default async function CartPage({ params, searchParams }: Props) {
  const [{ slug }, { step }] = await Promise.all([params, searchParams]);
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
        step={step === "checkout" ? "checkout" : "cart"}
        m={checkoutMessages[locale]}
      />
    </ShopFrame>
  );
}
