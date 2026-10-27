import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Badge, Card, EmptyState, PageHeader, SectionHeader, Stat, cx } from "@/components/ui";
import { fill } from "@/i18n/locale";
import { common, type CommonMessages } from "@/i18n/messages/common";
import { cashMessages, type CashMessages } from "@/i18n/messages/money";
import { getLocale } from "@/i18n/server";
import { formatDate, formatMoney } from "@/lib/format";
import { can } from "@/server/domain/policy";
import { courierService } from "@/server/services/courierService";
import { remittanceService } from "@/server/services/remittanceService";
import { reportingService } from "@/server/services/reportingService";
import { pageActor } from "../../_server/session";
import { PeriodForm, readPeriod } from "./period";
import { RemittanceForm } from "./RemittanceForm";

export const metadata = { title: "Cash" };

type Recon = Awaited<ReturnType<typeof reportingService.reconciliation>>;
type CourierRecon = Recon["couriers"][number];
type Currency = Recon["currency"];

const abs = (v: bigint) => (v < 0n ? -v : v);

type Problem = { key: string; kind: string; tone: "red" | "amber" | "violet"; orderId?: string; number?: number; text: string };

/** Every row that needs a look, worst first. */
function problemsOf(c: CourierRecon, money: (v: bigint) => string, m: CashMessages, t: CommonMessages, locale: "en" | "ar"): Problem[] {
  return [
    ...c.shortOrOver.map((r) => ({
      key: `so${r.orderId}`,
      kind: r.diffMinor < 0n ? m.kindShort : m.kindOver,
      tone: "red" as const,
      orderId: r.orderId,
      number: r.number,
      text: fill(r.diffMinor < 0n ? m.shortBy : m.overBy, { amount: money(abs(r.diffMinor)), due: money(r.dueMinor), paid: money(r.paidMinor) }),
    })),
    ...c.notDeliveredButPaid.map((r) => ({
      key: `nd${r.orderId}`,
      kind: m.kindMismatch,
      tone: "red" as const,
      orderId: r.orderId,
      number: r.number,
      text: fill(m.mismatch, { amount: money(r.paidMinor), status: t[`status${r.status}` as keyof CommonMessages] }),
    })),
    ...c.unpaid.map((r) => ({
      key: `un${r.orderId}`,
      kind: m.kindUnpaid,
      tone: "amber" as const,
      orderId: r.orderId,
      number: r.number,
      text: fill(r.daysOutstanding < 1 ? m.unpaidToday : r.daysOutstanding === 1 ? m.unpaidOneDay : r.daysOutstanding >= 3 && r.daysOutstanding <= 10 ? m.unpaidFewDays : m.unpaidFor, { amount: money(r.dueMinor), days: r.daysOutstanding }),
    })),
    ...c.doorstepGaps.map((r) => ({
      key: `ds${r.orderId}`,
      kind: m.kindDoorstep,
      tone: "violet" as const,
      orderId: r.orderId,
      number: r.number,
      text: fill(m.doorstep, { reported: money(r.reportedMinor), due: money(r.dueMinor) }),
    })),
    ...c.remittanceGaps.map((r) => ({
      key: `rg${r.remittanceId}`,
      kind: m.kindRemittance,
      tone: "violet" as const,
      text: fill(r.diffMinor < 0n ? m.remittanceShort : m.remittanceGap, {
        diff: money(abs(r.diffMinor)),
        date: [formatDate(r.receivedAt, locale), r.reference].filter(Boolean).join(" · "),
      }),
    })),
  ];
}

/** Dollars and pounds as handed over, e.g. "$40.00 + LBP 900,000". */
function cash(r: { usdCents: bigint; lbp: bigint }, locale: "en" | "ar") {
  const parts = [r.usdCents ? formatMoney(r.usdCents, "USD", locale) : null, r.lbp ? formatMoney(r.lbp, "LBP", locale) : null].filter(Boolean);
  return parts.join(" + ");
}

