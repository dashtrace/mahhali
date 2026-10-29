"use client";

import { useState } from "react";
import { Alert, Button, Card, Field, Select, cx } from "@/components/ui";
import { Icon, type IconName } from "@/components/Icon";
import { fill, type Locale } from "@/i18n/locale";
import type { CommonMessages } from "@/i18n/messages/common";
import type { ShopMessages } from "@/i18n/messages/shop";
import { api } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { FONTS, PALETTES, RADII, validateTheme, type PaletteName, type Theme } from "@/server/domain/theme";
import { themeTone, themeVars } from "../../../_server/theme";
import { FilePicker } from "../../products/_components/FilePicker";
import { CardHead } from "../../products/_components/ProductExtras";
import { useAction } from "../../products/_components/useAction";

type PreviewShop = { name: string; currency: "USD" | "LBP"; logoMode: string; tagline: string | null };
type Props = { theme: Theme; logo: string | null; shop: PreviewShop; locale: Locale; m: ShopMessages; t: CommonMessages };

const PAIR_KEYS = { "text on primary": "pairPrimary", "text on accent": "pairAccent", "body text on background": "pairBackground" } as const;
const same = (a: Theme, b: Theme) => (Object.keys(a) as (keyof Theme)[]).every((k) => a[k] === b[k]);

