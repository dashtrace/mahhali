import { PageHeader } from "@/components/ui";
import { common } from "@/i18n/messages/common";
import { shopMessages } from "@/i18n/messages/shop";
import { getLocale } from "@/i18n/server";
import { plain } from "@/server/http/json";
import { courierService } from "@/server/services/courierService";
import { staffService } from "@/server/services/staffService";
import { pageActor } from "../../_server/session";
import { Team } from "./_components/Team";

export const metadata = { title: "Team" };

export default async function StaffPage() {
  const actor = await pageActor("staff.manage", "/dashboard/staff");
  const locale = await getLocale();
  const m = shopMessages[locale];
  const [team, couriers] = await Promise.all([staffService.list(actor), courierService.list(actor, { active: true })]);
  const now = new Date();
  return (
    <>
      <PageHeader title={m.teamTitle} subtitle={m.teamSubtitle} />
      <Team
        members={plain(team.members)}
        invitations={plain(team.invitations.map((i) => ({ ...i, expired: i.expiresAt < now })))}
        couriers={couriers.map((c) => ({ id: c.id, name: c.name }))}
        meId={actor.userId}
        locale={locale}
        m={m}
        t={common[locale]}
      />
    </>
  );
}
