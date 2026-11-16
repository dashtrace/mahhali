import { describe, expect, it } from "vitest";
import { readTheme, storefrontTokens, themeVars } from "@/app/_server/theme";
import { contrastRatio, PALETTES, validateTheme } from "@/server/domain/theme";

const ROSEWOOD = {
  primary: "#874258",
  accent: "#b99b7b",
  background: "#faf5f1",
  surface: "#f1e8e1",
  text: "#30282b",
  muted: "#756b68",
  dark: "#714558",
  darkText: "#fffaf5",
  border: "#e4d7d1",
  buttonText: "#ffffff",
  radius: "md",
  font: "system",
} as const;

describe("storefrontTokens", () => {
  const unsaved = { primary: ROSEWOOD.primary, accent: ROSEWOOD.accent, background: ROSEWOOD.background, text: ROSEWOOD.text };

  it.each([
    ["classic", PALETTES.classic],
    ["rose", PALETTES.rose],
    ["cedar", PALETTES.cedar],
    ["night", PALETTES.night],
    ["empty", {}],
    ["rosewood without roles", unsaved],
  ])("derives readable muted text and band text for %s", (_name, stored) => {
    const theme = readTheme(stored);
    const tokens = storefrontTokens(theme);
    expect(contrastRatio(tokens["--sl-muted"], theme.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(tokens["--sl-band-ink"], tokens["--sl-band"])).toBeGreaterThanOrEqual(4.5);
    expect(tokens["--sl-accent"]).toBe(theme.primary);
    expect(tokens["--sl-accent-ink"]).toBe(theme.background);
    expect(tokens["--sl-ornament"]).toBe(theme.accent);
  });

  it("uses the smallest muted mix that reads, starting at 55%", () => {
    // 55% black on white is #737373, which already passes.
    expect(storefrontTokens(readTheme(PALETTES.classic))["--sl-muted"]).toBe("#737373");
  });

  it("mixes surface, band and line from the theme", () => {
    const tokens = storefrontTokens(readTheme(PALETTES.classic));
    expect(tokens["--sl-surface"]).toBe("#edeff6"); // 8% #1e3a8a into white
    expect(tokens["--sl-band"]).toBe("#182e6e"); // 80% #1e3a8a with black
    expect(tokens["--sl-line"]).toBe("#e3e3e3"); // 11% black into white
  });

  it("falls back to black or white when the background is unreadable on the band", () => {
    const theme = readTheme({ primary: "#ffff00", accent: "#000000", background: "#ffffff", buttonText: "#000000" });
    const tokens = storefrontTokens(theme);
    expect(tokens["--sl-band-ink"]).toBe("#000000");
    expect(contrastRatio(tokens["--sl-band-ink"], tokens["--sl-band"])).toBeGreaterThanOrEqual(4.5);
  });

  it("honours saved darkText even when contrast on the derived band is low", () => {
    const tokens = storefrontTokens(readTheme({ ...PALETTES.classic, darkText: "#000000" }));
    expect(tokens["--sl-band-ink"]).toBe("#000000");
  });

  it("skips the surface tint when a saved text colour would fail on it", () => {
    const tokens = storefrontTokens(readTheme({ ...PALETTES.classic, text: "#767676" }));
    expect(tokens["--sl-surface"]).toBe("#ffffff");
  });

  it("returns every saved role exactly, and the saved theme passes validateTheme", () => {
    expect(validateTheme(ROSEWOOD)).toEqual([]);
    expect(storefrontTokens(readTheme(ROSEWOOD))).toEqual({
      "--sl-accent": "#874258",
      "--sl-accent-ink": "#ffffff",
      "--sl-ornament": "#b99b7b",
      "--sl-surface": "#f1e8e1",
      "--sl-surface-accent": "#874258",
      "--sl-surface-accent-ink": "#ffffff",
      "--sl-surface-muted": "#756b68",
      "--sl-muted": "#756b68",
      "--sl-band": "#714558",
      "--sl-band-ink": "#fffaf5",
      "--sl-line": "#e4d7d1",
    });
  });

  it("preserves chosen accent and muted colours on the surface", () => {
    const tokens = storefrontTokens(readTheme({ ...ROSEWOOD, surface: "#c9a0ae" }));
    expect(tokens["--sl-surface-accent"]).toBe(ROSEWOOD.primary);
    expect(tokens["--sl-surface-muted"]).toBe(ROSEWOOD.muted);
  });

  it("keeps chosen button and button-text colours instead of swapping them", () => {
    const theme = { primary: "#767676", background: "#ffffff", text: "#000000", surface: "#8a8a8a", buttonText: "#000000" };
    const tokens = storefrontTokens(readTheme(theme));
    expect(tokens["--sl-surface-accent"]).toBe(theme.primary);
    expect(tokens["--sl-surface-accent-ink"]).toBe(theme.buttonText);
  });
});

describe("explicit low-contrast colours", () => {
  it("keeps all saved roles exactly while still reporting advisory contrast failures", () => {
    const chosen = { ...ROSEWOOD, primary: "#ffffff", background: "#ffffff", text: "#ffffff", surface: "#ffffff", muted: "#ffffff", dark: "#ffffff", darkText: "#ffffff", buttonText: "#ffffff" };
    expect(validateTheme(chosen).length).toBeGreaterThan(0);
    const tokens = storefrontTokens(readTheme(chosen));
    for (const key of ["--sl-accent", "--sl-accent-ink", "--sl-surface", "--sl-surface-accent", "--sl-surface-accent-ink", "--sl-surface-muted", "--sl-muted", "--sl-band", "--sl-band-ink"] as const) expect(tokens[key]).toBe("#ffffff");
    expect(themeVars(chosen)).toMatchObject({ "--sl-bg": "#ffffff", "--sl-fg": "#ffffff" });
  });
});

describe("readTheme colour roles", () => {
  it("keeps valid roles and ignores invalid stored values", () => {
    const theme = readTheme({ ...PALETTES.classic, surface: "#F1E8E1", muted: "grey", dark: 12, darkText: null, border: "#fff", buttonText: "" });
    expect(theme).toEqual({ ...PALETTES.classic, surface: "#F1E8E1" });
    const tokens = storefrontTokens(theme);
    expect(tokens["--sl-muted"]).toBe(storefrontTokens(readTheme(PALETTES.classic))["--sl-muted"]);
    expect(tokens["--sl-accent-ink"]).toBe(PALETTES.classic.background);
  });

  it("leaves a stored theme without roles as it was", () => {
    expect(readTheme(PALETTES.rose)).toEqual(PALETTES.rose);
  });
});

describe("themeVars", () => {
  it("writes the roles on pages only, leaving the chrome scope alone", () => {
    const page = themeVars(ROSEWOOD) as Record<string, string>;
    expect(page).toMatchObject({ "--sl-accent-ink": "#ffffff", "--sl-band": "#714558", "--sl-line": "#e4d7d1", "--sl-bg": "#faf5f1", "--sl-fg": "#30282b" });
    expect(themeVars(ROSEWOOD, "chrome")).toEqual({
      "--brand": "#874258",
      "--brand-ink": "#faf5f1",
      "--accent": "#b99b7b",
      "--accent-ink": "#faf5f1",
      "--radius": "0.75rem",
    });
  });
});
