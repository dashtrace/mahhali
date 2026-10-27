import { Alert, Badge, Card, PageHeader, cx } from "@/components/ui";
import { Icon } from "@/components/Icon";
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

  return (
    <>
      <PageHeader title={m.billingTitle} />
      {checkout === "success" && <Alert tone="success" className="mb-4">{m.checkoutSuccess}</Alert>}
      {checkout === "cancelled" && <Alert className="mb-4">{m.checkoutCancelled}</Alert>}

      <Card className="mb-4 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-stone-600">{m.currentPlan}</span>
          <Badge tone={plan === "pro" ? "violet" : "neutral"}>{m[`plan${plan}`]}</Badge>
        </div>
        <div>
          <p className="text-sm text-stone-600">{m.usage}</p>
          <p className="text-2xl font-semibold tabular-nums">
            {limit === null ? fill(m.unlimitedUsage, { used }) : fill(m.usageOf, { used, limit })}
          </p>
          {limit !== null && (
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-100" role="progressbar" aria-label={m.usage} aria-valuemin={0} aria-valuemax={limit} aria-valuenow={used}>
              <div className={cx("h-full", used >= limit ? "bg-red-600" : "bg-[var(--brand)]")} style={{ width: `${Math.min(100, (used / limit) * 100)}%` }} />
            </div>
          )}
        </div>
        {limit !== null && used >= limit && <Alert tone="error">{m.limitReached}</Alert>}
        {limit !== null && used < limit && used >= limit * 0.8 && <Alert tone="warning">{m.nearLimit}</Alert>}
      </Card>

      <ul className="grid gap-3 sm:grid-cols-2">
        {Object.values(PLANS).map((p) => (
          <li key={p.id}>
            <Card className={cx("flex h-full flex-col gap-3", p.id === plan && "border-[var(--brand)] ring-2 ring-[var(--brand)]/20")}>
              <div>
                <h2 className="text-lg font-semibold">{m[`plan${p.id}`]}</h2>
                <p className="text-2xl font-semibold">{m[`price${p.id}`]}</p>
              </div>
              <ul className="flex flex-1 flex-col gap-1 text-sm">
                {[p.monthlyOrderLimit === null ? m.featureUnlimited : fill(m.featureLimit, { n: p.monthlyOrderLimit }), m.featureAll].map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Icon name="check" className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                    {f}
                  </li>
                ))}
              </ul>
              {p.id === "pro" && plan === "pro" && <Alert tone="success">{m.onPro}</Alert>}
              {p.id === "pro" && plan !== "pro" && (
                <>
                  <UpgradeButton label={m.upgrade} busyLabel={m.redirecting} fallback={common[locale].error} />
                  <p className="text-xs text-stone-500">{m.testMode}</p>
                </>
              )}
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}
