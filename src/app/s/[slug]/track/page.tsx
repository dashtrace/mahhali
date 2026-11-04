import type { Metadata } from "next";
import { checkoutMessages } from "@/i18n/messages/checkout";
import { loadCatalogue } from "../../../_storefront/data";
import { ShopFrame } from "../../../_storefront/ShopFrame";
import { TrackTop } from "./TrackTop";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { shop } = await loadCatalogue((await params).slug);
  return { title: `${checkoutMessages[shop.locale].trackTitle} · ${shop.name}` };
}

export default async function TrackPage({ params }: Params) {
  const { slug } = await params;
  const { shop } = await loadCatalogue(slug);
  const m = checkoutMessages[shop.locale];
  return (
    <ShopFrame shop={shop} locale={shop.locale} page="sl-track-page">
      <TrackTop slug={slug} shopName={shop.name} m={m} />
    </ShopFrame>
  );
}