export default async function CashPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const actor = await pageActor("reconciliation.read", "/dashboard/cash");
  const period = readPeriod(await searchParams);
  const locale = await getLocale();
  const m = cashMessages[locale];
  const t = common[locale];

  const [rec, { remittances }, couriers] = await Promise.all([
    reportingService.reconciliation(actor, period),
    remittanceService.list(actor, period),
    courierService.list(actor, {}),
  ]);
  const currency: Currency = rec.currency;
  const money = (v: bigint) => formatMoney(v, currency, locale);
  const courierName = new Map(couriers.map((c) => [c.id, c.name]));

  return (
    <>
      <PageHeader title={m.title} subtitle={m.subtitle} />
      <PeriodForm from={rec.from} to={rec.to} labels={m} />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label={m.totalDue} value={money(rec.totals.expectedMinor)} />
        <Stat label={m.totalReceived} value={money(rec.totals.receivedMinor)} hint={cash(rec.totals.received, locale)} />
        <div className="col-span-2 sm:col-span-1">
          <Stat label={m.totalGaps} value={money(rec.totals.gaps.sumMinor)} hint={fill(m.gapsHint, { n: rec.totals.gaps.count })} />
        </div>
      </div>

      {can(actor.role, "remittance.write") && (
        <RemittanceForm
          couriers={couriers.filter((c) => c.active).map((c) => ({ id: c.id, name: c.name }))}
          today={new Date().toISOString().slice(0, 10)}
          locale={locale}
          m={m}
        />
      )}

      <section className="mb-6 flex flex-col gap-3">
        {rec.couriers.length === 0 && <EmptyState title={m.noActivity} />}
        {rec.couriers.map((c) => {
          const problems = problemsOf(c, money, m, t, locale);
          // shortcut: reconcile() returns no per-courier reported total, so orders without a doorstep gap count as reported = due; add reportedMinor to reconcile() for the exact figure.
          const reported = c.expectedMinor + c.doorstepGaps.reduce((sum, r) => sum + r.diffMinor, 0n);
          return (
            <Card key={c.courierId}>
              <div className="mb-3 flex items-center gap-3">
                <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-sl-cat text-sl-accent">
                  <Icon name="truck" className="size-5" />
                </span>
                <h2 className="sl-heading min-w-0 flex-1 truncate text-lg">{c.courierName ?? m.noCourierName}</h2>
                {problems.length > 0 && <Badge tone="red">{fill(m.gapsHint, { n: problems.length })}</Badge>}
              </div>
              {/* The mockup's track-summary tiles: four figures on the soft background. */}
              <dl className="mb-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                {[
                  { label: m.due, value: money(c.expectedMinor) },
                  { label: m.reported, value: money(reported) },
                  { label: m.remitted, value: money(c.receivedMinor), hint: cash(c.received, locale) },
                  { label: m.gap, value: money(c.gaps.sumMinor), hint: fill(m.gapsHint, { n: c.gaps.count }), bad: c.gaps.count > 0 },
                ].map((s) => (
                  <div key={s.label} className="min-w-0 rounded-sl bg-sl-bg px-3 py-2.5">
                    <dt className="truncate text-xs text-sl-muted">{s.label}</dt>
                    <dd className={cx("text-base font-extrabold tabular-nums", s.bad && "text-sl-danger")}>
                      <bdi>{s.value}</bdi>
                    </dd>
                    {s.hint && <dd className="truncate text-xs text-sl-muted">{s.hint}</dd>}
                  </div>
                ))}
              </dl>
              {problems.length === 0 ? (
                <p className="inline-flex items-center gap-1.5 text-sm font-bold text-sl-ok">
                  <Icon name="check" className="size-4" />
                  {m.allClear}
                </p>
              ) : (
                <>
                  <h3 className="mb-1 text-sm font-bold">{m.problems}</h3>
                  <ul>
                    {problems.map((p) => {
                      const body = (
                        <>
                          <Badge tone={p.tone} className="shrink-0">{p.kind}</Badge>
                          <span className="min-w-0 flex-1">
                            {p.number !== undefined && <span className="me-1 font-bold">{fill(m.orderNo, { n: p.number })}</span>}
                            <span className="text-sl-muted">{p.text}</span>
                          </span>
                          {p.orderId && <Icon name="next" className="size-4 shrink-0 text-sl-muted" />}
                        </>
                      );
                      return (
                        <li key={p.key} className="border-b border-sl-border last:border-b-0">
                          {p.orderId ? (
                            <Link href={`/dashboard/orders/${p.orderId}`} className="flex min-h-11 items-center gap-2 py-2 text-sm hover:text-sl-accent">
                              {body}
                            </Link>
                          ) : (
                            <div className="flex min-h-11 items-center gap-2 py-2 text-sm">{body}</div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </Card>
          );
        })}
      </section>

      <section aria-labelledby="remittances">
        <SectionHeader id="remittances" title={m.pastTitle} />
        {remittances.length === 0 ? (
          <EmptyState title={m.noRemittances} />
        ) : (
          <Card className="py-1">
            <ul>
              {remittances.map((r) => (
                <li key={r.id} className="flex flex-col gap-0.5 border-b border-sl-border py-3 text-sm last:border-b-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-bold">{courierName.get(r.courierId) ?? m.noCourierName}</span>
                    <bdi className="font-extrabold tabular-nums">{cash({ usdCents: r.amountUsdCents, lbp: r.amountLbp }, locale) || money(0n)}</bdi>
                  </div>
                  <div className="text-xs text-sl-muted">{[formatDate(r.receivedAt, locale), r.reference].filter(Boolean).join(" · ")}</div>
                  <div className="flex flex-wrap items-center gap-x-1.5">
                    <span className="text-xs text-sl-muted">{m.orders}:</span>
                    {r.lines.map((l) => (
                      <Link key={l.id} href={`/dashboard/orders/${l.orderId}`} className="inline-flex min-h-11 items-center px-1 font-bold text-sl-accent underline-offset-2 hover:underline">
                        {fill(m.orderNo, { n: l.order.number })}
                      </Link>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </>
  );
}
