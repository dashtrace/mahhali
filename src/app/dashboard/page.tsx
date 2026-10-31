import { AutoRefresh } from "@/components/AutoRefresh";
import { ButtonLink, Alert, PageHeader } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { common } from "@/i18n/messages/common";
import { orderMessages } from "@/i18n/messages/orders";
import { getLocale } from "@/i18n/server";
import { ORDER_STATUSES, type OrderStatus } from "@/server/domain/orderStatus";
import { can } from "@/server/domain/policy";
import { plain } from "@/server/http/json";
import { accountService } from "@/server/services/accountService";
import { courierService } from "@/server/services/courierService";
import { orderService } from "@/server/services/orderService";
import { appUrl } from "@/server/mail/mailer";
import { pageActor } from "../_server/session";
import { BoardClient, CourierFilter, CopyLink } from "./_components/Board";

export const metadata = { title: "Orders" };

const ACTIVE: OrderStatus[] = ["NEW", "CONFIRMED", "PACKED", "OUT_FOR_DELIVERY"];

export default async function OrdersBoardPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; courierId?: string; q?: string; welcome?: string }>;
}) {
  const actor = await pageActor("order.read", "/dashboard");
  const sp = await searchParams;
  const locale = await getLocale();
  const m = orderMessages[locale];
  const t = common[locale];
  const selected = (ORDER_STATUSES as readonly string[]).includes(sp.status ?? "") ? (sp.status as OrderStatus) : "NEW";
  const courierId = sp.courierId || undefined;
  const q = sp.q?.trim() || undefined;

  const load = (status?: OrderStatus) => orderService.list(actor, { status, courierId, q, limit: 50 });
  const [me, couriers, ...lists] = await Promise.all([
    accountService.me(actor),
    courierService.list(actor, {}),
    ...(q ? [load()] : [...ACTIVE.map((s) => load(s)), ...(ACTIVE.includes(selected) ? [] : [load(selected)])]),
  ]);

  const columns: Partial<Record<OrderStatus, unknown[]>> = {};
  if (!q) {
    ACTIVE.forEach((s, i) => (columns[s] = lists[i].orders));
    if (!ACTIVE.includes(selected)) columns[selected] = lists[4].orders;
  }

  return (
    <>
      <PageHeader
        title={m.boardTitle}
        actions={
          can(actor.role, "order.create") && (
            <ButtonLink href="/dashboard/orders/new">
              <Icon name="plus" />
              {m.newOrder}
            </ButtonLink>
          )
        }
      />
      {sp.welcome && <Alert tone="success" className="mb-4">{m.welcome}</Alert>}
      <div className="mb-4 flex flex-col gap-3">
        <form
          role="search"
          className="flex h-11 items-center gap-2.5 rounded-full border border-sl-border bg-sl-panel px-3.5 shadow-[0_4px_15px_#15181d05] focus-within:outline-2 focus-within:outline-sl-accent sm:max-w-md"
        >
          {courierId && <input type="hidden" name="courierId" value={courierId} />}
          <Icon name="search" className="size-[18px] shrink-0 text-sl-muted" />
          <input
            name="q"
            type="search"
            defaultValue={q}
            placeholder={m.searchPlaceholder}
            aria-label={t.search}
            className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-sl-muted sm:text-sm"
          />
        </form>
        {couriers.length > 0 && (
          <CourierFilter couriers={couriers.map((c) => ({ id: c.id, name: c.name }))} value={courierId ?? ""} label={m.filterCourier} allLabel={m.allCouriers} />
        )}
      </div>
      {/* New guest orders show up without a reload. */}
      <AutoRefresh seconds={15} />
      <BoardClient
        // Remount on navigation so the phone tab follows ?status=
        key={`${selected}:${q ?? ""}:${courierId ?? ""}`}
        columns={plain(columns) as never}
        searchResults={q ? (plain(lists[0].orders) as never) : null}
        counts={lists[0].counts}
        selected={selected}
        locale={locale}
        m={m}
        t={t}
      />
      <CopyLink url={appUrl(`/s/${me.shop.slug}`)} label={m.catalogueLink} copy={m.copyLink} copied={m.copied} />
    </>
  );
}
