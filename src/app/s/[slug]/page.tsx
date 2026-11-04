import type { Metadata } from "next";
import { ShopFrame } from "../../_storefront/ShopFrame";
import { loadStore } from "./_components/load";
import { StoreHome } from "./_components/StoreHome";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { shop } = await loadStore((await params).slug);
  return { title: shop.name, description: shop.tagline ?? undefined };
}

export default async function ShopHomePage({ params }: Params) {
  const data = await loadStore((await params).slug);
  return (
    <ShopFrame shop={data.shop} locale={data.shop.locale} overlay={data.shop.slides.length > 0 ? "photo" : "band"}>
      <StoreHome {...data} />
    </ShopFrame>
  );
}
