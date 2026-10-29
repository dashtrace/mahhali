import { adminMessages } from "@/i18n/messages/admin";
import { common } from "@/i18n/messages/common";
import { getLocale } from "@/i18n/server";
import { ShopOrders } from "../../../_components/AdminViews";

export const metadata = { title: "Shop orders" };

export default async function AdminShopOrdersPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, locale] = await Promise.all([params, getLocale()]);
  return <ShopOrders id={id} locale={locale} m={adminMessages[locale]} t={common[locale]} />;
}
