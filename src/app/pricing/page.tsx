import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { Icon, type IconName } from "@/components/Icon";
import { Alert, Badge, ButtonLink, SectionHeader, cx } from "@/components/ui";
import { fill } from "@/i18n/locale";
import { marketingMessages } from "@/i18n/messages/auth";
import { common } from "@/i18n/messages/common";
import { storeMessages } from "@/i18n/messages/store";
import { getLocale } from "@/i18n/server";
import { AppError } from "@/server/http/errors";
import { resolveActor } from "@/server/http/session";
import { accountService } from "@/server/services/accountService";
import { billingService } from "@/server/services/billingService";
import { PlatformHeader } from "../_platform/Shell";
import { UpgradeButton } from "./UpgradeButton";

export const metadata: Metadata = { title: "Pricing" };

/** The owner (or whoever may manage billing) when signed in, else null. */
async function billingActor() {
  try {
    return await resolveActor(await headers(), "billing.manage");
  } catch (error) {
    if (error instanceof AppError) return null;
    throw error;
  }
}

export default async function PricingPage() {
  const [locale, actor] = await Promise.all([getLocale(), billingActor()]);
  const s = storeMessages[locale];
  const m = marketingMessages[locale];
  const t = common[locale];
  const plan = actor ? (await accountService.me(actor)).shop.plan : null;
  const included: { icon: IconName; title: string; body: string }[] = [
    { icon: "bag", title: s.featureCatalogueTitle, body: s.featureCatalogueBody },
    { icon: "box", title: s.featureStockTitle, body: s.featureStockBody },
    { icon: "orders", title: s.featureBoardTitle, body: s.featureBoardBody },
    { icon: "cash", title: s.featureCashTitle, body: s.featureCashBody },
    { icon: "truck", title: m.featureTrackTitle, body: m.featureTrackBody },
    { icon: "users", title: m.featureTeamTitle, body: m.featureTeamBody },
  ];

  return (
    <div className="flex min-h-dvh flex-col bg-sl-bg">
      <PlatformHeader locale={locale}>
        {!actor && (
          <Link href="/login" className="inline-flex min-h-11 items-center rounded-sl px-3 text-sm font-semibold text-sl-fg hover:bg-sl-cat">
            {t.signIn}
          </Link>
        )}
      </PlatformHeader>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-12 pt-6">
        <div className="text-center">
          <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.17em] text-sl-accent rtl:tracking-normal">{t.appName}</p>
          <h1 className="sl-heading text-[32px] leading-tight sm:text-[40px]">{s.pricingTitle}</h1>
          <p className="mx-auto mt-2 max-w-md text-[15px] text-sl-muted">{s.pricingLead}</p>
        </div>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {billingService.plans().map((p) => {
            const current = plan === p.id;
            const pro = p.id === "pro";
            return (
              <li key={p.id}>
                <section
                  aria-labelledby={`plan-${p.id}`}
                  className={cx(
                    "flex h-full flex-col gap-4 rounded-[18px] bg-sl-panel p-5 shadow-[0_4px_20px_#2130400a] sm:p-6",
                    pro ? "border-2 border-sl-accent" : "border border-sl-border",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h2 id={`plan-${p.id}`} className="sl-heading text-xl">
                      {s[`plan_${p.id}_name`]}
                    </h2>
                    {current ? <Badge tone="green">{s.currentPlan}</Badge> : pro && <Badge tone="blue">{m.popular}</Badge>}
                  </div>
                  <div>
                    <p className="text-[34px] font-extrabold leading-none tabular-nums">{s[`plan_${p.id}_price`]}</p>
                    <p className="mt-2 text-sm text-sl-muted">{pro ? m.planProBlurb : m.planFreeBlurb}</p>
                  </div>
                  <ul className="flex flex-1 flex-col gap-2.5 border-t border-sl-border pt-4 text-sm">
                    {[p.monthlyOrderLimit === null ? s.ordersUnlimited : fill(s.ordersLimit, { n: p.monthlyOrderLimit }), s.planIncludes].map((f) => (
                      <li key={f} className="flex gap-2.5">
                        <span aria-hidden className="grid size-5 shrink-0 place-items-center rounded-full bg-sl-cat text-sl-accent">
                          <Icon name="check" className="size-3.5" />
                        </span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  {!actor ? (
                    <ButtonLink href="/signup" tone={pro ? "primary" : "secondary"} block className="min-h-12 text-[15px]">
                      {t.signUp}
                    </ButtonLink>
                  ) : pro && !current ? (
                    <UpgradeButton label={s.upgrade} busyLabel={s.upgrading} errorLabel={t.error} />
                  ) : (
                    <ButtonLink href="/dashboard" tone="secondary" block className="min-h-12 text-[15px]">
                      {s.goDashboard}
                    </ButtonLink>
                  )}
                </section>
              </li>
            );
          })}
        </ul>
        <Alert tone="note" className="mt-5 text-center">
          {s.testMode}
        </Alert>
        <section aria-labelledby="included-title" className="mt-12">
          <SectionHeader id="included-title" title={m.includedTitle} />
          <ul className="grid gap-3 sm:grid-cols-2">
            {included.map((f) => (
              <li key={f.title} className="flex gap-3.5 rounded-sl-lg border border-sl-border bg-sl-panel p-4">
                <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-sl-cat text-sl-accent">
                  <Icon name={f.icon} className="size-[18px]" />
                </span>
                <div>
                  <h3 className="font-extrabold">{f.title}</h3>
                  <p className="mt-0.5 text-sm leading-relaxed text-sl-muted">{f.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
