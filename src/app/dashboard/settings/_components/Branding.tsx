"use client";

import { useState } from "react";
import { Alert, Button, Card, Field, Select, cx } from "@/components/ui";
import { fill } from "@/i18n/locale";
import type { CommonMessages } from "@/i18n/messages/common";
import type { ShopMessages } from "@/i18n/messages/shop";
import { api } from "@/lib/api";
import { FONTS, PALETTES, RADII, validateTheme, type PaletteName, type Theme } from "@/server/domain/theme";
import { themeVars } from "../../../_server/theme";
import { useAction } from "../../products/_components/useAction";

type Props = { theme: Theme; logo: string | null; m: ShopMessages; t: CommonMessages };

const PAIR_KEYS = { "text on primary": "pairPrimary", "text on accent": "pairAccent", "body text on background": "pairBackground" } as const;
const same = (a: Theme, b: Theme) => (Object.keys(a) as (keyof Theme)[]).every((k) => a[k] === b[k]);

export function Branding({ theme: saved, logo, m, t }: Props) {
  const [theme, setTheme] = useState<Theme>(saved);
  const [done, setDone] = useState(false);
  const save = useAction(t.error);
  const failures = validateTheme(theme);
  const set = <K extends keyof Theme>(k: K, v: Theme[K]) => {
    setDone(false);
    setTheme({ ...theme, [k]: v });
  };

  return (
    <>
      <Card className="flex flex-col gap-4">
        <h2 className="font-semibold">{m.brandingTitle}</h2>

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-stone-800">{m.palettes}</legend>
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
                    "flex min-h-11 items-center gap-2 rounded-[var(--radius)] border bg-white px-3 py-2 text-sm",
                    active ? "border-[var(--brand)] ring-2 ring-[var(--brand)]/25" : "border-stone-300",
                  )}
                >
                  <span className="flex shrink-0 overflow-hidden rounded-full border border-stone-200" aria-hidden>
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
          <legend className="mb-2 text-sm font-medium text-stone-800">{m.custom}</legend>
          {(["primary", "accent", "background"] as const).map((k) => (
            <Field key={k} label={m[k]}>
              <span className="flex items-center gap-2">
                <input
                  type="color"
                  value={theme[k]}
                  onChange={(e) => set(k, e.target.value.toLowerCase())}
                  className="h-11 w-14 shrink-0 cursor-pointer rounded-[var(--radius)] border border-stone-300 bg-white p-1"
                />
                <span dir="ltr" className="hidden font-mono text-xs text-stone-600 sm:inline">
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

        <section aria-label={m.preview}>
          <h3 className="mb-2 text-sm font-medium text-stone-800">{m.preview}</h3>
          <div
            style={{ ...themeVars(theme), background: "var(--surface)", color: "var(--ink)", fontFamily: "var(--font-shop)" }}
            className="rounded-[var(--radius)] border border-stone-200 p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{m.previewProduct}</p>
                <p className="text-sm opacity-80">{m.previewDescription}</p>
              </div>
              <span className="rounded-full bg-[var(--accent)] px-2.5 py-0.5 text-xs font-medium text-[var(--accent-ink)]">{m.previewBadge}</span>
            </div>
            <p className="mt-2 font-semibold text-[var(--brand)]">$24.00</p>
            <span className="mt-3 inline-flex min-h-11 items-center rounded-[var(--radius)] bg-[var(--brand)] px-4 text-sm font-medium text-[var(--brand-ink)]">
              {m.previewButton}
            </span>
          </div>
        </section>

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
    </>
  );
}

function Logo({ logo, m, t }: Omit<Props, "theme">) {
  const action = useAction(t.error);
  return (
    <Card className="flex flex-col gap-3">
      <div>
        <h2 className="font-semibold">{m.logo}</h2>
        <p className="text-sm text-stone-600">{m.logoHint}</p>
      </div>
      {action.error && <Alert tone="error">{action.error}</Alert>}
      <div className="flex flex-wrap items-center gap-3">
        {logo && (
          // eslint-disable-next-line @next/next/no-img-element -- uploaded files are served as-is
          <img src={logo} alt={m.logo} className="size-16 rounded-[var(--radius)] border border-stone-200 object-contain" />
        )}
        <label
          className={cx(
            "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-[var(--radius)] border border-stone-300 bg-white px-4 text-sm font-medium hover:bg-stone-50",
            "focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--brand)]",
            action.busy && "pointer-events-none opacity-50",
          )}
        >
          {action.busy ? m.uploading : logo ? m.replaceLogo : m.uploadLogo}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="sr-only"
            disabled={action.busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              const form = new FormData();
              form.set("file", file);
              action.run(() => api("/api/shop/logo", { body: form }));
            }}
          />
        </label>
        {logo && (
          <Button tone="ghost" disabled={action.busy} onClick={() => confirm(m.removeLogoConfirm) && action.run(() => api("/api/shop/logo", { method: "DELETE" }))}>
            {m.removeLogo}
          </Button>
        )}
      </div>
    </Card>
  );
}
