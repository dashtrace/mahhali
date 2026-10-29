import { Alert, Badge, ButtonLink, EmptyState, FilterChip, PageHeader, ProductCard, Segmented } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { fill } from "@/i18n/locale";
import { catalogueMessages } from "@/i18n/messages/catalogue";
import { common } from "@/i18n/messages/common";
import { getLocale } from "@/i18n/server";
import { formatMoney } from "@/lib/format";
import { can } from "@/server/domain/policy";
import { accountService } from "@/server/services/accountService";
import { productService } from "@/server/services/productService";
import { categoryService } from "@/server/services/storefrontService";
import { pageActor } from "../../_server/session";

export const metadata = { title: "Products" };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ archived?: string; welcome?: string; cat?: string }> }) {
  const actor = await pageActor("product.read", "/dashboard/products");
  const sp = await searchParams;
  const locale = await getLocale();
  const m = catalogueMessages[locale];
  const t = common[locale];
  const includeArchived = sp.archived === "1";
  const canWrite = can(actor.role, "product.write");
  const [me, all, categories] = await Promise.all([
    accountService.me(actor),
    productService.list(actor, { includeArchived }),
    categoryService.list(actor),
  ]);
  const currency = me.shop.currency;
  const cat = categories.some((c) => c.id === sp.cat) ? sp.cat : undefined;
  const products = cat ? all.filter((p) => p.categoryId === cat) : all;
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));
  const href = (q: { archived?: boolean; cat?: string }) => {
    const params = new URLSearchParams();
    if (q.archived) params.set("archived", "1");
    if (q.cat) params.set("cat", q.cat);
    const s = params.toString();
    return s ? `/dashboard/products?${s}` : "/dashboard/products";
  };

  return (
    <>
      <PageHeader
        title={m.productsTitle}
        subtitle={fill(m.productsSubtitle, { n: products.length })}
        actions={
          <>
            <ButtonLink tone="secondary" href="/dashboard/products/categories">
              <Icon name="grid" />
              {m.categoriesTitle}
            </ButtonLink>
            {canWrite && (
              <ButtonLink href="/dashboard/products/new">
                <Icon name="plus" />
                {m.newProduct}
              </ButtonLink>
            )}
          </>
        }
      />
      {sp.welcome && <Alert tone="success" className="mb-4">{m.welcome}</Alert>}
      {!canWrite && <Alert className="mb-4">{m.readOnly}</Alert>}

      <div className="mb-4 flex flex-col gap-3">
        <Segmented
          label={m.productsFilter}
          className="sm:max-w-sm"
          items={[
            { label: m.activeOnly, href: href({ cat }), current: !includeArchived },
            { label: m.withArchived, href: href({ cat, archived: true }), current: includeArchived },
          ]}
        />
        {categories.length > 0 && (
          <nav aria-label={m.categoriesTitle} className="sl-scroll-row -mx-4 gap-2 px-4 pb-1">
            <FilterChip href={href({ archived: includeArchived })} selected={!cat}>
              {t.all}
            </FilterChip>
            {categories.map((c) => (
              <FilterChip key={c.id} href={href({ archived: includeArchived, cat: c.id })} selected={cat === c.id}>
                {c.name}
              </FilterChip>
            ))}
          </nav>
        )}
      </div>

      {products.length === 0 ? (
        <EmptyState
          title={m.noProducts}
          body={canWrite && !cat ? m.noProductsHint : undefined}
          action={canWrite && !cat && <ButtonLink href="/dashboard/products/new">{m.newProduct}</ButtonLink>}
        />
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => {
            const live = p.variants.filter((v) => !v.archived);
            const prices = live.map((v) => v.priceMinor);
            const min = prices.length ? prices.reduce((a, b) => (b < a ? b : a)) : null;
            const stock = live.reduce((n, v) => n + v.available, 0);
            const price = min === null ? "–" : <bdi>{prices.some((x) => x !== min) ? fill(m.fromPrice, { price: formatMoney(min, currency, locale) }) : formatMoney(min, currency, locale)}</bdi>;
            const description = [p.categoryId ? categoryName.get(p.categoryId) : null, fill(m.variantsN, { n: live.length })].filter(Boolean).join(" · ");
            return (
              <li key={p.id} className="flex">
                <ProductCard
                  // Staff without product.write open the public page instead of the editor.
                  href={canWrite ? `/dashboard/products/${p.id}` : `/s/${me.shop.slug}/p/${p.id}`}
                  name={p.name}
                  image={p.images[0]?.url}
                  price={price}
                  description={description}
                  locale={locale}
                  badge={
                    <span className="flex flex-col items-start gap-1">
                      {p.status === "ARCHIVED" && <Badge>{m.archived}</Badge>}
                      {p.featured && <Badge tone="violet">{m.featured}</Badge>}
                      {stock > 0 ? <Badge tone="green">{fill(m.inStockN, { n: stock })}</Badge> : <Badge tone="red">{m.outOfStock}</Badge>}
                    </span>
                  }
                />
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
