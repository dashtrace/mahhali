import Link from "next/link";
import { LanguageToggle } from "@/components/LanguageToggle";
import { Icon, type IconName } from "@/components/Icon";
import { ButtonLink, Card } from "@/components/ui";
import { common } from "@/i18n/messages/common";
import { storeMessages } from "@/i18n/messages/store";
import { getLocale } from "@/i18n/server";

export default async function Home() {
  const locale = await getLocale();
  const m = storeMessages[locale];
  const t = common[locale];
  const features: { icon: IconName; title: string; body: string }[] = [
    { icon: "bag", title: m.featureCatalogueTitle, body: m.featureCatalogueBody },
    { icon: "box", title: m.featureStockTitle, body: m.featureStockBody },
    { icon: "orders", title: m.featureBoardTitle, body: m.featureBoardBody },
    { icon: "cash", title: m.featureCashTitle, body: m.featureCashBody },
  ];

  return (
    <div className="mx-auto flex min-h-dvh max-w-5xl flex-col px-4">
      <header className="flex h-16 items-center gap-2">
        <Link href="/" className="me-auto text-lg font-semibold text-[var(--brand)]">
          {t.appName}
        </Link>
        <Link href="/pricing" className="inline-flex min-h-11 items-center px-2 text-sm text-stone-700 hover:text-stone-900">
          {m.seePricing}
        </Link>
        <LanguageToggle locale={locale} />
      </header>

      <main className="flex-1 py-10">
        <section className="max-w-2xl">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">{m.landingTitle}</h1>
          <p className="mt-4 text-lg text-stone-600">{m.landingLead}</p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <ButtonLink href="/signup">{t.signUp}</ButtonLink>
            <ButtonLink href="/login" tone="secondary">
              {t.signIn}
            </ButtonLink>
            <ButtonLink href="/pricing" tone="ghost">
              {m.seePricing}
            </ButtonLink>
          </div>
        </section>

        <ul className="mt-12 grid gap-3 sm:grid-cols-2">
          {features.map((f) => (
            <li key={f.title}>
              <Card className="flex h-full gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius)] bg-[var(--brand)]/10 text-[var(--brand)]">
                  <Icon name={f.icon} />
                </span>
                <div>
                  <h2 className="font-semibold">{f.title}</h2>
                  <p className="mt-1 text-sm text-stone-600">{f.body}</p>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      </main>

      <footer className="py-6 text-center text-xs text-stone-500">{m.landingFoot}</footer>
    </div>
  );
}
