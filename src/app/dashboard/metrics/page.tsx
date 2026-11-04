import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { fill, type Locale } from "@/i18n/locale";
import { common, type CommonMessages } from "@/i18n/messages/common";
import { cashMessages, metricsMessages, type MetricsMessages } from "@/i18n/messages/money";
import { getLocale } from "@/i18n/server";
import { formatMoney, formatNumber } from "@/lib/format";
import { ORDER_STATUSES } from "@/server/domain/orderStatus";
import { can } from "@/server/domain/policy";
import { accountService } from "@/server/services/accountService";
import { reportingService } from "@/server/services/reportingService";
import { pageActor } from "../../_server/session";
import { DashIcon } from "../_components/DashIcon";
import { PeriodForm } from "../cash/PeriodForm";
import { readPeriod } from "../cash/period";

export const metadata = { title: "Metrics" };

function duration(minutes: number, m: MetricsMessages, locale: Locale) {
  const total = Math.round(minutes);
  if (total < 60) return fill(m.minutes, { n: formatNumber(total, locale) });
  return fill(m.hours, { h: formatNumber(Math.floor(total / 60), locale), m: formatNumber(total % 60, locale) });
}

export default async function MetricsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const actor = await pageActor("metrics.read", "/dashboard/metrics");
  const period = readPeriod(await searchParams);
  const locale = await getLocale();
  const m = metricsMessages[locale];
  const t = common[locale];
  const [data, me] = await Promise.all([reportingService.metrics(actor, period), accountService.me(actor)]);
  const { baseline } = data;
  const median = data.medianConfirmMinutes;
  const created = formatNumber(data.ordersCreated, locale);
  const perDay = formatNumber(data.ordersPerDay, locale, 1);
  const hasGaps = data.codGaps.count > 0;

  const speedMax = Math.max(1, baseline.confirmMinutes ?? 0, median ?? 0);
  const speedRows = [
    baseline.confirmMinutes !== null && { label: m.before, value: baseline.confirmMinutes, colour: "#b3c1c4" },
    median !== null && { label: m.during, value: median, colour: "#2c8495" },
  ].filter((r) => r !== false);
  const statusMax = Math.max(1, ...ORDER_STATUSES.map((s) => data.ordersByStatus[s] ?? 0));

  return (
    <>
      <PageHeader title={m.title} subtitle={m.subtitle} />
      <PeriodForm from={data.from} to={data.to} labels={cashMessages[locale]} />

      <div className="split3">
        <div className="stat">
          <div className="eyebrow">{m.confirmTime}</div>
          <div className="number">{median === null ? "–" : duration(median, m, locale)}</div>
          <div className="sub">{fill(m.confirmHint, { n: created })}</div>
        </div>
        <div className="stat">
          <div className="eyebrow">{m.perDay}</div>
          <div className="number">{perDay}</div>
          <div className="sub">{fill(m.perDayHint, { n: created })}</div>
        </div>
        <div className="stat">
          <div className="eyebrow">{m.codGaps}</div>
          <div className={`number ${hasGaps ? "red" : ""}`}>
            <bdi>{formatMoney(data.codGaps.sumMinor, me.shop.currency, locale)}</bdi>
          </div>
          <div className="sub">
            {fill(m.codGapsHint, { n: formatNumber(data.codGaps.count, locale) })}
            {can(actor.role, "reconciliation.read") && (
              <>
                {" · "}
                <Link href="/dashboard/cash" className="font-extrabold underline">
                  {m.seeCash}
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="split mt-[15px]">
        <div className="card">
          <h2>{m.speedTitle}</h2>
          <p className="hint">{m.speedHint}</p>
          {speedRows.map((r) => (
            <div key={r.label} className="my-[18px]">
              <div className="between">
                <b className="text-xs">{r.label}</b>
                <b className="whitespace-nowrap">{duration(r.value, m, locale)}</b>
              </div>
              <div className="bar mt-2">
                <span style={{ width: `${(r.value / speedMax) * 100}%`, background: r.colour }} />
              </div>
            </div>
          ))}
          {median === null && <p className="hint">{m.noData}</p>}
          <div className="info-inline">
            <DashIcon name="info" size="sm" /> {baseline.confirmMinutes === null ? m.noBaseline : m.baselineNote}
          </div>
        </div>
        <div className="card">
          <h2>{m.byStatus}</h2>
          <p className="hint">{fill(m.byStatusHint, { n: created })}</p>
          {ORDER_STATUSES.map((s) => {
            const n = data.ordersByStatus[s] ?? 0;
            return (
              <div key={s} className="my-3.5 grid grid-cols-[105px_1fr_22px] items-center gap-2.5">
                <span className="text-[11px]">{t[`status${s}` as keyof CommonMessages]}</span>
                <div className="bar">
                  <span style={{ width: `${(100 * n) / statusMax}%` }} />
                </div>
                <b className="text-end text-xs">{formatNumber(n, locale)}</b>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <h2>{m.meaningTitle}</h2>
        <p className="hint">
          {baseline.ordersPerDay !== null && (
            <>
              {m.meaningBefore} <b>{fill(m.perDayValue, { n: formatNumber(baseline.ordersPerDay, locale) })}</b>.{" "}
            </>
          )}
          {m.meaningDuring} <b>{fill(m.perDayValue, { n: perDay })}</b> {fill(m.meaningFrom, { n: created })} {baseline.ordersPerDay === null ? m.meaningOnly : m.meaningNote}
        </p>
      </div>
    </>
  );
}
