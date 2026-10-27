import { PageHeader } from "@/components/ui";
import { catalogueMessages } from "@/i18n/messages/catalogue";
import { common } from "@/i18n/messages/common";
import { getLocale } from "@/i18n/server";
import { can } from "@/server/domain/policy";
import { plain } from "@/server/http/json";
import { courierService } from "@/server/services/courierService";
import { pageActor } from "../../_server/session";
import { Couriers } from "./_components/Couriers";

export const metadata = { title: "Couriers" };

export default async function CouriersPage() {
  const actor = await pageActor("courier.read", "/dashboard/couriers");
  const locale = await getLocale();
  const m = catalogueMessages[locale];
  const couriers = await courierService.list(actor, {});
  // Active first; the service sorts by name within each group.
  const sorted = [...couriers].sort((a, b) => Number(b.active) - Number(a.active));
  return (
    <>
      <PageHeader title={m.couriersTitle} />
      <Couriers couriers={plain(sorted)} canWrite={can(actor.role, "courier.write")} m={m} t={common[locale]} />
    </>
  );
}
