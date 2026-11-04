"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { fill } from "@/i18n/locale";
import type { CommonMessages } from "@/i18n/messages/common";
import type { ShopMessages } from "@/i18n/messages/shop";
import { api } from "@/lib/api";
import { FONTS, PALETTES, RADII, inkFor, validateTheme, type PaletteName, type Theme } from "@/server/domain/theme";
import { storefrontTokens } from "../../../_server/theme";
import { DashIcon } from "../../_components/DashIcon";
import { FilePicker } from "../../products/_components/FilePicker";
import { useAction } from "../../products/_components/useAction";
import { SaveBtn, SettingField } from "./fields";
import { useLivePreview } from "./LivePreview";
import { COLOUR_ROLES, PAIR_MESSAGES, REQUIRED_ROLES, STORE_PALETTES, type StorePaletteName } from "./palettes";

type Props = { theme: Theme; logo: string | null; m: ShopMessages; t: CommonMessages };
type Role = (typeof COLOUR_ROLES)[number];

// A fixed key list: optional colours can be cleared, and that must still count as a change.
const KEYS = [...COLOUR_ROLES, "radius", "font"] as const;
const same = (a: Theme, b: Theme) => KEYS.every((k) => a[k] === b[k]);

/** What the storefront draws for each role right now, so an Automatic swatch shows its real colour. */
function drawnColours(theme: Theme): Record<Role, string> {
  const tokens = storefrontTokens(theme);
  return {
    primary: theme.primary,
    accent: theme.accent,
    background: theme.background,
    surface: tokens["--sl-surface"],
    text: theme.text ?? inkFor(theme.background),
    muted: tokens["--sl-muted"],
    dark: tokens["--sl-band"],
    darkText: tokens["--sl-band-ink"],
    border: tokens["--sl-line"],
    buttonText: tokens["--sl-accent-ink"],
  };
}

