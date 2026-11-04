import { Alert, PageHeader } from "@/components/ui";
import { fill } from "@/i18n/locale";
import { shopMessages } from "@/i18n/messages/shop";
import { common } from "@/i18n/messages/common";
import { getLocale } from "@/i18n/server";
import { PLANS, orderLimit, type PlanId } from "@/server/domain/plans";
import { accountService } from "@/server/services/accountService";
import { reportingService } from "@/server/services/reportingService";
import { pageActor } from "../../_server/session";
import { UpgradeButton } from "./_components/UpgradeButton";

export const metadata = { title: "Plan" };

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ checkout?: string }> }) {
  const actor = await pageActor("billing.manage", "/dashboard/billing");
  const { checkout } = await searchParams;
  const locale = await getLocale();
  const m = shopMessages[locale];
  // The plan limit counts orders created since the 1st of the month (UTC), as placeOrder does.
  const monthStart = new Date().toISOString().slice(0, 8) + "01";
  // shortcut: metrics() also runs the month's reconciliation just to count orders; add a usage count to billingService if this page gets slow.
  const [me, metrics] = await Promise.all([accountService.me(actor), reportingService.metrics(actor, { from: monthStart })]);
  const used = Object.values(metrics.ordersByStatus).reduce((a, b) => a + b, 0);
  const plan: PlanId = me.shop.plan === "pro" ? "pro" : "free";
  const limit = orderLimit(plan);
  const features = {
    free: [fill(m.featureLimit, { n: PLANS.free.monthlyOrderLimit }), m.featureCatalogue, m.featureCash],
    pro: [m.featureUnlimited, m.featureEverything, m.featureGrowing],
  };

  return (
    <>
      <PageHeader title={m.billingTitle} subtitle={m.billingSubtitle} />
      {checkout === "success" && <Alert tone="success" className="mb-4">{m.checkoutSuccess}</Alert>}
      {checkout === "cancelled" && <Alert className="mb-4">{m.checkoutCancelled}</Alert>}

      <div className="plan-hero">
        <div className="between">
          <span className="eyebrow">{m.yourCurrentPlan}</span>
          <span className="mini-badge green">{m[`plan${plan}`]}</span>
        </div>
        <div className="mt-[13px] flex items-center gap-[9px]">
          <strong>{used}</strong>
          <span className="hint">{limit === null ? m.usageUnlimited : fill(m.usageOfLimit, { limit })}</span>
        </div>
        {limit !== null && (
          <>
            <div className="bar-half" role="progressbar" aria-label={m.usage} aria-valuemin={0} aria-valuemax={limit} aria-valuenow={Math.min(used, limit)}>
              <span style={{ width: `${Math.min(100, (used / limit) * 100)}%` }} />
            </div>
            <p className="hint">{fill(m.usageLeft, { n: Math.max(0, limit - used) })}</p>
            {used >= limit && <div className="callout mb-0">{m.limitReached}</div>}
            {used < limit && used >= limit * 0.8 && <div className="callout mb-0">{m.nearLimit}</div>}
          </>
        )}
      </div>

      <div className="plan-grid mt-5">
        {Object.values(PLANS).map((p) => (
          <section key={p.id} aria-labelledby={`plan-${p.id}`} className="card">
            <h2 id={`plan-${p.id}`}>{m[`plan${p.id}`]}</h2>
            <p className="bold mb-[1em] text-[30px]">
              {m[`price${p.id}`]} <span className="hint">{m.perMonth}</span>
            </p>
            <hr className="separator" />
            {features[p.id].map((f) => (
              <p key={f} className="mb-[1em]">
                ✓ {f}
              </p>
            ))}
            {p.id === plan && <span className="mini-badge green">{m.yourCurrentPlan}</span>}
            {p.id === "pro" && plan !== "pro" && (
              <>
                <UpgradeButton label={m.upgrade} busyLabel={m.redirecting} fallback={common[locale].error} />
                <p className="hint mt-2.5">{m.testMode}</p>
              </>
            )}
          </section>
        ))}
      </div>
    </>
  );
}
