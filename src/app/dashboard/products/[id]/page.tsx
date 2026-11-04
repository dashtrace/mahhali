import { notFound } from "next/navigation";
import { catalogueMessages } from "@/i18n/messages/catalogue";
import { common } from "@/i18n/messages/common";
import { getLocale } from "@/i18n/server";
import { can } from "@/server/domain/policy";
import { AppError } from "@/server/http/errors";
import { plain } from "@/server/http/json";
import { accountService } from "@/server/services/accountService";
import { productService } from "@/server/services/productService";
import { categoryService } from "@/server/services/storefrontService";
import { pageActor } from "../../../_server/session";
import { ProductEditor } from "../_components/ProductEditor";

export const metadata = { title: "Edit product" };

export default async function EditProductPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ step?: string; created?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const actor = await pageActor("product.write", `/dashboard/products/${id}`);
  const locale = await getLocale();
  const [me, categories, product] = await Promise.all([
    accountService.me(actor),
    categoryService.list(actor),
    productService.get(actor, id).catch((e) => {
      if (e instanceof AppError && e.status === 404) notFound();
      throw e;
    }),
  ]);
  return (
    <ProductEditor
      product={plain(product)}
      categories={categories.map(({ id, name }) => ({ id, name }))}
      canAdjust={can(actor.role, "stock.adjust")}
      initialStep={sp.step}
      created={sp.created === "1"}
      currency={me.shop.currency}
      locale={locale}
      m={catalogueMessages[locale]}
      t={common[locale]}
    />
  );
}