export function Branding({ theme: saved, logo, shop, locale, m, t }: Props) {
  const [theme, setTheme] = useState<Theme>(saved);
  const [done, setDone] = useState(false);
  const save = useAction(t.error);
  const failures = validateTheme(theme);
  const set = <K extends keyof Theme>(k: K, v: Theme[K]) => {
    setDone(false);
    setTheme({ ...theme, [k]: v });
  };

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-w-0 flex-col gap-4">
        <Card className="flex flex-col gap-4">
          <CardHead title={m.brandingTitle} />

          <fieldset>
            <legend className="mb-2 text-[13px] font-bold">{m.palettes}</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(Object.keys(PALETTES) as PaletteName[]).map((name) => {
                const p = PALETTES[name];
                const active = same(theme, p);
                return (
                  <button
                    key={name}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      setDone(false);
                      setTheme({ ...p });
                    }}
                    className={cx(
                      "flex min-h-11 items-center gap-2 rounded-sl-sm border bg-sl-panel px-3 py-2 text-sm font-bold",
                      active ? "border-sl-accent bg-sl-soft text-sl-soft-ink" : "border-sl-border hover:border-sl-accent",
                    )}
                  >
                    <span className="flex shrink-0 overflow-hidden rounded-full border border-sl-border" aria-hidden>
                      {[p.primary, p.accent, p.background].map((c) => (
                        <span key={c} className="size-4" style={{ background: c }} />
                      ))}
                    </span>
                    {m[`palette${name}`]}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="grid grid-cols-3 gap-3">
            <legend className="mb-2 text-[13px] font-bold">{m.custom}</legend>
            {(["primary", "accent", "background"] as const).map((k) => (
              <Field key={k} label={m[k]}>
                <span className="flex items-center gap-2">
                  <input
                    type="color"
                    value={theme[k]}
                    onChange={(e) => set(k, e.target.value.toLowerCase())}
                    className="h-11 w-14 shrink-0 cursor-pointer rounded-sl-sm border border-sl-control bg-sl-panel p-1"
                  />
                  <span dir="ltr" className="hidden font-mono text-xs text-sl-muted sm:inline">
                    {theme[k]}
                  </span>
                </span>
              </Field>
            ))}
          </fieldset>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={m.radius}>
              <Select value={theme.radius} onChange={(e) => set("radius", e.target.value as Theme["radius"])}>
                {RADII.map((r) => (
                  <option key={r} value={r}>
                    {m[`radius${r}`]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={m.font}>
              <Select value={theme.font} onChange={(e) => set("font", e.target.value as Theme["font"])}>
                {FONTS.map((f) => (
                  <option key={f} value={f}>
                    {m[`font${f}`]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {failures.length === 0 ? (
            <Alert tone="success">{m.contrastOk}</Alert>
          ) : (
            <Alert tone="warning">
              <p>{m.contrastFail}</p>
              <ul className="mt-1 list-disc ps-5">
                {failures.map((f) => (
                  <li key={f.pair}>{fill(m.contrastRow, { pair: m[PAIR_KEYS[f.pair as keyof typeof PAIR_KEYS]] ?? f.pair, ratio: f.ratio })}</li>
                ))}
              </ul>
            </Alert>
          )}
          {save.error && <Alert tone="error">{save.error}</Alert>}
          {done && <Alert tone="success">{t.saved}</Alert>}
          <Button
            className="self-start"
            disabled={save.busy || failures.length > 0 || same(theme, saved)}
            onClick={async () => setDone(await save.run(() => api("/api/shop/branding", { method: "PATCH", body: theme })))}
          >
            {save.busy ? t.saving : m.saveBranding}
          </Button>
        </Card>

        <Logo logo={logo} m={m} t={t} />
      </div>

      <section aria-labelledby="branding-preview" className="flex flex-col gap-2 lg:sticky lg:top-[76px]">
        <h2 id="branding-preview" className="text-[13px] font-bold">
          {m.preview}
        </h2>
        <p className="text-xs text-sl-muted">{m.previewHint}</p>
        <MiniShop theme={theme} logo={logo} shop={shop} locale={locale} m={m} />
      </section>
    </div>
  );
}

/** A phone-sized storefront drawn with the sl-* tokens of the theme being edited. Decorative. */
function MiniShop({ theme, logo, shop, locale, m }: { theme: Theme; logo: string | null; shop: PreviewShop; locale: Locale; m: ShopMessages }) {
  const showImage = logo && shop.logoMode !== "name-only";
  const showName = !showImage || shop.logoMode === "image-and-name";
  const tiles: [string, string, number][] = [
    [m.previewProduct, m.previewDescription, shop.currency === "USD" ? 2400 : 2_150_000],
    [m.previewProduct2, m.previewDescription, shop.currency === "USD" ? 1850 : 1_650_000],
  ];
  const tabs: IconName[] = ["home", "grid", "truck", "cart"];

  return (
    <div
      aria-hidden
      lang={locale}
      data-tone={themeTone(theme)}
      style={{ ...themeVars(theme), fontFamily: "var(--font-shop)" }}
      className="sl-shop mx-auto w-full max-w-[320px] overflow-hidden rounded-[26px] border border-sl-border bg-sl-bg text-sl-fg shadow-[0_10px_24px_#0000000d]"
    >
      <div className="flex h-12 items-center gap-2 border-b border-sl-border bg-sl-panel px-3">
        <span className="grid size-8 place-items-center rounded-sl border border-sl-border">
          <Icon name="menu" className="size-4" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col items-center leading-tight">
          <span className="flex max-w-full items-center gap-1.5">
            {showImage && (
              // eslint-disable-next-line @next/next/no-img-element -- uploaded files are served as-is
              <img src={logo} alt="" className="h-7 max-w-24 object-contain" />
            )}
            {showName && <span className="sl-heading truncate text-[15px]">{shop.name}</span>}
          </span>
          {shop.tagline && <span className="max-w-full truncate text-[10px] text-sl-muted">{shop.tagline}</span>}
        </span>
        <span className="grid size-8 place-items-center rounded-sl border border-sl-border">
          <Icon name="bag" className="size-4" />
        </span>
      </div>

      <div className="flex flex-col gap-3 p-3">
        <div className="flex h-[112px] flex-col justify-center gap-1 rounded-[16px] bg-sl-hero px-4 text-sl-hero-ink">
          <span className="text-[9px] font-extrabold uppercase tracking-[0.15em] text-sl-accent rtl:tracking-normal">{m.previewHeroKicker}</span>
          <span className="sl-heading text-lg leading-tight">{m.previewHeroTitle}</span>
          <span className="mt-1 self-start rounded-full bg-sl-accent px-3 py-1 text-[11px] font-bold text-sl-accent-ink">{m.previewButton}</span>
        </div>

        <div>
          <p className="sl-heading mb-1.5 text-sm">{m.previewCategories}</p>
          <div className="flex gap-3">
            {(["heart", "star", "box", "grid"] as const).map((icon) => (
              <span key={icon} className="grid size-10 place-items-center rounded-full border border-sl-border bg-sl-cat text-sl-accent">
                <Icon name={icon} className="size-4" />
              </span>
            ))}
          </div>
        </div>

        <div>
          <p className="sl-heading mb-1.5 text-sm">{m.previewBestSellers}</p>
          <div className="grid grid-cols-2 gap-2">
            {tiles.map(([name, desc, minor], i) => (
              <div key={name} className="relative overflow-hidden rounded-sl border border-sl-border bg-sl-panel">
                <div className="aspect-[4/3] bg-sl-cat" />
                {i === 0 && (
                  <span className="absolute start-1.5 top-1.5 rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10px] font-bold text-[var(--accent-ink)]">{m.previewBadge}</span>
                )}
                <div className="flex flex-col gap-0.5 p-2">
                  <span className="truncate text-[11px] font-bold">{name}</span>
                  <span className="truncate text-[10px] text-sl-muted">{desc}</span>
                  <span className="flex items-center justify-between">
                    <bdi className="text-xs font-extrabold tabular-nums">{formatMoney(minor, shop.currency, locale)}</bdi>
                    <span className="grid size-5 place-items-center rounded-full bg-sl-accent text-sl-accent-ink">
                      <Icon name="plus" className="size-3" />
                    </span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <span className="flex h-9 flex-1 items-center justify-center rounded-sl border border-sl-accent text-[11px] font-bold text-sl-accent">{m.previewAddToCart}</span>
          <span className="flex h-9 flex-1 items-center justify-center rounded-sl bg-sl-accent text-[11px] font-bold text-sl-accent-ink">{m.previewButton}</span>
        </div>
      </div>

      <div className="grid grid-cols-4 border-t border-sl-border bg-sl-nav py-2">
        {tabs.map((icon, i) => (
          <span key={icon} className={cx("grid place-items-center", i === 0 ? "text-sl-accent" : "text-sl-muted")}>
            <Icon name={icon} solid={i === 0} className="size-5" />
          </span>
        ))}
      </div>
    </div>
  );
}

function Logo({ logo, m, t }: { logo: string | null; m: ShopMessages; t: CommonMessages }) {
  const action = useAction(t.error);
  return (
    <Card className="flex flex-col gap-3">
      <CardHead title={m.logo} hint={m.logoHint} />
      {action.error && <Alert tone="error">{action.error}</Alert>}
      <div className="flex flex-wrap items-center gap-3">
        {logo && (
          // eslint-disable-next-line @next/next/no-img-element -- uploaded files are served as-is
          <img src={logo} alt={m.logo} className="size-16 rounded-sl border border-sl-border bg-sl-panel object-contain p-1" />
        )}
        <FilePicker
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          busy={action.busy}
          onFile={(file) => {
            const form = new FormData();
            form.set("file", file);
            action.run(() => api("/api/shop/logo", { body: form }));
          }}
        >
          {action.busy ? m.uploading : logo ? m.replaceLogo : m.uploadLogo}
        </FilePicker>
        {logo && (
          <Button tone="ghost" disabled={action.busy} onClick={() => confirm(m.removeLogoConfirm) && action.run(() => api("/api/shop/logo", { method: "DELETE" }))}>
            {m.removeLogo}
          </Button>
        )}
      </div>
    </Card>
  );
}
