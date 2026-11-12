import Link from "next/link";
import { fill } from "@/i18n/locale";
import { common, type CommonMessages } from "@/i18n/messages/common";
import { cashMessages } from "@/i18n/messages/money";
import { getLocale } from "@/i18n/server";
import { formatMoney } from "@/lib/format";
import { can } from "@/server/domain/policy";
import { openCashExposure } from "@/server/domain/reconcile";
import { courierService } from "@/server/services/courierService";
import { remittanceService } from "@/server/services/remittanceService";
import { reportingService } from "@/server/services/reportingService";
import { PageHeader } from "@/components/ui";
import { OrderCashResolution } from "./CashResolutionActions";
import { pageActor } from "../../_server/session";
import { DashIcon } from "../_components/DashIcon";
import { dayMonthYear } from "../orders/_components/labels";
import { hasUnsettledOrder, openIssues } from "./openIssues";
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

  const canRemit = can(actor.role, "remittance.write");
  // A deactivated courier who still owes cash stays pickable, or the debt could never be settled.
  const remitCouriers = canRemit ? (await Promise.all(couriers.map(async (c) => (c.active || (await remittanceService.unsettled(actor, c.id)).length > 0 ? [{ id: c.id, name: c.name }] : [])))).flat() : [];

  const issues = openIssues(rec.couriers);
  // Only fees recorded on remittances received in the selected period.
  // Each fee uses its order's currency; do not silently combine USD and LBP.
  const feesKept = remittances.reduce(
    (total, remittance) => {
      for (const line of remittance.lines) {
        if (line.order.currency === "USD") total.usdCents += line.feeMinor;
        else total.lbp += line.feeMinor;
      }
      return total;
    },
    { usdCents: 0n, lbp: 0n },
  );
  const feesKeptLabel = cash(feesKept, locale) || money(0n);
  const issueExposure = openCashExposure(rec.couriers);
  const remittanceShortages = rec.couriers.flatMap((c) => c.remittanceGaps).reduce((s, r) => s + (r.diffMinor < 0n ? -r.diffMinor : 0n), 0n);
  const unpaid = rec.couriers.reduce((sum, c) => sum + c.unpaid.reduce((s, r) => s + r.dueMinor, 0n), 0n);
  // Only remittances in this period get a row to link to.
  const remittanceOfOrder = new Map(remittances.flatMap((r) => r.lines.map((l) => [l.orderId, r] as const)));
  const gapOfRemittance = new Map(issues.remittances.map((r) => [r.remittanceId, r]));

  const handed = cash(rec.totals.received, locale);
  const tiles = [
    { label: m.tileDue, value: money(rec.totals.expectedMinor), hint: m.tileDueHint, tone: "" },
    { label: m.tileHanded, value: money(rec.totals.receivedMinor), hint: m.tileHandedHint, extra: handed !== money(rec.totals.receivedMinor) ? handed : "", tone: "green" },
    { label: m.tileFeesKept, value: feesKeptLabel, hint: m.tileFeesKeptHint, extra: "", tone: "" },
    { label: m.tileUnpaid, value: money(unpaid), hint: m.tileUnpaidHint, tone: unpaid > 0n ? "red" : "" },
    { label: m.tileIssues, value: String(issues.count), hint: fill(m.tileIssuesHint, { short: money(remittanceShortages) }), tone: issues.count > 0 ? "red" : "" },
  ];

  return (
    <>
      <PageHeader
        title={m.title}
        subtitle={m.subtitle}
        actions={
          canRemit && <RemittanceForm couriers={remitCouriers} today={new Date().toISOString().slice(0, 10)} locale={locale} m={m} />
        }
      />
      <PeriodForm from={rec.from} to={rec.to} courierId={courierId} couriers={couriers.map((c) => ({ id: c.id, name: c.name }))} labels={m} />

      <div className="mb-[15px] grid grid-cols-1 gap-[15px] sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
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
          <DashIcon name="warning" size="sm" /> <b>{m.whyTitle}</b> {fill(m.cashExplanation, { unremitted: money(unpaid), short: money(remittanceShortages), n: issues.count })}
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
                    {(o.shortOrOver || o.doorstep) && <OrderCashResolution orderId={o.orderId} m={m} />}
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

      {rec.acceptedOrderDecisions.length > 0 && <section className="card">
        <h2>{m.acceptedOrderHistory}</h2>
        <p className="hint">{m.acceptedExplanation}</p>
        {rec.acceptedOrderDecisions.map((x) => <div key={x.orderId} className="line-item">
          <div><Link href={`/dashboard/orders/${x.orderId}`} className="font-bold underline">{fill(m.orderLink, { n: x.order.number })}</Link><p className="hint mt-1">{x.reason}</p></div>
        </div>)}
      </section>}

      <section className="card">
        <div className="sectionbar">
          <h2 className="m-0">{m.byCourier}</h2>
          <span className="hint">{fill(m.totalGaps, { amount: money(issueExposure.sumMinor), n: issueExposure.count })}</span>
        </div>
        {rec.couriers.length === 0 ? (
          <div className="empty">{m.noActivity}</div>
        ) : (
          rec.couriers.map((c) => {
            // shortcut: reconcile() returns no per-courier reported total, so orders without a doorstep gap count as reported = due; add reportedMinor to reconcile() for the exact figure.
            const reported = c.reportedMinor;
            const open = openIssues([c]).count;
            const exposure = openCashExposure([c]);
            const received = cash(c.received, locale);
            const figures = [
              { label: m.due, value: money(c.expectedMinor) },
              { label: m.reported, value: money(reported) },
              { label: m.remitted, value: money(c.receivedMinor), hint: received !== money(c.receivedMinor) ? received : "" },
              { label: m.gap, value: money(exposure.sumMinor), hint: `${fill(m.gapsHint, { n: exposure.count })} · ${m.openDifferenceFormula}`, red: exposure.count > 0 },
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
                        <bdi>{cash({ usdCents: r.amountUsdCents + r.supplements.reduce((a, s) => a + s.amountUsdCents, 0n), lbp: r.amountLbp + r.supplements.reduce((a, s) => a + s.amountLbp, 0n) }, locale) || money(0n)}</bdi>
                      </td>
                      <td>
                        {r.resolution && !hasUnsettledOrder(r.lines, rec.couriers) ? (
                          <span className="mini-badge gray">{m.acceptedStatus}</span>
                        ) : gap ? (
                          <span className="mini-badge red">{fill(gap.diffMinor < 0n ? m.badgeShort : m.badgeOver, { amount: money(abs(gap.diffMinor)) })}</span>
                        ) : hasUnsettledOrder(r.lines, rec.couriers) ? (
                          <span className="mini-badge red">{m.needsReview}</span>
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
