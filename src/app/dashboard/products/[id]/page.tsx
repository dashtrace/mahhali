import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { catalogueMessages } from "@/i18n/messages/catalogue";
import { common } from "@/i18n/messages/common";
import { getLocale } from "@/i18n/server";
import { AppError } from "@/server/http/errors";
import { plain } from "@/server/http/json";
import { accountService } from "@/server/services/accountService";
import { productService } from "@/server/services/productService";
import { categoryService } from "@/server/services/storefrontService";
import { pageActor } from "../../../_server/session";
import { ProductEditor } from "../_components/ProductEditor";

export const metadata = { title: "Edit product" };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await pageActor("product.write", `/dashboard/products/${id}`);
  const locale = await getLocale();
  const m = catalogueMessages[locale];
  const [me, categories, product] = await Promise.all([
    accountService.me(actor),
    categoryService.list(actor),
    productService.get(actor, id).catch((e) => {
      if (e instanceof AppError && e.status === 404) notFound();
      throw e;
    }),
  ]);
  return (
    <>
      <PageHeader title={product.name} back={{ href: "/dashboard/products", label: m.productsTitle }} />
      <ProductEditor
        product={plain(product)}
        categories={categories.map(({ id, name }) => ({ id, name }))}
        currency={me.shop.currency}
        locale={locale}
        m={m}
        t={common[locale]}
      />
    </>
  );
}
