import { PageHeader } from "@/components/ui";
import { catalogueMessages } from "@/i18n/messages/catalogue";
import { common } from "@/i18n/messages/common";
import { getLocale } from "@/i18n/server";
import { accountService } from "@/server/services/accountService";
import { pageActor } from "../../../_server/session";
import { CreateProductForm } from "../_components/CreateProductForm";

export const metadata = { title: "New product" };

export default async function NewProductPage() {
  const actor = await pageActor("product.write", "/dashboard/products/new");
  const locale = await getLocale();
  const m = catalogueMessages[locale];
  const me = await accountService.me(actor);
  return (
    <>
      <PageHeader title={m.newProduct} back={{ href: "/dashboard/products", label: m.productsTitle }} />
      <CreateProductForm currency={me.shop.currency} m={m} t={common[locale]} />
    </>
  );
}
