"use client";

import { useEffect, useState } from "react";
import { Alert, Button, Card, Field, SaveButton, Select, cx } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { fill } from "@/i18n/locale";
import type { CommonMessages } from "@/i18n/messages/common";
import type { ShopMessages } from "@/i18n/messages/shop";
import { api } from "@/lib/api";
import { FONTS, PALETTES, RADII, inkFor, validateTheme, type PaletteName, type Theme } from "@/server/domain/theme";
import { FilePicker } from "../../products/_components/FilePicker";
import { CardHead } from "../../products/_components/ProductExtras";
import { useAction } from "../../products/_components/useAction";
import { useLivePreview } from "./LivePreview";
import { STORE_PALETTES, type StorePaletteName } from "./palettes";

type Props = { theme: Theme; logo: string | null; m: ShopMessages; t: CommonMessages };

const PAIR_KEYS = {
  "text on primary": "pairPrimary",
  "body text on background": "pairBackground",
  "links on background": "pairLinks",
  "muted text on background": "pairMuted",
  "body text on surface": "pairSurface",
  "text on dark band": "pairBand",
} as const;
// A fixed key list: optional colours can be cleared, and that must still count as a change.
const KEYS = ["primary", "accent", "background", "text", "surface", "muted", "dark", "darkText", "border", "buttonText", "radius", "font"] as const;
const same = (a: Theme, b: Theme) => KEYS.every((k) => a[k] === b[k]);

export function Branding({ theme: saved, logo: savedLogo, m, t }: Props) {
  const [theme, setTheme] = useState<Theme>(saved);
  // Set from the upload's response, so the new logo shows before the page refresh lands.
  const [logo, setLogo] = useState(savedLogo);
  const [done, setDone] = useState(false);
  const save = useAction(t.error);
  const preview = useLivePreview();
  const failures = validateTheme(theme);
  const set = <K extends keyof Theme>(k: K, v: Theme[K]) => {
    setDone(false);
    setTheme({ ...theme, [k]: v });
  };
  useEffect(() => preview.draft({ theme }), [preview, theme]);
  const palettes: { name: StorePaletteName | PaletteName; value: Theme }[] = [
    ...(Object.keys(STORE_PALETTES) as StorePaletteName[]).map((name) => ({ name, value: { ...STORE_PALETTES[name], radius: theme.radius, font: theme.font } })),
    ...(Object.keys(PALETTES) as PaletteName[]).map((name) => ({ name, value: { ...PALETTES[name] } })),
  ];

  return (
    <>
      <div className="flex min-w-0 flex-col gap-4">
        <Card className="flex flex-col gap-4">
          <CardHead title={m.brandingTitle} />

          <fieldset>
            <legend className="mb-2 text-[13px] font-bold">{m.palettes}</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {palettes.map(({ name, value }) => {
                const active = same(theme, value);
                return (
                  <button
                    key={name}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      setDone(false);
                      setTheme(value);
                    }}
                    className={cx(
                      "flex min-h-11 items-center gap-2 rounded-sl-sm border bg-sl-panel px-3 py-2 text-sm font-bold",
                      active ? "border-sl-accent bg-sl-soft text-sl-soft-ink" : "border-sl-border hover:border-sl-accent",
                    )}
                  >
                    <span className="flex shrink-0 overflow-hidden rounded-full border border-sl-border" aria-hidden>
                      {[value.primary, value.accent, value.background].map((c) => (
                        <span key={c} className="size-4" style={{ background: c }} />
                      ))}
                    </span>
                    {m[`palette${name}`]}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <legend className="mb-2 text-[13px] font-bold">{m.custom}</legend>
            {(["primary", "accent", "background", "text"] as const).map((k) => (
              <Field key={k} label={m[k]}>
                <span className="flex items-center gap-2">
                  <input
                    type="color"
                    // An unset text colour shows the automatic one (black or white for the background).
                    value={theme[k] ?? inkFor(theme.background)}
                    onChange={(e) => set(k, e.target.value.toLowerCase())}
                    className="h-11 w-14 shrink-0 cursor-pointer rounded-sl-sm border border-sl-control bg-sl-panel p-1"
                  />
                  <span dir="ltr" className="hidden font-mono text-xs text-sl-muted sm:inline">
                    {theme[k] ?? m.textAuto}
                  </span>
                </span>
              </Field>
            ))}
            {theme.text && (
              <Button
                tone="ghost"
                className="col-span-2 justify-self-start sm:col-span-4"
                onClick={() => {
                  setDone(false);
                  setTheme((current) => {
                    const next = { ...current };
                    delete next.text;
                    return next;
                  });
                }}
              >
                {m.useAutoText}
              </Button>
            )}
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
          <SaveButton
            type="button"
            className="self-start"
            state={{ busy: save.busy, dirty: !same(theme, saved), saved: done }}
            labels={t}
            disabled={failures.length > 0}
            onClick={async () => {
              const ok = await save.run(() => api("/api/shop/branding", { method: "PATCH", body: theme }));
              setDone(ok);
              if (ok) preview.reload();
            }}
          >
            {m.saveBranding}
          </SaveButton>
        </Card>

        <Logo
          logo={logo}
          onChange={(next) => {
            setLogo(next);
            preview.reload();
          }}
          m={m}
          t={t}
        />
      </div>
    </>
  );
}

function Logo({ logo, onChange, m, t }: { logo: string | null; onChange: (logo: string | null) => void; m: ShopMessages; t: CommonMessages }) {
  const action = useAction(t.error);
  const [uploaded, setUploaded] = useState(false);
  const [uploading, setUploading] = useState(false);
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
          onFile={async (file) => {
            const form = new FormData();
            form.set("file", file);
            setUploaded(false);
            setUploading(true);
            const ok = await action.run(async () => onChange((await api<{ logo: string }>("/api/shop/logo", { body: form })).logo));
            setUploading(false);
            setUploaded(ok);
          }}
        >
          {uploading ? m.uploading : logo ? m.replaceLogo : m.uploadLogo}
        </FilePicker>
        {logo && (
          <Button
            tone="ghost"
            disabled={action.busy}
            onClick={() =>
              confirm(m.removeLogoConfirm) &&
              action.run(async () => {
                await api("/api/shop/logo", { method: "DELETE" });
                onChange(null);
                setUploaded(false);
              })
            }
          >
            {m.removeLogo}
          </Button>
        )}
        <span role="status" className="inline-flex items-center gap-1 text-sm font-bold text-sl-ok">
          {uploaded && (
            <>
              <Icon name="check" className="size-4" />
              {m.logoUploaded}
            </>
          )}
        </span>
      </div>
    </Card>
  );
}
