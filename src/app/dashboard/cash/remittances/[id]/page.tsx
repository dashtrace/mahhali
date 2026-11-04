import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { fill } from "@/i18n/locale";
import { common } from "@/i18n/messages/common";
import { cashMessages } from "@/i18n/messages/money";
import { getLocale } from "@/i18n/server";
import { formatMoney } from "@/lib/format";
import { AppError } from "@/server/http/errors";
import { courierService } from "@/server/services/courierService";
import { remittanceService } from "@/server/services/remittanceService";
import { reportingService } from "@/server/services/reportingService";
import { pageActor } from "../../../../_server/session";
import { DashIcon } from "../../../_components/DashIcon";
import { dayMonthYear } from "../../../orders/_components/labels";
import { cash, remittanceRef, reportedOf } from "../../remittance";

export const metadata = { title: "Remittance" };

export default async function RemittancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await pageActor("reconciliation.read", `/dashboard/cash/remittances/${id}`);
  const locale = await getLocale();
  const m = cashMessages[locale];

  let r;
  try {
    r = await remittanceService.get(actor, id);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }
  // Reconcile that one day: the page then agrees with the Cash page on whether this remittance is flagged.
  const day = r.receivedAt.toISOString().slice(0, 10);
  const [rec, couriers] = await Promise.all([reportingService.reconciliation(actor, { from: day, to: day, courierId: r.courierId }), courierService.list(actor, {})]);
  const diff = rec.couriers.flatMap((c) => c.remittanceGaps).find((g) => g.remittanceId === r.id)?.diffMinor ?? 0n;
  const amount = (v: bigint) => formatMoney(v < 0n ? -v : v, rec.currency, locale);
  const courier = couriers.find((c) => c.id === r.courierId)?.name ?? m.noCourierName;
  const stats = [
    { label: m.reported, value: cash(reportedOf(r, rec.currency), locale) || amount(0n), tone: "" },
    { label: m.remitted, value: cash({ usdCents: r.amountUsdCents, lbp: r.amountLbp }, locale) || amount(0n), tone: "green" },
    { label: m.thDifference, value: amount(diff), tone: diff ? "red" : "green" },
  ];

  return (
    <>
      <Link href="/dashboard/cash" className="btn tiny mb-[15px]">
        <DashIcon name="left" size="sm" />
        {common[locale].navCash}
      </Link>
      <PageHeader
        title={fill(m.remittanceTitle, { ref: remittanceRef(r.id, r.reference) })}
        subtitle={`${courier} · ${dayMonthYear(r.receivedAt.toISOString(), locale)}`}
        actions={<span className={`mini-badge ${diff ? "red" : "green"}`}>{diff ? m.needsReview : m.settled}</span>}
      />
      <div className="split3">
        {stats.map((s) => (
          <div key={s.label} className="stat">
            <div className="eyebrow">{s.label}</div>
            <div className={`number ${s.tone}`}>
              <bdi>{s.value}</bdi>
            </div>
          </div>
        ))}
      </div>
      <section className="card mt-[15px]">
        <h2>{m.flaggedTitle}</h2>
        <p className="hint">{diff ? fill(diff < 0n ? m.flaggedShort : m.flaggedOver, { amount: amount(diff) }) : m.flaggedNone}</p>
        <div className="line-list">
          {r.lines.map((l) => (
            <div key={l.id} className="line-item">
              <div className="min-w-0">
                <b>{fill(m.orderLink, { n: l.order.number })}</b>
                <p className="hint my-[5px]">{m.linkedOrder}</p>
              </div>
              <Link href={`/dashboard/orders/${l.orderId}`} className="btn tiny">
                {m.viewOrder}
                <DashIcon name="arrow" size="tiny" />
              </Link>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
