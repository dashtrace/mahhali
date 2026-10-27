"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert, Badge, Button, Card, DefinitionList, EmptyState, Input, PageHeader, STATUS_TONES } from "@/components/ui";
import { fill, type Locale } from "@/i18n/locale";
import type { AdminMessages } from "@/i18n/messages/admin";
import type { CommonMessages } from "@/i18n/messages/common";
import { api, errorMessage } from "@/lib/api";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";

// Admin screens read through /api/admin/* (not the services directly) so that
// withRoute writes an audit row for every view.

type Props = { locale: Locale; m: AdminMessages; t: CommonMessages };
type Status = keyof typeof STATUS_TONES;
type Counts = { members: number; products: number; orders: number; couriers?: number };
type ShopRow = { id: string; name: string; slug: string; plan: string; suspended: boolean; createdAt: string; counts: Counts };
type ShopDetail = ShopRow & {
  currency: "USD" | "LBP";
  members: { id: string; role: string; user: { name: string; email: string }; courier: { name: string } | null }[];
};
type Page<T> = { items: T[]; nextCursor: string | null };
type OrderRow = {
  id: string;
  number: number;
  status: Status;
  customerName: string;
  area: string;
  currency: "USD" | "LBP";
  totalMinor: number;
  createdAt: string;
  courier: { name: string } | null;
};
type AuditRow = { id: string; action: string; shopId: string | null; at: string; admin: { name: string; email: string } };

/** GET once per path (and per reload); errors come back as a message. */
function useApi<T>(path: string) {
  const [state, setState] = useState<{ key: string; data?: T; error?: string }>({ key: "" });
  const [tick, setTick] = useState(0);
  const key = `${path}#${tick}`;
  useEffect(() => {
    let live = true;
    api<T>(path).then(
      (data) => live && setState({ key, data }),
      (e) => live && setState({ key, error: errorMessage(e) }),
    );
    return () => {
      live = false;
    };
  }, [path, key]);
  const current = state.key === key ? state : { key };
  return { ...current, loading: !current.data && !current.error, reload: () => setTick((n) => n + 1) };
}

function Loading({ t, error }: { t: CommonMessages; error?: string }) {
  return error ? <Alert tone="error">{error}</Alert> : <p className="text-sm text-stone-500">{t.loading}</p>;
}

