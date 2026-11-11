import { PageHeader } from "@/components/ui";
import { common } from "@/i18n/messages/common";
import { connectMessages } from "@/i18n/messages/connect";
import { getLocale } from "@/i18n/server";
import { mcpResourceUrl } from "@/server/auth/oauth";
import { can } from "@/server/domain/policy";
import { plain } from "@/server/http/json";
import { connectService } from "@/server/services/connectService";
import { pageActor } from "../../_server/session";
import { ConnectedApps, DisconnectAll } from "./ConnectedApps";

export const metadata = { title: "Connected apps" };

// AI assistants connected to the shop. The owner sees and disconnects everyone's; members their own.
export default async function ConnectionsPage() {
  const actor = await pageActor("connection.manage", "/dashboard/connections");
  const locale = await getLocale();
  const m = connectMessages[locale];
  const t = common[locale];
  const all = can(actor.role, "connection.manageAll");
  const connections = await connectService.connections(actor);
  const scopeLabel = {
    "orders:read": m.scopeOrdersRead,
    "catalogue:read": m.scopeCatalogueRead,
    "catalogue:write": m.scopeCatalogueWrite,
    "finance:read": m.scopeFinanceRead,
  };
  return (
    <>
      <PageHeader
        title={m.appsTitle}
        subtitle={all ? m.appsSubtitleOwner : m.appsSubtitleMember}
        actions={all && connections.length > 0 && <DisconnectAll m={m} t={t} />}
      />
      <ConnectedApps
        connections={plain(connections).map((c) => ({
          ...c,
          scopes: c.scopes.map((s) => scopeLabel[s as keyof typeof scopeLabel] ?? s),
        }))}
        mcpUrl={mcpResourceUrl()}
        locale={locale}
        m={m}
        t={t}
      />
    </>
  );
}
