import Link from "next/link";
import { fill } from "@/i18n/locale";
import { common, type CommonMessages } from "@/i18n/messages/common";
import { cashMessages } from "@/i18n/messages/money";
import { getLocale } from "@/i18n/server";
import { formatMoney } from "@/lib/format";
import { can } from "@/server/domain/policy";
import { courierService } from "@/server/services/courierService";
import { remittanceService } from "@/server/services/remittanceService";
import { reportingService } from "@/server/services/reportingService";
import { PageHeader } from "@/components/ui";
import { pageActor } from "../../_server/session";
import { DashIcon } from "../_components/DashIcon";
import { dayMonthYear } from "../orders/_components/labels";
import { openIssues } from "./openIssues";
import { readPeriod } from "./period";
import { PeriodForm } from "./PeriodForm";
import { cash, remittanceHref, remittanceRef, reportedOf } from "./remittance";
import { RemittanceForm } from "./RemittanceForm";

export const metadata = { title: "Cash" };

const abs = (v: bigint) => (v < 0n ? -v : v);

export default async function CashPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; courierId?: string }> }) {
  const actor = await pageActor("reconciliation.read", "/dashboard/cash");
  const sp = await searchParams;
  const locale = await getLocale();
  const m = cashMessages[locale];
  const t = common[locale];

  const couriers = await courierService.list(actor, {});
  // An id that isn't this shop's would be a 404 from the services; treat it as no filter.
  const courierId = couriers.some((c) => c.id === sp.courierId) ? sp.courierId : undefined;
  const query = { ...readPeriod(sp), courierId };
  const [rec, { remittances }] = await Promise.all([reportingService.reconciliation(actor, query), remittanceService.list(actor, query)]);

  const money = (v: bigint) => formatMoney(v, rec.currency, locale);
  const courierName = (id: string) => couriers.find((c) => c.id === id)?.name ?? m.noCourierName;

  const issues = openIssues(rec.couriers);
  const unpaid = rec.couriers.reduce((sum, c) => sum + c.unpaid.reduce((s, r) => s + r.dueMinor, 0n), 0n);
  // Only remittances in this period get a row to link to.
  const remittanceOfOrder = new Map(remittances.flatMap((r) => r.lines.map((l) => [l.orderId, r] as const)));
  const gapOfRemittance = new Map(issues.remittances.map((r) => [r.remittanceId, r]));

  const handed = cash(rec.totals.received, locale);
  const tiles = [
    { label: m.tileDue, value: money(rec.totals.expectedMinor), hint: m.tileDueHint, tone: "" },
    { label: m.tileHanded, value: money(rec.totals.receivedMinor), hint: m.tileHandedHint, extra: handed !== money(rec.totals.receivedMinor) ? handed : "", tone: "green" },
    { label: m.tileUnpaid, value: money(unpaid), hint: m.tileUnpaidHint, tone: unpaid > 0n ? "red" : "" },
    { label: m.tileIssues, value: String(issues.count), hint: m.tileIssuesHint, tone: issues.count > 0 ? "red" : "" },
  ];

  return (
    <>
      <PageHeader
        title={m.title}
        subtitle={m.subtitle}
        actions={
          can(actor.role, "remittance.write") && (
            <RemittanceForm couriers={couriers.filter((c) => c.active).map((c) => ({ id: c.id, name: c.name }))} today={new Date().toISOString().slice(0, 10)} locale={locale} m={m} />
          )
        }
      />
      <PeriodForm from={rec.from} to={rec.to} courierId={courierId} couriers={couriers.map((c) => ({ id: c.id, name: c.name }))} labels={m} />

      <div className="split4 mb-[15px]">
        {tiles.map((tile) => (
          <div key={tile.label} className="stat">
            <div className="eyebrow">{tile.label}</div>
            <div className={`number ${tile.tone}`}>
              <bdi>{tile.value}</bdi>
            </div>
            <div className="sub">
              {tile.hint}
              {tile.extra && (
                <>
                  <br />
                  <bdi>{tile.extra}</bdi>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {issues.count > 0 && (
        <div className="callout">
          <DashIcon name="warning" size="sm" /> <b>{m.whyTitle}</b> {fill(issues.count === 1 ? m.whyFiguresOne : m.whyFigures, { unpaid: money(unpaid), n: issues.count })} {fill(m.whyBefore, { zero: money(0n) })} <b>{m.whyNot}</b> {m.whyAfter}
        </div>
      )}

      <section className="card">
        <div className="sectionbar">
          <h2 className="m-0">{m.attention}</h2>
          <span className={`mini-badge ${issues.count ? "red" : "green"}`}>{fill(m.unresolved, { n: issues.count })}</span>
        </div>
        <p className="hint">{m.attentionHint}</p>
        {issues.count === 0 ? (
          <div className="empty">{m.noIssues}</div>
        ) : (
          <>
            {issues.orders.map((o) => {
              const remittance = remittanceOfOrder.get(o.orderId);
              const so = o.shortOrOver;
              const texts = [
                so && fill(so.diffMinor < 0n ? m.shortBy : m.overBy, { amount: money(abs(so.diffMinor)), due: money(so.dueMinor), paid: money(so.paidMinor) }),
                o.mismatch && fill(m.mismatch, { amount: money(o.mismatch.paidMinor), status: t[`status${o.mismatch.status}` as keyof CommonMessages] }),
                o.unpaid &&
                  fill(o.unpaid.daysOutstanding < 1 ? m.unpaidToday : o.unpaid.daysOutstanding === 1 ? m.unpaidOneDay : o.unpaid.daysOutstanding >= 3 && o.unpaid.daysOutstanding <= 10 ? m.unpaidFewDays : m.unpaidFor, {
                    amount: money(o.unpaid.dueMinor),
                    days: o.unpaid.daysOutstanding,
                  }),
                o.doorstep && fill(m.doorstep, { reported: money(o.doorstep.reportedMinor), due: money(o.doorstep.dueMinor) }),
              ];
              return (
                <div key={o.orderId} className="line-item">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-[9px]">
                      {so && <span className="mini-badge red">{fill(so.diffMinor < 0n ? m.badgeShort : m.badgeOver, { amount: money(abs(so.diffMinor)) })}</span>}
                      {o.mismatch && <span className="mini-badge red">{m.kindMismatch}</span>}
                      {o.unpaid && <span className="mini-badge amber">{fill(m.badgeUnpaid, { amount: money(o.unpaid.dueMinor) })}</span>}
                      {o.doorstep && <span className="mini-badge amber">{m.kindDoorstep}</span>}
                      <b>{remittance ? remittanceRef(remittance.id, remittance.reference) : courierName(o.courierId)}</b>
                      <Link href={`/dashboard/orders/${o.orderId}`} className="text-xs font-extrabold text-(--blue) hover:underline">
                        {fill(m.orderLink, { n: o.number })}
                      </Link>
                    </div>
                    <p className="hint mt-1.5 mb-0">{texts.filter(Boolean).join(" · ")}</p>
                  </div>
                  {remittance && (
                    <Link href={remittanceHref(remittance.id)} className="btn tiny">
                      {m.viewRemittance} <DashIcon name="arrow" size="tiny" />
                    </Link>
                  )}
                </div>
              );
            })}
            {issues.remittances.map((r) => {
              const row = remittances.find((x) => x.id === r.remittanceId);
              return (
                <div key={r.remittanceId} className="line-item">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-[9px]">
                      <span className="mini-badge red">{fill(r.diffMinor < 0n ? m.badgeShort : m.badgeOver, { amount: money(abs(r.diffMinor)) })}</span>
                      <b>{remittanceRef(r.remittanceId, r.reference)}</b>
                      {row?.lines.map((l) => (
                        <Link key={l.id} href={`/dashboard/orders/${l.orderId}`} className="text-xs font-extrabold text-(--blue) hover:underline">
                          {fill(m.orderLink, { n: l.order.number })}
                        </Link>
                      ))}
                    </div>
                    <p className="hint mt-1.5 mb-0">{fill(r.diffMinor < 0n ? m.remittanceShort : m.remittanceGap, { diff: money(abs(r.diffMinor)) })}</p>
                  </div>
                  <Link href={remittanceHref(r.remittanceId)} className="btn tiny">
                    {m.viewRemittance} <DashIcon name="arrow" size="tiny" />
                  </Link>
                </div>
              );
            })}
          </>
        )}
      </section>

      <section className="card">
        <div className="sectionbar">
          <h2 className="m-0">{m.byCourier}</h2>
          <span className="hint">{fill(m.totalGaps, { amount: money(rec.totals.gaps.sumMinor), n: rec.totals.gaps.count })}</span>
        </div>
        {rec.couriers.length === 0 ? (
          <div className="empty">{m.noActivity}</div>
        ) : (
          rec.couriers.map((c) => {
            // shortcut: reconcile() returns no per-courier reported total, so orders without a doorstep gap count as reported = due; add reportedMinor to reconcile() for the exact figure.
            const reported = c.expectedMinor + c.doorstepGaps.reduce((sum, r) => sum + r.diffMinor, 0n);
            const open = openIssues([c]).count;
            const received = cash(c.received, locale);
            const figures = [
              { label: m.due, value: money(c.expectedMinor) },
              { label: m.reported, value: money(reported) },
              { label: m.remitted, value: money(c.receivedMinor), hint: received !== money(c.receivedMinor) ? received : "" },
              { label: m.gap, value: money(c.gaps.sumMinor), hint: fill(m.gapsHint, { n: c.gaps.count }), red: c.gaps.count > 0 },
            ];
            return (
              <div key={c.courierId} className="line-item block">
                <div className="between wrap">
                  <div className="flex min-w-0 flex-wrap items-center gap-[9px]">
                    <b className="min-w-0 break-words">{c.courierName ?? m.noCourierName}</b>
                    <span className={`mini-badge ${open ? "red" : "green"}`}>{open ? fill(m.unresolved, { n: open }) : m.allClear}</span>
                  </div>
                  {courierId !== c.courierId && (
                    <Link href={`?${new URLSearchParams({ from: rec.from, to: rec.to, courierId: c.courierId })}`} className="btn tiny">
                      {m.showCourier}
                    </Link>
                  )}
                </div>
                <dl className="split4 mt-3 mb-0">
                  {figures.map((f) => (
                    <div key={f.label} className="min-w-0">
                      <dt className="hint">{f.label}</dt>
                      <dd className={`bold m-0 tabular-nums ${f.red ? "text-(--red)" : ""}`}>
                        <bdi>{f.value}</bdi>
                      </dd>
                      {f.hint && (
                        <dd className="hint m-0">
                          <bdi>{f.hint}</bdi>
                        </dd>
                      )}
                    </div>
                  ))}
                </dl>
              </div>
            );
          })
        )}
      </section>

      <section className="card">
        <div className="sectionbar">
          <h2 className="m-0">{m.pastTitle}</h2>
          <span className="hint">{m.newestFirst}</span>
        </div>
        {remittances.length === 0 ? (
          <div className="empty">{m.noRemittances}</div>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>{m.thRemittance}</th>
                  <th>{m.courier}</th>
                  <th>{m.thReported}</th>
                  <th>{m.thReceived}</th>
                  <th>{m.thDifference}</th>
                  <th aria-label={m.details} />
                </tr>
              </thead>
              <tbody>
                {remittances.map((r) => {
                  const gap = gapOfRemittance.get(r.id);
                  return (
                    <tr key={r.id}>
                      <td>
                        <b className="whitespace-nowrap">{remittanceRef(r.id, r.reference)}</b>
                        <div className="hint whitespace-nowrap">{dayMonthYear(r.receivedAt.toISOString(), locale)}</div>
                      </td>
                      <td>{courierName(r.courierId)}</td>
                      <td>
                        <bdi>{cash(reportedOf(r, rec.currency), locale) || money(0n)}</bdi>
                      </td>
                      <td>
                        <bdi>{cash({ usdCents: r.amountUsdCents, lbp: r.amountLbp }, locale) || money(0n)}</bdi>
                      </td>
                      <td>
                        {gap ? (
                          <span className="mini-badge red">{fill(gap.diffMinor < 0n ? m.badgeShort : m.badgeOver, { amount: money(abs(gap.diffMinor)) })}</span>
                        ) : (
                          <span className="mini-badge gray">{m.settled}</span>
                        )}
                      </td>
                      <td>
                        <Link href={remittanceHref(r.id)} className="btn tiny">
                          {m.details}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
