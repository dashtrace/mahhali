// A shop's look: three colours (and optional saved colour roles), a corner radius
// and a font, applied as CSS variables on the catalogue, the tracking page and
// the dashboard header. Pure: no I/O, so the contrast rules are unit-tested directly.
export const RADII = ["none", "sm", "md", "lg", "full"] as const;
export const FONTS = ["system", "inter", "cairo", "tajawal"] as const;

export type Theme = {
  primary: string;
  /** Decoration only; never drawn behind or as text. */
  accent: string;
  background: string;
  /** Body text; black or white, whichever reads better on the background, when unset. */
  text?: string;
  // The rest are derived from the colours above when unset (storefrontTokens).
  surface?: string;
  muted?: string;
  dark?: string;
  darkText?: string;
  border?: string;
  buttonText?: string;
  radius: (typeof RADII)[number];
  font: (typeof FONTS)[number];
};

/** Ready-made palettes; each one passes validateTheme. */
export const PALETTES = {
  classic: { primary: "#1e3a8a", accent: "#b45309", background: "#ffffff", radius: "md", font: "system" },
  rose: { primary: "#9d174d", accent: "#be123c", background: "#fff1f2", radius: "lg", font: "inter" },
  cedar: { primary: "#166534", accent: "#92400e", background: "#fafaf9", radius: "sm", font: "cairo" },
  night: { primary: "#fbbf24", accent: "#5eead4", background: "#111827", radius: "md", font: "tajawal" },
} as const satisfies Record<string, Theme>;

export type PaletteName = keyof typeof PALETTES;
export const PALETTE_NAMES = Object.keys(PALETTES) as [PaletteName, ...PaletteName[]];

export const DEFAULT_THEME: Theme = PALETTES.classic;

/** WCAG AA for normal text. */
export const MIN_CONTRAST = 4.5;

/** WCAG relative luminance of "#rrggbb", from 0 (black) to 1 (white). */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two "#rrggbb" colours, from 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Black or white, whichever reads better on `background`. */
export function inkFor(background: string): "#000000" | "#ffffff" {
  return contrastRatio(background, "#000000") >= contrastRatio(background, "#ffffff") ? "#000000" : "#ffffff";
}

export type ContrastFailure = { pair: string; foreground: string; background: string; ratio: number };

/**
 * The colour pairs the pages draw text with, below AA. Button labels use
 * buttonText, or the page background colour when unset. Accent is decoration, so
 * it has no pair. Optional roles are only checked when saved; unset ones are derived.
 * Body text is the shop's text colour, or inkFor(background), which by construction is always at least 4.58.
 */
export function validateTheme(theme: Omit<Theme, "radius" | "font">): ContrastFailure[] {
  const body = theme.text ?? inkFor(theme.background);
  const pairs = [
    { pair: "text on primary", foreground: theme.buttonText ?? theme.background, background: theme.primary },
    { pair: "body text on background", foreground: body, background: theme.background },
    ...(theme.muted ? [{ pair: "muted text on background", foreground: theme.muted, background: theme.background }] : []),
    ...(theme.surface ? [{ pair: "body text on surface", foreground: body, background: theme.surface }] : []),
    ...(theme.dark ? [{ pair: "text on dark band", foreground: theme.darkText ?? theme.background, background: theme.dark }] : []),
  ];
  return pairs
    .map((p) => ({ ...p, ratio: contrastRatio(p.foreground, p.background) }))
    .filter((p) => p.ratio < MIN_CONTRAST)
    .map((p) => ({ ...p, ratio: Math.round(p.ratio * 100) / 100 }));
}
