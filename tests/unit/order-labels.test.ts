import { describe, expect, it } from "vitest";
import { age } from "@/app/dashboard/orders/_components/labels";

describe("age", () => {
  const now = Date.parse("2026-10-27T12:00:00Z");
  const ago = (minutes: number) => new Date(now - minutes * 60_000).toISOString();

  it("picks minutes, hours, then days", () => {
    // ICU wording varies a little between Node versions, so match loosely.
    expect(age(ago(12), "en", now)).toMatch(/^12 min/);
    expect(age(ago(180), "en", now)).toMatch(/^3 hr/);
    expect(age(ago(2 * 24 * 60), "en", now)).toMatch(/^2 days/);
  });

  it("keeps Latin digits in Arabic", () => {
    expect(age(ago(180), "ar", now)).toMatch(/3/);
  });
});
