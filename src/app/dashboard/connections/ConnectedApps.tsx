"use client";

import { Alert } from "@/components/ui";
import { fill, type Locale } from "@/i18n/locale";
import type { CommonMessages } from "@/i18n/messages/common";
import type { connectMessages } from "@/i18n/messages/connect";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { DashIcon } from "../_components/DashIcon";
import { useAction } from "../products/_components/useAction";

type M = (typeof connectMessages)["en"];
type Connection = {
  clientId: string;
  app: { name: string };
  member: { userId: string | null; name: string | null; isYou: boolean };
  scopes: string[];
  connectedAt: string;
  lastUsedAt: string | null;
};

export function DisconnectAll({ m, t }: { m: M; t: CommonMessages }) {
  const action = useAction(t.error);
  return (
    <button
      type="button"
      className="btn"
      disabled={action.busy}
      onClick={() => confirm(m.appsDisconnectAllConfirm) && action.run(() => api("/api/connections/revoke-all", { body: {} }))}
    >
      {m.appsDisconnectAll}
    </button>
  );
}

export function ConnectedApps({ connections, mcpUrl, locale, m, t }: { connections: Connection[]; mcpUrl: string; locale: Locale; m: M; t: CommonMessages }) {
  if (connections.length === 0) {
    return (
      <div className="empty">
        <strong>{m.appsEmpty}</strong>
        {m.appsEmptyHint}
        <code dir="ltr" className="mt-2 block select-all break-all">{mcpUrl}</code>
      </div>
    );
  }
  return (
    <div className="split">
      {connections.map((c) => (
        <ConnectionCard key={`${c.clientId}:${c.member.userId}`} c={c} locale={locale} m={m} t={t} />
      ))}
    </div>
  );
}

function ConnectionCard({ c, locale, m, t }: { c: Connection; locale: Locale; m: M; t: CommonMessages }) {
  const action = useAction(t.error);
  const disconnect = () =>
    confirm(fill(m.appsDisconnectConfirm, { app: c.app.name })) &&
    action.run(() => api("/api/connections/revoke", { body: { clientId: c.clientId, ...(c.member.isYou ? {} : { userId: c.member.userId }) } }));
  return (
    <div className="card">
      {action.error && <Alert tone="error" className="mb-3">{action.error}</Alert>}
      <div className="between">
        <div className="flex min-w-0 flex-wrap items-center gap-[9px]">
          <DashIcon name="link" />
          <b className="min-w-0 break-words">{c.app.name}</b>
        </div>
        <button type="button" className="btn tiny" disabled={action.busy} onClick={disconnect}>
          {m.appsDisconnect}
        </button>
      </div>
      <p className="hint my-2">{c.member.isYou ? m.appsByYou : fill(m.appsBy, { name: c.member.name ?? "—" })}</p>
      <div className="flex flex-wrap gap-1.5">
        {c.scopes.map((s) => (
          <span key={s} className="mini-badge gray">{s}</span>
        ))}
      </div>
      <p className="hint mt-2 mb-0">
        {fill(m.appsConnected, { date: formatDateTime(c.connectedAt, locale) })} ·{" "}
        {c.lastUsedAt ? fill(m.appsLastUsed, { date: formatDateTime(c.lastUsedAt, locale) }) : m.appsNeverUsed}
      </p>
    </div>
  );
}
