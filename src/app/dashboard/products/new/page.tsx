import { PageHeader } from "@/components/ui";
import { catalogueMessages } from "@/i18n/messages/catalogue";
import { common } from "@/i18n/messages/common";
import { getLocale } from "@/i18n/server";
import { accountService } from "@/server/services/accountService";
import { categoryService } from "@/server/services/storefrontService";
import { pageActor } from "../../../_server/session";
import { BackLink } from "../_components/kit";
import { CreateProductForm } from "../_components/CreateProductForm";

export const metadata = { title: "New product" };

export default async function NewProductPage() {
  const actor = await pageActor("product.write", "/dashboard/products/new");
  const locale = await getLocale();
  const m = catalogueMessages[locale];
  const [me, categories] = await Promise.all([accountService.me(actor), categoryService.list(actor)]);
  return (
    <>
      <BackLink href="/dashboard/products">{m.backToProducts}</BackLink>
      <PageHeader title={m.addProductTitle} subtitle={m.addProductSub} />
      <CreateProductForm currency={me.shop.currency} categories={categories.map(({ id, name }) => ({ id, name }))} m={m} t={common[locale]} />
    </>
  );
}