export function ShopsList({ locale, m, t }: Props) {
  const [q, setQ] = useState("");
  const { data, error, loading } = useApi<ShopRow[]>(`/api/admin/shops${q ? `?q=${encodeURIComponent(q)}` : ""}`);
  return (
    <>
      <PageHeader title={m.shops} subtitle={m.auditNote} />
      <form
        role="search"
        className="mb-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setQ(String(new FormData(e.currentTarget).get("q") ?? "").trim());
        }}
      >
        <Input name="q" type="search" placeholder={m.searchShops} aria-label={m.searchShops} maxLength={100} />
        <Button type="submit" tone="secondary">
          {t.search}
        </Button>
      </form>
      {loading || !data ? (
        <Loading t={t} error={error} />
      ) : data.length === 0 ? (
        <EmptyState title={m.noShops} />
      ) : (
        <ul className="flex flex-col gap-2">
          {data.map((s) => (
            <li key={s.id}>
              <Link href={`/admin/shops/${s.id}`} className="block rounded-[var(--radius)] border border-stone-200 bg-white p-4 hover:bg-stone-50">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{s.name}</span>
                  <span className="text-sm text-stone-500">/s/{s.slug}</span>
                  <Badge tone={s.suspended ? "red" : "green"}>{s.suspended ? m.suspended : m.active}</Badge>
                  <Badge>{s.plan}</Badge>
                </div>
                <p className="mt-1 text-sm text-stone-600">
                  {m.members} {s.counts.members} · {m.products} {s.counts.products} · {m.orders} {s.counts.orders} · {formatDate(s.createdAt, locale)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export function ShopView({ id, locale, m, t }: Props & { id: string }) {
  const { data, error, loading, reload } = useApi<ShopDetail>(`/api/admin/shops/${id}`);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  if (loading || !data) return <Loading t={t} error={error} />;

  async function toggle(shop: ShopDetail) {
    if (!window.confirm(fill(shop.suspended ? m.confirmUnsuspend : m.confirmSuspend, { name: shop.name }))) return;
    setBusy(true);
    setActionError(null);
    try {
      await api(`/api/admin/shops/${shop.id}/suspend`, { body: { suspended: !shop.suspended } });
      reload();
    } catch (e) {
      setActionError(errorMessage(e, m.suspendFailed));
    } finally {
      setBusy(false);
    }
  }

  const role = (r: string) => ({ owner: t.roleOwner, manager: t.roleManager, staff: t.roleStaff, delivery: t.roleDelivery })[r] ?? r;
  return (
    <>
      <PageHeader
        title={data.name}
        back={{ href: "/admin", label: m.shops }}
        actions={
          <>
            <Link href={`/admin/shops/${data.id}/orders`} className="inline-flex min-h-11 items-center rounded-[var(--radius)] border border-stone-300 bg-white px-4 text-sm font-medium hover:bg-stone-50">
              {m.viewOrders}
            </Link>
            <Button tone={data.suspended ? "primary" : "danger"} disabled={busy} onClick={() => toggle(data)}>
              {data.suspended ? m.unsuspend : m.suspend}
            </Button>
          </>
        }
      />
      {actionError && <Alert tone="error" className="mb-3">{actionError}</Alert>}
      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <DefinitionList
            items={[
              { label: m.status, value: <Badge tone={data.suspended ? "red" : "green"}>{data.suspended ? m.suspended : m.active}</Badge> },
              { label: m.slug, value: `/s/${data.slug}` },
              { label: m.plan, value: data.plan },
              { label: m.currency, value: data.currency },
              { label: m.created, value: formatDate(data.createdAt, locale) },
              { label: m.members, value: data.counts.members },
              { label: m.products, value: data.counts.products },
              { label: m.orders, value: data.counts.orders },
              { label: m.couriers, value: data.counts.couriers ?? 0 },
            ]}
          />
        </Card>
        <Card>
          <h2 className="mb-2 font-semibold">{m.members}</h2>
          {data.members.length === 0 ? (
            <p className="text-sm text-stone-500">{m.noMembers}</p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {data.members.map((mem) => (
                <li key={mem.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="block font-medium">{mem.user.name}</span>
                    <span className="block break-all text-stone-500">{mem.user.email}</span>
                    {mem.courier && <span className="block text-stone-500">{fill(m.courierLink, { name: mem.courier.name })}</span>}
                  </span>
                  <Badge>{role(mem.role)}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

/** Cursor pages: each "Load more" mounts the next page, which fetches itself. */
function Paged<T>({ path, empty, render, t }: { path: string; empty: string; render: (item: T) => React.ReactNode; t: CommonMessages }) {
  const [cursors, setCursors] = useState<string[]>([""]);
  return (
    <ul className="flex flex-col gap-2">
      {cursors.map((c, i) => (
        <PageOf<T>
          key={c}
          path={c ? `${path}?cursor=${encodeURIComponent(c)}` : path}
          first={i === 0}
          last={i === cursors.length - 1}
          empty={empty}
          render={render}
          t={t}
          onMore={(next) => setCursors((all) => [...all, next])}
        />
      ))}
    </ul>
  );
}

function PageOf<T>(p: { path: string; first: boolean; last: boolean; empty: string; render: (item: T) => React.ReactNode; t: CommonMessages; onMore: (cursor: string) => void }) {
  const { data, error, loading } = useApi<Page<T>>(p.path);
  if (loading || !data) return <li><Loading t={p.t} error={error} /></li>;
  return (
    <>
      {p.first && data.items.length === 0 && <li><EmptyState title={p.empty} /></li>}
      {data.items.map(p.render)}
      {p.last && data.nextCursor && (
        <li>
          <Button tone="secondary" block onClick={() => p.onMore(data.nextCursor!)}>
            {p.t.loadMore}
          </Button>
        </li>
      )}
    </>
  );
}

export function ShopOrders({ id, locale, m, t }: Props & { id: string }) {
  const shop = useApi<ShopRow>(`/api/admin/shops/${id}`);
  return (
    <>
      <PageHeader title={shop.data ? fill(m.shopOrders, { name: shop.data.name }) : m.orders} back={{ href: `/admin/shops/${id}`, label: shop.data?.name ?? m.shops }} />
      <Paged<OrderRow>
        path={`/api/admin/shops/${id}/orders`}
        empty={m.noOrders}
        t={t}
        render={(o) => (
          <li key={o.id}>
            <Card className="flex flex-col gap-1 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">
                  #{o.number} · {o.customerName}
                </span>
                <Badge tone={STATUS_TONES[o.status]}>{t[`status${o.status}` as keyof CommonMessages]}</Badge>
              </div>
              <div className="flex flex-wrap justify-between gap-2 text-stone-600">
                <span>{[o.area, o.courier?.name, formatDateTime(o.createdAt, locale)].filter(Boolean).join(" · ")}</span>
                <span className="font-medium tabular-nums text-stone-900">{formatMoney(o.totalMinor, o.currency, locale)}</span>
              </div>
            </Card>
          </li>
        )}
      />
    </>
  );
}

export function AuditLog({ locale, m, t }: Props) {
  return (
    <>
      <PageHeader title={m.auditLog} subtitle={m.auditNote} />
      <Paged<AuditRow>
        path="/api/admin/audit-log"
        empty={m.noEntries}
        t={t}
        render={(a) => (
          <li key={a.id} className="rounded-[var(--radius)] border border-stone-200 bg-white p-3 text-sm">
            <div className="flex flex-wrap justify-between gap-2">
              <span className="font-medium">{a.admin.name}</span>
              <span className="text-stone-500">{formatDateTime(a.at, locale)}</span>
            </div>
            <code dir="ltr" className="mt-1 block break-all text-xs text-stone-700">
              {a.action}
            </code>
            {a.shopId && (
              <Link href={`/admin/shops/${a.shopId}`} className="inline-flex min-h-11 items-center text-[var(--brand)] hover:underline">
                {m.shop}
              </Link>
            )}
          </li>
        )}
      />
    </>
  );
}
