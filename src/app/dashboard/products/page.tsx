import Link from "next/link";
import { Alert, PageHeader } from "@/components/ui";
import { fill } from "@/i18n/locale";
import { catalogueMessages } from "@/i18n/messages/catalogue";
import { common } from "@/i18n/messages/common";
import { getLocale } from "@/i18n/server";
import { formatMoney } from "@/lib/format";
import { can } from "@/server/domain/policy";
import { accountService } from "@/server/services/accountService";
import { productService } from "@/server/services/productService";
import { categoryService } from "@/server/services/storefrontService";
import { DashIcon } from "../_components/DashIcon";
import { pageActor } from "../../_server/session";
import { ProductList, type ProductMode, type ProductRow } from "./_components/ProductList";

export const metadata = { title: "Products" };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ show?: string; welcome?: string; cat?: string }> }) {
  const actor = await pageActor("product.read", "/dashboard/products");
  const sp = await searchParams;
  const locale = await getLocale();
  const m = catalogueMessages[locale];
  const canWrite = can(actor.role, "product.write");
  const [me, all, categories] = await Promise.all([accountService.me(actor), productService.list(actor, { includeArchived: true }), categoryService.list(actor)]);
  const currency = me.shop.currency;
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));

  const rows: ProductRow[] = all.map((p) => {
    const live = p.variants.filter((v) => !v.archived);
    const prices = live.map((v) => v.priceMinor);
    const min = prices.length ? prices.reduce((a, b) => (b < a ? b : a)) : null;
    return {
      id: p.id,
      name: p.name,
      image: p.images[0]?.url ?? null,
      categoryId: p.categoryId,
      categoryName: (p.categoryId && categoryName.get(p.categoryId)) || null,
      price: min === null ? "–" : prices.some((x) => x !== min) ? fill(m.fromPrice, { price: formatMoney(min, currency, locale) }) : formatMoney(min, currency, locale),
      stock: live.reduce((n, v) => n + v.available, 0),
      optionCount: p.options.length,
      archived: p.status === "ARCHIVED",
      featured: p.featured,
      // Staff without product.write open the public page instead of the editor.
      href: canWrite ? `/dashboard/products/${p.id}` : `/s/${me.shop.slug}/p/${p.id}`,
    };
  });
  const mode: ProductMode = sp.show === "archived" || sp.show === "all" ? "all" : "active";

  return (
    <>
      <PageHeader
        title={m.productsTitle}
        subtitle={fill(m.productsSubtitle, { n: rows.filter((r) => !r.archived).length })}
        actions={
          <>
            <Link className="btn" href="/dashboard/products/categories">
              <DashIcon name="filter" size="sm" />
              {m.categoriesTitle}
            </Link>
            {canWrite && (
              <Link className="btn primary" href="/dashboard/products/new">
                <DashIcon name="plus" size="sm" />
                {m.addProduct}
              </Link>
            )}
          </>
        }
      />
      {sp.welcome && <Alert tone="success" className="mb-4">{m.welcome}</Alert>}
      {!canWrite && <Alert className="mb-4">{m.readOnly}</Alert>}
      <ProductList
        rows={rows}
        categories={categories.map(({ id, name }) => ({ id, name }))}
        canWrite={canWrite}
        initialMode={mode}
        initialCategory={categories.some((c) => c.id === sp.cat) ? sp.cat! : ""}
        m={m}
        t={common[locale]}
      />
    </>
  );
}
