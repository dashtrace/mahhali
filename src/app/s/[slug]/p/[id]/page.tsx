import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WishButton } from "@/app/_storefront/wishlist";
import { plain } from "@/server/http/json";
import { reviewService } from "@/server/services/reviewService";
import { ShopFrame } from "../../../../_storefront/ShopFrame";
import { loadStore } from "../../_components/load";
import { ProductContent, relatedTo } from "./ProductContent";

type Params = { params: Promise<{ slug: string; id: string }> };

async function load(slug: string, id: string) {
  const data = await loadStore(slug);
  const product = data.products.find((p) => p.id === id);
  if (!product) notFound();
  return { ...data, product };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug, id } = await params;
  const { shop, product } = await load(slug, id);
  return { title: `${product.name} · ${shop.name}`, description: product.description?.slice(0, 160) || undefined };
}

export default async function ProductPage({ params }: Params) {
  const { slug, id } = await params;
  const { shop, products, product } = await load(slug, id);
  const reviews = plain(await reviewService.forProduct(slug, id));
  const locale = shop.locale;

  return (
    <ShopFrame shop={shop} locale={locale} page wish={<WishButton slug={slug} productId={product.id} locale={locale} variant="icon" />}>
      <ProductContent slug={slug} shop={shop} product={product} reviews={reviews} related={relatedTo(products, product)} locale={locale} />
    </ShopFrame>
  );
}
