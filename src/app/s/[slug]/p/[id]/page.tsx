import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui";
import { fill } from "@/i18n/locale";
import { storeMessages } from "@/i18n/messages/store";
import { formatDate } from "@/lib/format";
import { plain } from "@/server/http/json";
import { reviewService } from "@/server/services/reviewService";
import { loadCatalogue } from "../../../../_storefront/data";
import { ShopFrame, Stars } from "../../../../_storefront/ShopFrame";
import { VariantPicker } from "./VariantPicker";

type Params = { params: Promise<{ slug: string; id: string }> };

async function load(slug: string, id: string) {
  const data = await loadCatalogue(slug);
  const product = data.products.find((p) => p.id === id);
  if (!product) notFound();
  return { ...data, product };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug, id } = await params;
  const { shop, product } = await load(slug, id);
  return { title: `${product.name} · ${shop.name}` };
}

export default async function ProductPage({ params }: Params) {
  const { slug, id } = await params;
  const { shop, product } = await load(slug, id);
  const reviews = plain(await reviewService.forProduct(slug, id));
  const locale = shop.locale;
  const m = storeMessages[locale];

  return (
    <ShopFrame shop={shop} locale={locale} cart>
      <Link href={`/s/${slug}`} className="mb-2 inline-flex min-h-11 items-center text-sm opacity-80 hover:opacity-100">
        <span aria-hidden className="me-1 rtl:rotate-180">←</span>
        {m.backToShop}
      </Link>
      <div className="grid gap-6 md:grid-cols-2">
        {product.images.length > 0 ? (
          <ul className="-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
            {product.images.map((img, i) => (
              <li key={img.url} className="w-[85%] shrink-0 snap-center md:w-full">
                {/* eslint-disable-next-line @next/next/no-img-element -- uploaded files are served as-is */}
                <img
                  src={img.url}
                  alt={fill(m.photoOf, { name: product.name, n: i + 1 })}
                  loading={i === 0 ? "eager" : "lazy"}
                  className="aspect-square w-full rounded-[var(--radius)] bg-stone-100 object-cover"
                />
              </li>
            ))}
          </ul>
        ) : (
          <div className="aspect-square rounded-[var(--radius)] bg-stone-100" />
        )}

        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{product.name}</h1>
            {reviews.count > 0 && (
              <Stars
                average={reviews.average}
                count={reviews.count}
                label={fill(m.rated, { avg: reviews.average.toFixed(1), n: reviews.count })}
              />
            )}
          </div>
          {product.description && <p className="whitespace-pre-line text-sm opacity-80">{product.description}</p>}
          <VariantPicker slug={slug} variants={product.variants} currency={shop.currency} locale={locale} m={m} />
        </div>
      </div>

      <section className="mt-8" aria-labelledby="reviews">
        <h2 id="reviews" className="mb-3 text-lg font-semibold">
          {m.reviewsTitle}
        </h2>
        {reviews.reviews.length === 0 ? (
          <p className="text-sm opacity-70">{m.noReviews}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {reviews.reviews.map((r, i) => (
              <li key={i}>
                <Card className="flex flex-col gap-1">
                  <Stars average={r.rating} label={fill(m.starsLabel, { n: r.rating })} />
                  {r.comment && <p className="whitespace-pre-line text-sm">{r.comment}</p>}
                  <p className="text-xs text-stone-500">
                    {r.authorName} · <span className="text-emerald-700">{m.verifiedBuyer}</span> · {formatDate(r.createdAt, locale)}
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </ShopFrame>
  );
}
