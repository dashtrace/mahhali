import { adminMessages } from "@/i18n/messages/admin";
import { common } from "@/i18n/messages/common";
import { getLocale } from "@/i18n/server";
import { AuditLog } from "../_components/AdminViews";

export const metadata = { title: "Audit log" };

export default async function AdminAuditPage() {
  const locale = await getLocale();
  return <AuditLog locale={locale} m={adminMessages[locale]} t={common[locale]} />;
}
