import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, SectionHeader } from "@/components/ui";
import { common } from "@/i18n/messages/common";
import { storeMessages, type StoreMessages } from "@/i18n/messages/store";
import { ShopFrame } from "../../_storefront/ShopFrame";
import { HeroCarousel } from "./_components/HeroCarousel";
import { loadStore, type StoreProduct } from "./_components/load";
import { ProductTile, TestimonialCard } from "./_components/tiles";

type Params = { params: Promise<{ slug: string }> };

const STRIP_SIZE = 8;

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { shop } = await loadStore((await params).slug);
  return { title: shop.name, description: shop.tagline ?? undefined };
}

/**
 * The owner's highlight strip. Best sellers fall back to new arrivals until
 * something sells, and so does an empty featured list.
 */
function highlight(products: StoreProduct[], mode: string, m: StoreMessages) {
  if (mode === "hidden") return null;
  if (mode === "bestsellers") {
    const sold = products.filter((p) => p.soldCount > 0).sort((a, b) => b.soldCount - a.soldCount);
    if (sold.length) return { title: m.sectionBestsellers, sort: "bestsellers", items: sold };
  }
  if (mode === "featured") {
    const featured = products.filter((p) => p.featured);
    if (featured.length) return { title: m.sectionFeatured, sort: "featured", items: featured };
  }
  // Products arrive newest first.
  return products.length ? { title: m.sectionNew, sort: "new", items: products } : null;
}

export default async function ShopHomePage({ params }: Params) {
  const { slug } = await params;
  const { shop, products, testimonials } = await loadStore(slug);
  const locale = shop.locale;
  const m = storeMessages[locale];
  const section = highlight(products, shop.homeSection, m);
  const base = `/s/${slug}`;

  return (
    <ShopFrame shop={shop} locale={locale}>
      <h1 className="sr-only">{shop.name}</h1>
      <HeroCarousel slides={shop.slides} shopHref={`${base}/shop`} shopName={shop.name} tagline={shop.tagline} logo={shop.logo} locale={locale} />

      {shop.categories.length > 0 && (
        <section aria-label={m.catRow} className="mb-5">
          <ul className="sl-scroll-row -mx-4 gap-3.5 px-4 pb-1 pt-1">
            {shop.categories.map((c) => (
              <li key={c.id} className="w-[76px] shrink-0 snap-start">
                <Link href={`${base}/shop?cat=${encodeURIComponent(c.id)}`} title={c.name} className="block text-center">
                  <span aria-hidden className="sl-heading mx-auto mb-1.5 grid size-12 place-items-center rounded-full border border-sl-border bg-sl-cat text-lg text-sl-accent">
                    {[...c.name.trim()][0]?.toLocaleUpperCase(locale)}
                  </span>
                  <span className="block truncate text-xs">{c.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {section && (
        <section aria-labelledby="home-highlight" className="mb-6">
          <SectionHeader
            id="home-highlight"
            title={section.title}
            href={section.items.length > 3 ? `${base}/shop?sort=${section.sort}` : undefined}
            linkLabel={common[locale].viewAll}
          />
          <ul className="sl-scroll-row -mx-4 gap-2.5 px-4 pb-3">
            {section.items.slice(0, STRIP_SIZE).map((p) => (
              <li key={p.id} className="flex">
                <ProductTile slug={slug} product={p} currency={shop.currency} locale={locale} layout="strip" />
              </li>
            ))}
          </ul>
        </section>
      )}

      {products.length === 0 && <EmptyState title={m.comingSoon} body={m.comingSoonBody} />}

      {testimonials.length > 0 && (
        <section aria-labelledby="home-testimonials" className="mb-4">
          <SectionHeader id="home-testimonials" title={m.testimonialsTitle} href={`${base}/info/about`} linkLabel={m.aboutLink} />
          <p className="-mt-1 mb-3 text-xs text-sl-muted">{m.testimonialsNote}</p>
          <ul className="sl-scroll-row -mx-4 gap-2.5 px-4 pb-3">
            {testimonials.map((t) => (
              <li key={t.id} className="flex w-[260px] shrink-0 snap-start">
                <TestimonialCard t={t} locale={locale} className="w-full" />
              </li>
            ))}
          </ul>
        </section>
      )}
    </ShopFrame>
  );
}
