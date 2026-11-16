import { describe, expect, it } from "vitest";
import { matchesSearch, normalizeSearch } from "@/server/domain/arabic";

describe("Arabic-aware search", () => {
  it("ignores diacritics and tatweel", () => {
    expect(normalizeSearch("عِطْرٌ")).toBe("عطر");
    expect(normalizeSearch("عـــطر")).toBe("عطر");
  });

  it("treats the hamza forms of alef as plain alef", () => {
    expect(normalizeSearch("أحمر")).toBe("احمر");
    expect(normalizeSearch("إبريق")).toBe("ابريق");
    expect(normalizeSearch("آلة")).toBe("اله");
  });

  it("treats ة as ه and ى as ي", () => {
    expect(normalizeSearch("حقيبة")).toBe("حقيبه");
    expect(normalizeSearch("مستشفى")).toBe("مستشفي");
  });

  it("turns Arabic-Indic digits into western digits", () => {
    expect(normalizeSearch("مقاس ٤٢")).toBe("مقاس 42");
    expect(normalizeSearch("۱۲")).toBe("12");
  });

  it("lowercases Latin text, drops accents and collapses spaces", () => {
    expect(normalizeSearch("  Black   HOODIE ")).toBe("black hoodie");
    expect(normalizeSearch("Café crème")).toBe("cafe creme");
  });

  it("matches when every query word appears, in any order", () => {
    expect(matchesSearch("حقيبة يد جلد سوداء", "جلد حقيبه")).toBe(true);
    expect(matchesSearch("Black Hoodie", "hoodie black")).toBe(true);
    expect(matchesSearch("Black Hoodie", "white hoodie")).toBe(false);
    expect(matchesSearch("عطر الورد", "عِطر")).toBe(true);
  });

  it("matches everything for an empty query", () => {
    expect(matchesSearch("anything", "   ")).toBe(true);
  });
});
