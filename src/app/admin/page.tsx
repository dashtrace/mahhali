import { adminMessages } from "@/i18n/messages/admin";
import { common } from "@/i18n/messages/common";
import { getLocale } from "@/i18n/server";
import { ShopsList } from "./_components/AdminViews";

export const metadata = { title: "Shops" };

export default async function AdminShopsPage() {
  const locale = await getLocale();
  return <ShopsList locale={locale} m={adminMessages[locale]} t={common[locale]} />;
}
