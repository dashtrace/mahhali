import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { COLOUR_ROLES, PAIR_MESSAGES, STORE_PALETTES } from "@/app/dashboard/settings/_components/palettes";
import { shopMessages } from "@/i18n/messages/shop";
import { validateTheme } from "@/server/domain/theme";

describe("store palettes", () => {
  it.each(Object.entries(STORE_PALETTES))("%s passes validateTheme", (_name, palette) => {
    expect(validateTheme(palette)).toEqual([]);
  });
});

describe("brand colours tab", () => {
  it("has a plain name for all 10 roles in both languages", () => {
    expect(COLOUR_ROLES).toHaveLength(10);
    for (const m of [shopMessages.en, shopMessages.ar]) for (const k of COLOUR_ROLES) expect(m[`role${k}`]).toBeTruthy();
  });

  it("names every pair validateTheme can report", () => {
    // Everything the same colour, so every pair the theme enables fails.
    const c = "#808080";
    const failures = validateTheme({ primary: c, accent: c, background: c, text: c, surface: c, muted: c, dark: c, darkText: c, buttonText: c });
    expect(failures.map((f) => f.pair).sort()).toEqual(Object.keys(PAIR_MESSAGES).sort());
  });
});

describe("no hardcoded brand", () => {
  it("names no sample business in src", () => {
    const src = path.join(process.cwd(), "src");
    const files = readdirSync(src, { recursive: true, withFileTypes: true }).filter((f) => f.isFile());
    const hits = files.flatMap((f) => {
      const file = path.join(f.parentPath, f.name);
      return /Maison|Sillage|SENSE/.test(readFileSync(file, "utf8")) ? [path.relative(src, file)] : [];
    });
    expect(hits).toEqual([]);
  });
});
