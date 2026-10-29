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
    const failures = validateTheme({ primary: "#777777", accent: "#ffff00", background: "#ffffff" });
    expect(failures).toEqual([
      { pair: "text on primary", foreground: "#ffffff", background: "#777777", ratio: 4.48 },
      { pair: "text on accent", foreground: "#ffffff", background: "#ffff00", ratio: 1.07 },
    ]);
  });

  it("does not round a ratio just under 4.5 up to a pass", () => {
    // #777777 on white is 4.478, so it fails even though it rounds to 4.48.
    expect(validateTheme({ primary: "#777777", accent: "#000000", background: "#ffffff" })).toHaveLength(1);
    expect(validateTheme({ primary: "#767676", accent: "#000000", background: "#ffffff" })).toEqual([]);
  });

  it("refuses a pale brand colour on a light page and accepts it on a dark one", () => {
    expect(validateTheme({ primary: "#f9a8d4", accent: "#1e3a8a", background: "#ffffff" })).toHaveLength(1);
    expect(validateTheme({ primary: "#f9a8d4", accent: "#fbbf24", background: "#111827" })).toEqual([]);
  });
});
