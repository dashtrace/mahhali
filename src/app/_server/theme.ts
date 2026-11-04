import type { CSSProperties } from "react";
import { DEFAULT_THEME, FONTS, MIN_CONTRAST, RADII, contrastRatio, inkFor, type Theme } from "@/server/domain/theme";

const RADIUS: Record<Theme["radius"], string> = { none: "0", sm: "0.375rem", md: "0.75rem", lg: "1rem", full: "1.5rem" };
const FONT: Record<Theme["font"], string> = {
  system: "ui-sans-serif, system-ui, sans-serif",
  // The approved storefront's text face. The fallback is for previews outside ShopFrame, which don't load it.
  inter: "var(--font-dm-sans, var(--font-inter)), var(--font-cairo), sans-serif",
  cairo: "var(--font-cairo), sans-serif",
  tajawal: "var(--font-tajawal), var(--font-cairo), sans-serif",
};

const HEX = /^#[0-9a-f]{6}$/i;
const OPTIONAL_COLORS = ["text", "surface", "muted", "dark", "darkText", "border", "buttonText"] as const;

/** The stored theme JSON, falling back to the default for anything malformed. */
export function readTheme(value: unknown): Theme {
  const t = (value ?? {}) as Partial<Record<keyof Theme, unknown>>;
  const color = (v: unknown, d: string) => (typeof v === "string" && HEX.test(v) ? v : d);
  const optional = OPTIONAL_COLORS.filter((k) => color(t[k], "")).map((k) => [k, t[k]] as const);
  return {
    primary: color(t.primary, DEFAULT_THEME.primary),
    accent: color(t.accent, DEFAULT_THEME.accent),
    background: color(t.background, DEFAULT_THEME.background),
    ...(Object.fromEntries(optional) as Pick<Theme, (typeof OPTIONAL_COLORS)[number]>),
    radius: (RADII as readonly unknown[]).includes(t.radius) ? (t.radius as Theme["radius"]) : DEFAULT_THEME.radius,
    font: (FONTS as readonly unknown[]).includes(t.font) ? (t.font as Theme["font"]) : DEFAULT_THEME.font,
  };
}

/** "dark" when the shop's background needs white text; drives the .sl-shop[data-tone] styles. */
export function themeTone(value: unknown): "light" | "dark" {
  return inkFor(readTheme(value).background) === "#ffffff" ? "dark" : "light";
}

/** sRGB mix of p% a with the rest b, the same maths as CSS color-mix(in srgb, ...). */
function mix(a: string, b: string, p: number): string {
  const channel = (hex: string, i: number) => parseInt(hex.slice(i, i + 2), 16);
  const mixed = [1, 3, 5].map((i) => Math.round((channel(a, i) * p + channel(b, i) * (100 - p)) / 100));
  return `#${mixed.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/** The smallest mix of ink into the background that still reads as text on that background. */
function derivedMuted(ink: string, background: string): string {
  for (let p = 55; p < 100; p++) {
    const muted = mix(ink, background, p);
    if (contrastRatio(muted, background) >= MIN_CONTRAST) return muted;
  }
  return ink;
}

/**
 * The storefront colour roles: the saved value when set, otherwise derived, so
 * shops saved before the roles existed keep working. --sl-ornament is decoration,
 * never text. Accent and muted are only guaranteed on the page, so --sl-surface-*
 * are what text uses on --sl-surface (.sl-on-surface in globals.css).
 * Derived colours can pair with a saved one validateTheme never saw, so they check themselves.
 */
export function storefrontTokens(t: Theme) {
  const ink = t.text ?? inkFor(t.background);
  const band = t.dark ?? mix(t.primary, ink, 80);
  const reads = (fg: string, bg: string) => contrastRatio(fg, bg) >= MIN_CONTRAST;
  const tint = mix(t.primary, t.background, 8);
  const surface = t.surface ?? (reads(ink, tint) ? tint : t.background);
  const muted = t.muted ?? derivedMuted(ink, t.background);
  const accentInk = t.buttonText ?? t.background;
  const surfaceAccent = reads(t.primary, surface) ? t.primary : ink;
  return {
    "--sl-accent": t.primary,
    "--sl-accent-ink": accentInk,
    "--sl-ornament": t.accent,
    "--sl-surface": surface,
    "--sl-surface-accent": surfaceAccent,
    // A button on the surface fills with --sl-surface-accent, which button text was never checked against.
    "--sl-surface-accent-ink": reads(accentInk, surfaceAccent) ? accentInk : inkFor(surfaceAccent),
    "--sl-surface-muted": reads(muted, surface) ? muted : derivedMuted(ink, surface),
    "--sl-muted": muted,
    "--sl-band": band,
    "--sl-band-ink": [t.darkText, t.background].find((c) => c && reads(c, band)) ?? inkFor(band),
    "--sl-line": t.border ?? mix(ink, t.background, 11),
  };
}

/**
 * CSS variables for a shop's pages. The sl-* tokens go on an element with class
 * "sl-shop", which derives the rest.
 */
export function themeVars(value: unknown, scope: "page" | "chrome" = "page"): CSSProperties {
  const t = readTheme(value);
  // Borders and controls are mixed from this in globals.css, so they follow it.
  const ink = t.text ?? inkFor(t.background);
  const vars: Record<string, string> = {
    "--brand": t.primary,
    "--brand-ink": t.background,
    "--accent": t.accent,
    "--accent-ink": t.background,
    "--radius": RADIUS[t.radius],
  };
  if (scope === "page") {
    vars["--surface"] = t.background;
    vars["--ink"] = ink;
    vars["--font-shop"] = FONT[t.font];
    vars["--sl-bg"] = t.background;
    vars["--sl-fg"] = ink;
    vars["--sl-r"] = RADIUS[t.radius];
    Object.assign(vars, storefrontTokens(t));
  }
  return vars as CSSProperties;
}
