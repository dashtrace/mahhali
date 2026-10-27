import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { LanguageToggle } from "@/components/LanguageToggle";
import { Icon } from "@/components/Icon";
import { Badge, ButtonLink, Card, cx } from "@/components/ui";
import { fill } from "@/i18n/locale";
import { common } from "@/i18n/messages/common";
import { storeMessages } from "@/i18n/messages/store";
import { getLocale } from "@/i18n/server";
import { AppError } from "@/server/http/errors";
import { resolveActor } from "@/server/http/session";
import { accountService } from "@/server/services/accountService";
import { billingService } from "@/server/services/billingService";
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
  const m = storeMessages[locale];
  const t = common[locale];
  const plan = actor ? (await accountService.me(actor)).shop.plan : null;

  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col px-4">
      <header className="flex h-16 items-center gap-2">
        <Link href="/" className="me-auto text-lg font-semibold text-[var(--brand)]">
          {t.appName}
        </Link>
        <LanguageToggle locale={locale} />
      </header>
      <main className="flex-1 py-8">
        <h1 className="text-3xl font-semibold tracking-tight">{m.pricingTitle}</h1>
        <p className="mt-2 text-stone-600">{m.pricingLead}</p>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {billingService.plans().map((p) => {
            const current = plan === p.id;
            return (
              <li key={p.id}>
                <Card className={cx("flex h-full flex-col gap-3", p.id === "pro" && "border-[var(--brand)]")}>
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-lg font-semibold">{m[`plan_${p.id}_name`]}</h2>
                    {current && <Badge tone="green">{m.currentPlan}</Badge>}
                  </div>
                  <p className="text-3xl font-semibold tabular-nums">{m[`plan_${p.id}_price`]}</p>
                  <ul className="flex flex-1 flex-col gap-2 text-sm text-stone-700">
                    <li className="flex gap-2">
                      <Icon name="check" className="size-5 shrink-0 text-[var(--brand)]" />
                      {p.monthlyOrderLimit === null ? m.ordersUnlimited : fill(m.ordersLimit, { n: p.monthlyOrderLimit })}
                    </li>
                    <li className="flex gap-2">
                      <Icon name="check" className="size-5 shrink-0 text-[var(--brand)]" />
                      {m.planIncludes}
                    </li>
                  </ul>
                  {!actor ? (
                    <ButtonLink href="/signup" tone={p.id === "pro" ? "primary" : "secondary"} block>
                      {t.signUp}
                    </ButtonLink>
                  ) : p.id === "pro" && !current ? (
                    <UpgradeButton label={m.upgrade} busyLabel={m.upgrading} errorLabel={t.error} />
                  ) : (
                    <ButtonLink href="/dashboard" tone="secondary" block>
                      {m.goDashboard}
                    </ButtonLink>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-xs text-stone-500">{m.testMode}</p>
      </main>
    </div>
  );
}
