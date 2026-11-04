import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { STORE_PALETTES } from "@/app/dashboard/settings/_components/palettes";
import { validateTheme } from "@/server/domain/theme";

describe("store palettes", () => {
  it.each(Object.entries(STORE_PALETTES))("%s passes validateTheme", (_name, palette) => {
    expect(validateTheme(palette)).toEqual([]);
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
