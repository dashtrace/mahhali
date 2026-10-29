"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { Alert, Badge, Button, ButtonLink, Card, DefinitionList, EmptyState, PageHeader, STATUS_TONES } from "@/components/ui";
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

/** Skeleton rows while a request runs; the text is for screen readers. */
function Loading({ t, error }: { t: CommonMessages; error?: string }) {
  if (error) return <Alert tone="error">{error}</Alert>;
  return (
    <div role="status" className="flex flex-col gap-2">
      <span className="sr-only">{t.loading}</span>
      {[0, 1, 2].map((i) => (
        <div key={i} aria-hidden className="h-[72px] rounded-sl-lg bg-sl-cat motion-safe:animate-pulse" />
      ))}
    </div>
  );
}

/** The read-only banner: every admin page view is written to the audit log. */
function ReadOnlyNote({ m }: { m: AdminMessages }) {
  return (
    <Alert tone="note" className="mb-4 flex items-start gap-2.5">
      <Icon name="shield" className="mt-px size-[18px] shrink-0 text-sl-accent" />
      {m.auditNote}
    </Alert>
  );
}

const planName = (m: AdminMessages, plan: string) => (m as Record<string, string>)[`plan_${plan}`] ?? plan;

const rowLink ="flex min-h-11 items-center gap-3 rounded-sl-lg border border-sl-border bg-sl-panel p-3.5 shadow-[0_2px_10px_#00000006] hover:border-sl-accent";