export function Branding({ theme: saved, logo: savedLogo, m, t }: Props) {
  const [theme, setTheme] = useState<Theme>(saved);
  // Set from the upload's response, so the new logo shows before the page refresh lands.
  const [logo, setLogo] = useState(savedLogo);
  const [done, setDone] = useState(false);
  const save = useAction(t.error);
  const preview = useLivePreview();
  const failures = validateTheme(theme);
  const dirty = !same(theme, saved);
  const drawn = drawnColours(theme);
  const change = (next: Theme) => {
    setDone(false);
    setTheme(next);
  };
  const set = <K extends keyof Theme>(k: K, v: Theme[K]) => change({ ...theme, [k]: v });
  /** Leaves the key out of the save, so the storefront derives this colour. */
  const setAutomatic = (k: Role) => {
    const next = { ...theme };
    delete next[k];
    change(next);
  };
  useEffect(() => preview.draft({ theme }), [preview, theme]);
  const palettes: { name: StorePaletteName | PaletteName; value: Theme }[] = [
    ...(Object.keys(STORE_PALETTES) as StorePaletteName[]).map((name) => ({ name, value: { ...STORE_PALETTES[name], radius: theme.radius, font: theme.font } })),
    ...(Object.keys(PALETTES) as PaletteName[]).map((name) => ({ name, value: { ...PALETTES[name] } })),
  ];
  const selected = palettes.find((p) => same(theme, p.value));

  const saveButton = (
    <SaveBtn
      type="button"
      state={{ busy: save.busy, dirty, saved: done }}
      labels={t}
      disabled={failures.length > 0}
      onClick={async () => {
        const ok = await save.run(() => api("/api/shop/branding", { method: "PATCH", body: theme }));
        setDone(ok);
        if (ok) preview.reload();
      }}
    >
      {m.saveBranding}
    </SaveBtn>
  );
  const saveError = save.error && <Alert tone="error" className="mb-3">{save.error}</Alert>;

  return (
    <>
      <div className="card">
        <h2>{m.brandingTitle}</h2>
        <p className="hint">{m.brandingHint}</p>

        <div className="between my-[14px] flex-wrap">
          <b>{m.palettes}</b>
          <span className="hint">{m.palettesHint}</span>
        </div>
        <div className="mb-[19px] flex flex-wrap items-center gap-[9px]">
          {palettes.map(({ name, value }) => (
            <button key={name} type="button" aria-pressed={selected?.name === name} onClick={() => change(value)} className={`palette-card${selected?.name === name ? " selected" : ""}`}>
              <span className="palette-swatches" aria-hidden>
                {[value.primary, value.accent, value.background, drawnColours(value).surface, drawnColours(value).dark].map((c, i) => (
                  <i key={i} style={{ background: c }} />
                ))}
              </span>
              <span>{m[`palette${name}`]}</span>
            </button>
          ))}
        </div>
        <div className="info-inline mb-[15px]">
          {selected ? (
            <>
              <b>{m.paletteSelected}</b> {m[`palette${selected.name}`]}.
            </>
          ) : (
            <b>{m.paletteCustom}.</b>
          )}{" "}
          {m.paletteNote}
        </div>

        <h3 className="mb-[14px]">{m.colourRoles}</h3>
        <div className="colorgrid">
          {COLOUR_ROLES.map((k) => (
            <div key={k} className="colorfield">
              <input
                id={`color-${k}`}
                type="color"
                value={drawn[k]}
                onChange={(e) => set(k, e.target.value.toLowerCase())}
              />
              <span>
                <label htmlFor={`color-${k}`}>
                  <strong>{m[`role${k}`]}</strong>
                </label>
                <span className="colorfield-value">
                  <code dir="ltr">{theme[k] ?? m.textAuto}</code>
                  {theme[k] && !REQUIRED_ROLES.includes(k) && (
                    <button type="button" aria-label={fill(m.setAutomatic, { role: m[`role${k}`] })} onClick={() => setAutomatic(k)}>
                      {m.textAuto}
                    </button>
                  )}
                </span>
              </span>
            </div>
          ))}
        </div>

        <div className="mt-4">{saveError}</div>
        <div className="actions">
          {saveButton}
          <button type="button" className="btn" disabled={!dirty || save.busy} onClick={() => change(saved)}>
            {m.restoreColours}
          </button>
        </div>
        {failures.length === 0 ? (
          <div role="status" className="info-inline mt-[15px]">
            <DashIcon name="info" size="sm" /> {m.contrastOk}
          </div>
        ) : (
          <div role="status" className="callout mb-0">
            <p>{m.contrastFail}</p>
            <ul className="mt-1 list-disc ps-5">
              {failures.map((f) => (
                <li key={f.pair}>{fill(m.contrastRow, { pair: m[PAIR_MESSAGES[f.pair as keyof typeof PAIR_MESSAGES]] ?? f.pair, ratio: f.ratio })}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="card">
        <h2>{m.typographyTitle}</h2>
        <p className="hint">{m.typographyHint}</p>
        <div className="split">
          <SettingField label={m.font}>
            <select className="control" value={theme.font} onChange={(e) => set("font", e.target.value as Theme["font"])}>
              {FONTS.map((f) => (
                <option key={f} value={f}>
                  {m[`font${f}`]}
                </option>
              ))}
            </select>
          </SettingField>
          <SettingField label={m.radius}>
            <select className="control" value={theme.radius} onChange={(e) => set("radius", e.target.value as Theme["radius"])}>
              {RADII.map((r) => (
                <option key={r} value={r}>
                  {m[`radius${r}`]}
                </option>
              ))}
            </select>
          </SettingField>
        </div>
        {saveError}
        {saveButton}
      </div>

      <Logo
        logo={logo}
        onChange={(next) => {
          setLogo(next);
          preview.reload();
        }}
        m={m}
        t={t}
      />

      <div className="card">
        <h2>{m.whereTitle}</h2>
        <p className="hint">{m.whereHint}</p>
        <div className="settings-mapping">
          {(["Hero", "Products", "Story", "Reviews", "Contact"] as const).map((k) => (
            <div key={k}>
              <b>{m[`where${k}`]}</b>
              <small>{m[`where${k}Body`]}</small>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function Logo({ logo, onChange, m, t }: { logo: string | null; onChange: (logo: string | null) => void; m: ShopMessages; t: CommonMessages }) {
  const action = useAction(t.error);
  const [uploaded, setUploaded] = useState(false);
  const [uploading, setUploading] = useState(false);
  return (
    <div className="card">
      <h2>{m.logo}</h2>
      <p className="hint">{m.logoHint}</p>
      {action.error && <Alert tone="error" className="mb-3">{action.error}</Alert>}
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
          <button
            type="button"
            className="btn"
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
          </button>
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
    </div>
  );
}
