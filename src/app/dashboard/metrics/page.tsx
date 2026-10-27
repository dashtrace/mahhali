import { Card, PageHeader, Stat } from "@/components/ui";
import { fill, type Locale } from "@/i18n/locale";
import { common, type CommonMessages } from "@/i18n/messages/common";
import { cashMessages, metricsMessages, type MetricsMessages } from "@/i18n/messages/money";
import { getLocale } from "@/i18n/server";
import { formatMoney, formatNumber } from "@/lib/format";
import { ORDER_STATUSES } from "@/server/domain/orderStatus";
import { accountService } from "@/server/services/accountService";
import { reportingService } from "@/server/services/reportingService";
import { pageActor } from "../../_server/session";
import { PeriodForm, readPeriod } from "../cash/period";

export const metadata = { title: "Metrics" };

function duration(minutes: number, m: MetricsMessages, locale: Locale) {
  const total = Math.round(minutes);
  if (total < 60) return fill(m.minutes, { n: formatNumber(total, locale) });
  return fill(m.hours, { h: formatNumber(Math.floor(total / 60), locale), m: formatNumber(total % 60, locale) });
}

/** Horizontal bars scaled to the largest value; no chart library needed. */
function Bars({ rows }: { rows: { label: string; value: number; text: string; muted?: boolean }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[6.5rem_1fr] items-center gap-2 text-sm">
          <span className="truncate text-stone-600">{r.label}</span>
          <span className="flex items-center gap-2">
            <span
              className={`h-3 rounded-full ${r.muted ? "bg-stone-300" : "bg-[var(--brand)]"}`}
              style={{ width: `${(r.value / max) * 100}%`, minWidth: r.value > 0 ? "0.25rem" : 0 }}
            />
            <span className="shrink-0 tabular-nums">{r.text}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export default async function MetricsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const actor = await pageActor("metrics.read", "/dashboard/metrics");
  const period = readPeriod(await searchParams);
  const locale = await getLocale();
  const m = metricsMessages[locale];
  const t = common[locale];
  const [data, me] = await Promise.all([reportingService.metrics(actor, period), accountService.me(actor)]);
  const { baseline } = data;
  const perDay = formatNumber(data.ordersPerDay, locale, 1);
  const median = data.medianConfirmMinutes;

  return (
    <>
      <PageHeader title={m.title} subtitle={m.subtitle} />
      <PeriodForm from={data.from} to={data.to} labels={cashMessages[locale]} />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat
          label={m.confirmTime}
          value={median === null ? "–" : duration(median, m, locale)}
          hint={median === null ? m.noData : baseline.confirmMinutes !== null ? `${m.before}: ${duration(baseline.confirmMinutes, m, locale)}` : m.confirmHint}
        />
        <Stat
          label={m.perDay}
          value={perDay}
          hint={baseline.ordersPerDay !== null ? `${m.before}: ${formatNumber(baseline.ordersPerDay, locale)}` : undefined}
        />
        <div className="col-span-2 sm:col-span-1">
          <Stat
            label={m.codGaps}
            value={formatMoney(data.codGaps.sumMinor, me.shop.currency, locale)}
            hint={fill(m.codGapsHint, { n: data.codGaps.count })}
          />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">{m.compare}</h2>
          {baseline.ordersPerDay === null && baseline.confirmMinutes === null ? (
            <p className="text-sm text-stone-600">{m.noBaseline}</p>
          ) : (
            <div className="flex flex-col gap-4">
              {baseline.confirmMinutes !== null && (
                <div>
                  <h3 className="mb-1 text-sm font-medium">{m.confirmTime}</h3>
                  <Bars
                    rows={[
                      { label: m.before, value: baseline.confirmMinutes, text: duration(baseline.confirmMinutes, m, locale), muted: true },
                      { label: m.during, value: median ?? 0, text: median === null ? "–" : duration(median, m, locale) },
                    ]}
                  />
                </div>
              )}
              {baseline.ordersPerDay !== null && (
                <div>
                  <h3 className="mb-1 text-sm font-medium">{m.perDay}</h3>
                  <Bars
                    rows={[
                      { label: m.before, value: baseline.ordersPerDay, text: formatNumber(baseline.ordersPerDay, locale), muted: true },
                      { label: m.during, value: data.ordersPerDay, text: perDay },
                    ]}
                  />
                </div>
              )}
            </div>
          )}
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">{m.byStatus}</h2>
          <Bars
            rows={ORDER_STATUSES.map((s) => ({
              label: t[`status${s}` as keyof CommonMessages],
              value: data.ordersByStatus[s] ?? 0,
              text: formatNumber(data.ordersByStatus[s] ?? 0, locale),
            }))}
          />
        </Card>
      </div>
    </>
  );
}
