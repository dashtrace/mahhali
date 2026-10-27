import Link from "next/link";
import { Icon, type IconName } from "@/components/Icon";
import { Badge, ButtonLink, Card, STATUS_TONES, SectionHeader } from "@/components/ui";
import { fill } from "@/i18n/locale";
import { marketingMessages } from "@/i18n/messages/auth";
import { common } from "@/i18n/messages/common";
import { storeMessages } from "@/i18n/messages/store";
import { getLocale } from "@/i18n/server";
import { formatMoney } from "@/lib/format";
import { PlatformHeader } from "./_platform/Shell";
import { StorefrontPreview } from "./_platform/StorefrontPreview";

const eyebrow = "text-[11px] font-extrabold uppercase tracking-[0.17em] rtl:tracking-normal";

export default async function Home() {
  const locale = await getLocale();
  const s = storeMessages[locale];
  const m = marketingMessages[locale];
  const t = common[locale];
  const features: { icon: IconName; title: string; body: string }[] = [
    { icon: "bag", title: s.featureCatalogueTitle, body: s.featureCatalogueBody },
    { icon: "box", title: s.featureStockTitle, body: s.featureStockBody },
    { icon: "orders", title: s.featureBoardTitle, body: s.featureBoardBody },
    { icon: "cash", title: s.featureCashTitle, body: s.featureCashBody },
    { icon: "truck", title: m.featureTrackTitle, body: m.featureTrackBody },
    { icon: "users", title: m.featureTeamTitle, body: m.featureTeamBody },
  ];
  const steps = [
    { title: m.step1Title, body: m.step1Body },
    { title: m.step2Title, body: m.step2Body },
    { title: m.step3Title, body: m.step3Body },
  ];
  // Sample rows for the decorative board preview (amounts in USD cents).
  const preview = [
    { n: 1004, area: m.previewArea1, status: "NEW", cents: 4500 },
    { n: 1003, area: m.previewArea2, status: "PACKED", cents: 2850 },
    { n: 1002, area: m.previewArea3, status: "OUT_FOR_DELIVERY", cents: 6200 },
  ] as const;

  return (
    <div className="flex min-h-dvh flex-col bg-sl-bg">
      <PlatformHeader locale={locale}>
        <Link href="/pricing" className="hidden min-h-11 items-center rounded-sl px-3 text-sm font-semibold text-sl-muted hover:bg-sl-cat hover:text-sl-fg sm:inline-flex">
          {s.pricingTitle}
        </Link>
        <Link href="/login" className="inline-flex min-h-11 items-center rounded-sl px-3 text-sm font-semibold text-sl-fg hover:bg-sl-cat">
          {t.signIn}
        </Link>
      </PlatformHeader>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-12 px-4 pb-12 pt-2">
        <section aria-labelledby="hero-title" className="grid items-center gap-8 overflow-hidden rounded-[21px] bg-sl-hero p-6 text-sl-hero-ink sm:p-10 md:grid-cols-[1fr_400px] lg:grid-cols-[1fr_420px]">
          <div>
            <p className={`${eyebrow} mb-3`}>{m.landingKicker}</p>
            <h1 id="hero-title" className="sl-heading text-[34px] leading-[1.05] sm:text-[46px]">
              {s.landingTitle}
            </h1>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed">{s.landingLead}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              <ButtonLink href="/signup" className="min-h-12 px-5 text-[15px]">
                {t.signUp}
                <Icon name="arrow" className="size-4" />
              </ButtonLink>
              <ButtonLink href="/pricing" tone="secondary" className="min-h-12 px-5 text-[15px]">
                {s.seePricing}
              </ButtonLink>
            </div>
            <p className="mt-3 text-xs font-semibold">{m.heroNote}</p>
          </div>

          <StorefrontPreview label={m.storefrontLabel} captions={[m.captionLight, m.captionDark]} />
        </section>

        <section aria-labelledby="how-title">
          <SectionHeader id="how-title" title={m.howTitle} />
          <ol className="grid gap-3 md:grid-cols-3">
            {steps.map((step, i) => (
              <li key={step.title}>
                <Card className="h-full p-5">
                  <span aria-hidden className="mb-3 grid size-10 place-items-center rounded-full bg-sl-cat text-sm font-extrabold text-sl-accent tabular-nums">
                    {i + 1}
                  </span>
                  <p className={`${eyebrow} mb-1 text-sl-accent`}>{fill(m.step, { n: i + 1 })}</p>
                  <h3 className="sl-heading text-lg leading-snug">{step.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-sl-muted">{step.body}</p>
                </Card>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="board-title" className="grid items-center gap-8 rounded-[21px] border border-sl-border bg-sl-panel p-6 sm:p-10 md:grid-cols-2">
          <div>
            <p className={`${eyebrow} mb-2 text-sl-accent`}>{m.boardKicker}</p>
            <h2 id="board-title" className="sl-heading text-[28px] leading-tight">
              {m.boardTitle}
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-sl-muted">{m.boardBody}</p>
            <ul className="mt-5 flex flex-col gap-3 text-[15px]">
              {[m.boardPoint1, m.boardPoint2, m.boardPoint3].map((p) => (
                <li key={p} className="flex gap-3">
                  <span aria-hidden className="grid size-6 shrink-0 place-items-center rounded-full bg-sl-cat text-sl-accent">
                    <Icon name="check" className="size-4" />
                  </span>
                  {p}
                </li>
              ))}
            </ul>
          </div>

          {/* A drawn preview of the order board; the rows are samples, not data. */}
          <div role="img" aria-label={m.previewLabel} className="mx-auto w-full max-w-[360px] rounded-[24px] border border-sl-border bg-sl-bg p-3 text-sl-fg shadow-[0_22px_50px_#1b25301f]">
            <div className="flex items-center justify-between px-1 pb-3 pt-1">
              <span className="sl-heading text-lg">{t.navOrders}</span>
              <span className="grid size-9 place-items-center rounded-sl bg-sl-accent text-sl-accent-ink">
                <Icon name="plus" className="size-4" />
              </span>
            </div>
            <ul className="flex flex-col gap-2">
              {preview.map((o) => (
                <li key={o.n} className="rounded-sl border border-sl-border bg-sl-panel p-3 shadow-[0_2px_10px_#00000006]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-extrabold tabular-nums">#{o.n}</span>
                    <Badge tone={STATUS_TONES[o.status]}>{t[`status${o.status}`]}</Badge>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-sl-muted">
                    <span className="inline-flex items-center gap-1">
                      <Icon name="pin" className="size-3.5" />
                      {o.area}
                    </span>
                    <bdi dir="ltr" className="font-bold text-sl-fg tabular-nums">{formatMoney(o.cents, "USD", locale)}</bdi>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex items-center justify-between rounded-sl bg-sl-cat px-3 py-2.5 text-xs">
              <span className="inline-flex items-center gap-1.5 font-bold">
                <Icon name="cash" className="size-4 text-sl-accent" />
                {m.previewCash}
              </span>
              <bdi dir="ltr" className="font-extrabold tabular-nums">{formatMoney(preview.reduce((sum, o) => sum + o.cents, 0), "USD", locale)}</bdi>
            </div>
          </div>
        </section>

        <section aria-labelledby="features-title">
          <SectionHeader id="features-title" title={m.featuresTitle} />
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <li key={f.title}>
                <Card className="flex h-full gap-3.5 p-5">
                  <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-full border border-sl-border bg-sl-cat text-sl-accent">
                    <Icon name={f.icon} />
                  </span>
                  <div>
                    <h3 className="font-extrabold">{f.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-sl-muted">{f.body}</p>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="cta-title" className="rounded-[21px] bg-sl-accent px-6 py-9 text-center text-sl-accent-ink">
          <h2 id="cta-title" className="sl-heading text-[26px] leading-tight">
            {m.ctaTitle}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed">{m.ctaBody}</p>
          <ButtonLink href="/signup" tone="secondary" className="mt-5 min-h-12 px-6 text-[15px]">
            {t.signUp}
            <Icon name="arrow" className="size-4" />
          </ButtonLink>
        </section>
      </main>

      <footer className="border-t border-sl-border bg-sl-nav">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-sm text-sl-muted">
          <span>
            <span className="font-extrabold text-sl-fg">{t.appName}</span> · {s.landingFoot}
          </span>
          <nav aria-label={t.appName} className="flex gap-1">
            <Link href="/pricing" className="inline-flex min-h-11 items-center px-2 font-semibold hover:text-sl-fg">
              {s.pricingTitle}
            </Link>
            <Link href="/login" className="inline-flex min-h-11 items-center px-2 font-semibold hover:text-sl-fg">
              {t.signIn}
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