export function ShopsList({ locale, m, t }: Props) {
  const [q, setQ] = useState("");
  const { data, error, loading } = useApi<ShopRow[]>(`/api/admin/shops${q ? `?q=${encodeURIComponent(q)}` : ""}`);
  return (
    <>
      <PageHeader title={m.shops} />
      <ReadOnlyNote m={m} />
      <form
        role="search"
        className="mb-4 flex h-11 items-center gap-2.5 rounded-full border border-sl-border bg-sl-panel ps-3.5 shadow-[0_4px_15px_#15181d05] focus-within:outline-2 focus-within:outline-sl-accent"
        onSubmit={(e) => {
          e.preventDefault();
          setQ(String(new FormData(e.currentTarget).get("q") ?? "").trim());
        }}
      >
        <Icon name="search" className="size-[18px] shrink-0 text-sl-muted" />
        <input
          name="q"
          type="search"
          placeholder={m.searchShops}
          aria-label={m.searchShops}
          maxLength={100}
          className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-sl-muted"
        />
        <button type="submit" className="inline-flex h-11 shrink-0 items-center rounded-full px-4 text-sm font-bold text-sl-accent">
          {t.search}
        </button>
      </form>
      {loading || !data ? (
        <Loading t={t} error={error} />
      ) : data.length === 0 ? (
        <EmptyState title={m.noShops} />
      ) : (
        <ul className="flex flex-col gap-2">
          {data.map((s) => (
            <li key={s.id}>
              <Link href={`/admin/shops/${s.id}`} className={rowLink}>
                <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-full bg-sl-cat text-base font-extrabold text-sl-accent">
                  {s.name.trim().slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-extrabold">{s.name}</span>
                    <Badge tone={s.suspended ? "red" : "green"}>{s.suspended ? m.suspended : m.active}</Badge>
                    <Badge>{planName(m, s.plan)}</Badge>
                  </span>
                  <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-sl-muted">
                    <bdi dir="ltr" className="break-all">/s/{s.slug}</bdi>
                    <span>{formatDate(s.createdAt, locale)}</span>
                  </span>
                  <span className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-sl-muted">
                    {[
                      [m.orders, s.counts.orders],
                      [m.products, s.counts.products],
                      [m.members, s.counts.members],
                    ].map(([label, n]) => (
                      <span key={label}>
                        {label} <b className="font-bold text-sl-fg tabular-nums">{n}</b>
                      </span>
                    ))}
                  </span>
                </span>
                <Icon name="next" className="size-4 shrink-0 text-sl-muted" />
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
  const counts = [
    { label: m.orders, value: data.counts.orders },
    { label: m.products, value: data.counts.products },
    { label: m.members, value: data.counts.members },
    { label: m.couriers, value: data.counts.couriers ?? 0 },
  ];
  return (
    <>
      <PageHeader
        title={data.name}
        back={{ href: "/admin", label: m.shops }}
        actions={
          <>
            <ButtonLink href={`/admin/shops/${data.id}/orders`} tone="secondary">
              {m.viewOrders}
            </ButtonLink>
            <Button tone={data.suspended ? "primary" : "danger"} disabled={busy} onClick={() => toggle(data)}>
              {data.suspended ? m.unsuspend : m.suspend}
            </Button>
          </>
        }
      />
      <ReadOnlyNote m={m} />
      {actionError && <Alert tone="error" className="mb-3">{actionError}</Alert>}
      <dl className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {counts.map((c) => (
          <div key={c.label} className="rounded-sl-lg border border-sl-border bg-sl-panel px-3.5 py-3">
            <dt className="text-xs font-bold text-sl-muted">{c.label}</dt>
            <dd className="text-2xl font-extrabold tabular-nums">{c.value}</dd>
          </div>
        ))}
      </dl>
      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <DefinitionList
            items={[
              { label: m.status, value: <Badge tone={data.suspended ? "red" : "green"}>{data.suspended ? m.suspended : m.active}</Badge> },
              { label: m.slug, value: <bdi dir="ltr">/s/{data.slug}</bdi> },
              { label: m.plan, value: planName(m, data.plan) },
              { label: m.currency, value: data.currency },
              { label: m.created, value: formatDate(data.createdAt, locale) },
            ]}
          />
        </Card>
        <Card>
          <h2 className="sl-heading mb-1 text-lg">{m.members}</h2>
          {data.members.length === 0 ? (
            <p className="text-sm text-sl-muted">{m.noMembers}</p>
          ) : (
            <ul>
              {data.members.map((mem) => (
                <li key={mem.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-sl-border py-2.5 text-sm last:border-b-0">
                  <span className="min-w-0">
                    <span className="block font-bold">{mem.user.name}</span>
                    <span dir="ltr" className="block break-all text-xs text-sl-muted">
                      {mem.user.email}
                    </span>
                    {mem.courier && <span className="block text-xs text-sl-muted">{fill(m.courierLink, { name: mem.courier.name })}</span>}
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
  if (loading || !data)
    return (
      <li>
        <Loading t={p.t} error={error} />
      </li>
    );
  return (
    <>
      {p.first && data.items.length === 0 && (
        <li>
          <EmptyState title={p.empty} />
        </li>
      )}
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

const minirow = "rounded-sl-lg border border-sl-border bg-sl-panel px-3.5 py-3 text-sm";

export function ShopOrders({ id, locale, m, t }: Props & { id: string }) {
  const shop = useApi<ShopRow>(`/api/admin/shops/${id}`);
  return (
    <>
      <PageHeader title={shop.data ? fill(m.shopOrders, { name: shop.data.name }) : m.orders} back={{ href: `/admin/shops/${id}`, label: shop.data?.name ?? m.shops }} />
      <ReadOnlyNote m={m} />
      <Paged<OrderRow>
        path={`/api/admin/shops/${id}/orders`}
        empty={m.noOrders}
        t={t}
        render={(o) => (
          <li key={o.id} className={minirow}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-extrabold">
                <bdi className="tabular-nums">#{o.number}</bdi> · {o.customerName}
              </span>
              <Badge tone={STATUS_TONES[o.status]}>{t[`status${o.status}` as keyof CommonMessages]}</Badge>
            </div>
            <div className="mt-1 flex flex-wrap items-end justify-between gap-2 text-xs text-sl-muted">
              <span className="flex flex-wrap gap-x-2">
                {[o.area, o.courier?.name, formatDateTime(o.createdAt, locale)]
                  .filter(Boolean)
                  .map((part, i) => (
                    <bdi key={i}>{part}</bdi>
                  ))}
              </span>
              <bdi dir="ltr" className="text-sm font-extrabold tabular-nums text-sl-fg">
                {formatMoney(o.totalMinor, o.currency, locale)}
              </bdi>
            </div>
          </li>
        )}
      />
    </>
  );
}

export function AuditLog({ locale, m, t }: Props) {
  return (
    <>
      <PageHeader title={m.auditLog} />
      <ReadOnlyNote m={m} />
      <Paged<AuditRow>
        path="/api/admin/audit-log"
        empty={m.noEntries}
        t={t}
        render={(a) => (
          <li key={a.id} className={minirow}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-bold">{a.admin.name}</span>
              <time dateTime={a.at} className="text-xs text-sl-muted tabular-nums">
                {formatDateTime(a.at, locale)}
              </time>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <code dir="ltr" className="min-w-0 flex-1 break-all rounded-sl-sm bg-sl-bg px-2 py-1 text-start text-xs">
                {a.action}
              </code>
              {a.shopId && (
                <Link href={`/admin/shops/${a.shopId}`} className="-my-2 inline-flex min-h-11 shrink-0 items-center gap-1 px-1 text-sm font-bold text-sl-accent hover:underline">
                  {m.shop}
                  <Icon name="arrow" className="size-4" />
                </Link>
              )}
            </div>
          </li>
        )}
      />
    </>
  );
}
