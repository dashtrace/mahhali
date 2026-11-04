import type { Metadata } from "next";
import { pageActor } from "@/app/_server/session";
import { dmSans, playfair } from "@/app/_storefront/fonts";
import { loadStore } from "@/app/s/[slug]/_components/load";
import { relatedTo } from "@/app/s/[slug]/p/[id]/ProductContent";
import { plain } from "@/server/http/json";
import { catalogueService } from "@/server/services/productService";
import { reviewService } from "@/server/services/reviewService";
import { shopService } from "@/server/services/shopService";
import { testimonialService } from "@/server/services/storefrontService";
import { PreviewFrame } from "./PreviewFrame";

export const metadata: Metadata = { title: "Preview", robots: { index: false, follow: false } };

const VIEWS = ["home", "shop", "product"] as const;
const PAGE_SIZE = 8; // as on the shop page
const TESTIMONIALS = 12; // as catalogueService.forShop

/** The owner's own shop as customers see it, in the settings page's frame. A shop that can't be shown lands on not-found.tsx. */
export default async function StorefrontPreviewPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const actor = await pageActor("shop.settings", "/dashboard/settings");
  const { view: raw } = await searchParams;
  const view = VIEWS.find((v) => v === raw) ?? "home";
  const { slug } = await shopService.settings(actor);
  const data = await loadStore(slug);
  // The public load skips these while the toggle is off, but a draft can turn it on.
  const testimonials = data.shop.showTestimonials ? data.testimonials : plain(await testimonialService.list(actor, "APPROVED")).slice(0, TESTIMONIALS);
  const frame = { data: { ...data, testimonials }, view, fontClass: `${playfair.variable} ${dmSans.variable}` };
  const product = view === "product" ? data.products[0] : undefined;
  const listing = view === "shop" ? plain(await catalogueService.browse(slug, { sort: "all", pageSize: PAGE_SIZE })) : undefined;

  if (listing) return <PreviewFrame {...frame} listing={{ items: listing.items, total: listing.total, page: listing.page, pageCount: listing.pageCount, pageSize: PAGE_SIZE }} />;
  if (product) return <PreviewFrame {...frame} detail={{ product, reviews: plain(await reviewService.forProduct(slug, product.id)), related: relatedTo(data.products, product) }} />;
  return <PreviewFrame {...frame} />;
}
