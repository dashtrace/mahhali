import type { CSSProperties } from "react";
import { DEFAULT_THEME, FONTS, RADII, inkFor, type Theme } from "@/server/domain/theme";

const RADIUS: Record<Theme["radius"], string> = { none: "0", sm: "0.375rem", md: "0.75rem", lg: "1rem", full: "1.5rem" };
const FONT: Record<Theme["font"], string> = {
  system: "ui-sans-serif, system-ui, sans-serif",
  inter: "var(--font-inter), var(--font-cairo), sans-serif",
  cairo: "var(--font-cairo), sans-serif",
  tajawal: "var(--font-tajawal), var(--font-cairo), sans-serif",
};

const HEX = /^#[0-9a-f]{6}$/i;

/** The stored theme JSON, falling back to the default for anything malformed. */
export function readTheme(value: unknown): Theme {
  const t = (value ?? {}) as Partial<Record<keyof Theme, unknown>>;
  const color = (v: unknown, d: string) => (typeof v === "string" && HEX.test(v) ? v : d);
  return {
    primary: color(t.primary, DEFAULT_THEME.primary),
    accent: color(t.accent, DEFAULT_THEME.accent),
    background: color(t.background, DEFAULT_THEME.background),
    radius: (RADII as readonly unknown[]).includes(t.radius) ? (t.radius as Theme["radius"]) : DEFAULT_THEME.radius,
    font: (FONTS as readonly unknown[]).includes(t.font) ? (t.font as Theme["font"]) : DEFAULT_THEME.font,
  };
}

/**
 * CSS variables for a shop's pages. Labels on primary and accent use the page
 * background colour, the pairing validateTheme checked for contrast.
 */
export function themeVars(value: unknown, scope: "page" | "chrome" = "page"): CSSProperties {
  const t = readTheme(value);
  const vars: Record<string, string> = {
    "--brand": t.primary,
    "--brand-ink": t.background,
    "--accent": t.accent,
    "--accent-ink": t.background,
    "--radius": RADIUS[t.radius],
  };
  if (scope === "page") {
    vars["--surface"] = t.background;
    vars["--ink"] = inkFor(t.background);
    vars["--font-shop"] = FONT[t.font];
  }
  return vars as CSSProperties;
}
