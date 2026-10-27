import { PageHeader } from "@/components/ui";
import { fill } from "@/i18n/locale";
import { catalogueMessages } from "@/i18n/messages/catalogue";
import { common } from "@/i18n/messages/common";
import { getLocale } from "@/i18n/server";
import { can } from "@/server/domain/policy";
import { MAX_CATEGORIES } from "@/server/domain/storefront";
import { productService } from "@/server/services/productService";
import { categoryService } from "@/server/services/storefrontService";
import { pageActor } from "../../../_server/session";
import { CategoryManager } from "./CategoryManager";

export const metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const actor = await pageActor("product.read", "/dashboard/products/categories");
  const locale = await getLocale();
  const m = catalogueMessages[locale];
  const [categories, products] = await Promise.all([categoryService.list(actor), productService.list(actor, { includeArchived: false })]);
  const count = (id: string) => products.filter((p) => p.categoryId === id).length;
  return (
    <>
      <PageHeader title={m.categoriesTitle} subtitle={fill(m.categoriesHint, { max: MAX_CATEGORIES })} back={{ href: "/dashboard/products", label: m.productsTitle }} />
      <CategoryManager
        categories={categories.map((c) => ({ id: c.id, name: c.name, count: count(c.id) }))}
        canWrite={can(actor.role, "product.write")}
        max={MAX_CATEGORIES}
        m={m}
        t={common[locale]}
      />
    </>
  );
}
