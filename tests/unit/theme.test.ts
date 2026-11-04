import { describe, expect, it } from "vitest";
import { contrastRatio, DEFAULT_THEME, inkFor, PALETTES, validateTheme } from "@/server/domain/theme";

describe("contrastRatio", () => {
  it("matches known WCAG ratios", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#777777", "#ffffff")).toBeCloseTo(4.48, 2);
    expect(contrastRatio("#767676", "#ffffff")).toBeCloseTo(4.54, 2);
    expect(contrastRatio("#ff0000", "#ffffff")).toBeCloseTo(4.0, 1);
    expect(contrastRatio("#0000ff", "#ffffff")).toBeCloseTo(8.59, 2);
  });

  it("is 1 for the same colour and ignores order and case", () => {
    expect(contrastRatio("#3a7bd5", "#3a7bd5")).toBe(1);
    expect(contrastRatio("#FFFFFF", "#777777")).toBeCloseTo(contrastRatio("#777777", "#ffffff"), 10);
  });
});

describe("inkFor", () => {
  it("picks black on light colours and white on dark ones", () => {
    expect(inkFor("#ffffff")).toBe("#000000");
    expect(inkFor("#fbbf24")).toBe("#000000");
    expect(inkFor("#000000")).toBe("#ffffff");
    expect(inkFor("#1e3a8a")).toBe("#ffffff");
  });

  it("always reaches AA, even on the hardest mid grey", () => {
    for (const grey of ["#757575", "#767676", "#777777", "#787878"]) {
      expect(contrastRatio(inkFor(grey), grey)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("validateTheme", () => {
  it("accepts every ready-made palette and the default", () => {
    for (const theme of [...Object.values(PALETTES), DEFAULT_THEME]) {
      expect(validateTheme(theme)).toEqual([]);
    }
  });

  it("names each pair below 4.5:1 with its ratio", () => {
    const failures = validateTheme({ primary: "#777777", accent: "#000000", background: "#ffffff", text: "#999999" });
    expect(failures).toEqual([
      { pair: "text on primary", foreground: "#ffffff", background: "#777777", ratio: 4.48 },
      { pair: "body text on background", foreground: "#999999", background: "#ffffff", ratio: 2.85 },
    ]);
  });

  it("treats accent as decoration, so any accent passes", () => {
    for (const accent of ["#ffff00", "#ffffff", "#b99b7b"]) {
      expect(validateTheme({ primary: "#1e3a8a", accent, background: "#ffffff" })).toEqual([]);
    }
  });

  it("checks the button label against primary, using buttonText when saved", () => {
    const base = { primary: "#777777", accent: "#000000", background: "#ffffff" };
    expect(validateTheme({ ...base, primary: "#767676", buttonText: "#000000" })).toEqual([]);
    const pale = { ...base, primary: "#1e3a8a", buttonText: "#3f5a9a" };
    expect(validateTheme(pale)).toEqual([expect.objectContaining({ pair: "text on primary", foreground: "#3f5a9a" })]);
  });

  it("checks muted against the background only when muted is saved", () => {
    const base = { primary: "#1e3a8a", accent: "#b45309", background: "#ffffff" };
    expect(validateTheme({ ...base, muted: "#999999" })).toEqual([{ pair: "muted text on background", foreground: "#999999", background: "#ffffff", ratio: 2.85 }]);
    expect(validateTheme({ ...base, muted: "#666666" })).toEqual([]);
  });

  it("checks body text against the surface only when surface is saved", () => {
    const base = { primary: "#1e3a8a", accent: "#b45309", background: "#ffffff" };
    expect(validateTheme({ ...base, surface: "#000000" })).toEqual([{ pair: "body text on surface", foreground: "#000000", background: "#000000", ratio: 1 }]);
    expect(validateTheme({ ...base, surface: "#f1f5f9" })).toEqual([]);
    expect(validateTheme({ ...base, text: "#333333", surface: "#555555" })).toEqual([expect.objectContaining({ pair: "body text on surface", foreground: "#333333" })]);
  });

  it("checks the dark band only when dark is saved, using darkText or the background", () => {
    const base = { primary: "#1e3a8a", accent: "#b45309", background: "#ffffff" };
    expect(validateTheme({ ...base, darkText: "#ffffff" })).toEqual([]);
    expect(validateTheme({ ...base, dark: "#111111" })).toEqual([]);
    expect(validateTheme({ ...base, dark: "#cccccc" })).toEqual([expect.objectContaining({ pair: "text on dark band", foreground: "#ffffff", background: "#cccccc" })]);
    expect(validateTheme({ ...base, dark: "#111111", darkText: "#444444" })).toEqual([expect.objectContaining({ pair: "text on dark band", foreground: "#444444" })]);
  });

  it("does not round a ratio just under 4.5 up to a pass", () => {
    // #777777 on white is 4.478, so it fails even though it rounds to 4.48.
    expect(validateTheme({ primary: "#777777", accent: "#000000", background: "#ffffff" })).toHaveLength(1);
    expect(validateTheme({ primary: "#767676", accent: "#000000", background: "#ffffff" })).toEqual([]);
  });

  it("checks a chosen text colour against the background", () => {
    const base = { primary: "#1e3a8a", accent: "#b45309", background: "#ffffff" };
    expect(validateTheme({ ...base, text: "#999999" })).toEqual([{ pair: "body text on background", foreground: "#999999", background: "#ffffff", ratio: 2.85 }]);
    expect(validateTheme({ ...base, text: "#333333" })).toEqual([]);
  });

  it("still checks primary on the page when buttonText carries the button label", () => {
    const pale = { primary: "#e0a030", accent: "#000000", background: "#ffffff", buttonText: "#000000" };
    expect(validateTheme(pale).map((f) => f.pair)).toEqual(["links on background"]);
    expect(validateTheme({ ...pale, primary: "#874258", buttonText: "#ffffff" })).toEqual([]);
  });

  it("refuses a pale brand colour on a light page and accepts it on a dark one", () => {
    expect(validateTheme({ primary: "#f9a8d4", accent: "#1e3a8a", background: "#ffffff" })).toHaveLength(1);
    expect(validateTheme({ primary: "#f9a8d4", accent: "#fbbf24", background: "#111827" })).toEqual([]);
  });
});
