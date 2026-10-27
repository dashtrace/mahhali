import Link from "next/link";
import { Badge, Card, EmptyState, PageHeader, Stat } from "@/components/ui";
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
      text: fill(m.unpaidFor, { amount: money(r.dueMinor), days: r.daysOutstanding }),
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
              <h2 className="mb-3 text-lg font-semibold">{c.courierName ?? m.noCourierName}</h2>
              <dl className="mb-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                {[
                  { label: m.due, value: money(c.expectedMinor) },
                  { label: m.reported, value: money(reported) },
                  { label: m.remitted, value: money(c.receivedMinor), hint: cash(c.received, locale) },
                  { label: m.gap, value: money(c.gaps.sumMinor), hint: fill(m.gapsHint, { n: c.gaps.count }), bad: c.gaps.count > 0 },
                ].map((s) => (
                  <div key={s.label}>
                    <dt className="text-xs text-stone-500">{s.label}</dt>
                    <dd className={`text-base font-semibold tabular-nums ${s.bad ? "text-red-700" : ""}`}>{s.value}</dd>
                    {s.hint && <dd className="text-xs text-stone-500">{s.hint}</dd>}
                  </div>
                ))}
              </dl>
              {problems.length === 0 ? (
                <p className="text-sm text-emerald-700">{m.allClear}</p>
              ) : (
                <>
                  <h3 className="mb-1 text-sm font-medium text-stone-700">{m.problems}</h3>
                  <ul className="divide-y divide-stone-100">
                    {problems.map((p) => {
                      const body = (
                        <>
                          <Badge tone={p.tone} className="shrink-0">{p.kind}</Badge>
                          <span className="min-w-0 flex-1">
                            {p.number !== undefined && <span className="me-1 font-medium">{fill(m.orderNo, { n: p.number })}</span>}
                            <span className="text-stone-700">{p.text}</span>
                          </span>
                        </>
                      );
                      return (
                        <li key={p.key}>
                          {p.orderId ? (
                            <Link href={`/dashboard/orders/${p.orderId}`} className="flex min-h-11 items-center gap-2 py-2 text-sm hover:bg-stone-50">
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

      <section>
        <h2 className="mb-2 text-lg font-semibold">{m.pastTitle}</h2>
        {remittances.length === 0 ? (
          <EmptyState title={m.noRemittances} />
        ) : (
          <ul className="flex flex-col gap-2">
            {remittances.map((r) => (
              <li key={r.id}>
                <Card className="flex flex-col gap-1 text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium">{courierName.get(r.courierId) ?? m.noCourierName}</span>
                    <span className="font-semibold tabular-nums">{cash({ usdCents: r.amountUsdCents, lbp: r.amountLbp }, locale) || money(0n)}</span>
                  </div>
                  <div className="text-stone-500">{[formatDate(r.receivedAt, locale), r.reference].filter(Boolean).join(" · ")}</div>
                  <div className="flex flex-wrap gap-x-2">
                    <span className="text-stone-500">{m.orders}:</span>
                    {r.lines.map((l) => (
                      <Link key={l.id} href={`/dashboard/orders/${l.orderId}`} className="inline-flex min-h-11 items-center text-[var(--brand)] underline-offset-2 hover:underline">
                        {fill(m.orderNo, { n: l.order.number })}
                      </Link>
                    ))}
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
