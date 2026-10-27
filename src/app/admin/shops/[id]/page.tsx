import { adminMessages } from "@/i18n/messages/admin";
import { common } from "@/i18n/messages/common";
import { getLocale } from "@/i18n/server";
import { ShopView } from "../../_components/AdminViews";

export const metadata = { title: "Shop" };

export default async function AdminShopPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, locale] = await Promise.all([params, getLocale()]);
  return <ShopView id={id} locale={locale} m={adminMessages[locale]} t={common[locale]} />;
}
