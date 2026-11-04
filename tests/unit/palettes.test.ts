import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import type { CSSProperties } from "react";
import { describe, expect, it } from "vitest";
import { themeVars } from "@/app/_server/theme";
import { COLOUR_ROLES, PAIR_MESSAGES, STORE_LOOK, STORE_PALETTES } from "@/app/dashboard/settings/_components/palettes";
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

  it("gives the store palettes the approved storefront's look", () => {
    expect(STORE_LOOK.radius).toBe("sm");
    // The label an owner sees has to name the face themeVars draws for this value.
    expect(themeVars({ font: STORE_LOOK.font })["--font-shop" as keyof CSSProperties]).toContain("--font-dm-sans");
    expect(shopMessages.en[`font${STORE_LOOK.font}`]).toBe("DM Sans");
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
