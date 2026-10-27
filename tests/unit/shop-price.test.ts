import { describe, expect, it } from "vitest";
import { parsePrice, parsePriceRange, shopHref } from "@/app/s/[slug]/_components/browse";

describe("shop price filter", () => {
  it("reads empty as no bound and amounts as minor units", () => {
    expect(parsePrice("", "USD")).toBeNull();
    expect(parsePrice("12.5", "USD")).toBe(1250n);
    expect(parsePrice("450000", "LBP")).toBe(450000n);
  });

  it("rejects negatives, extra decimals, decimals in LBP and amounts over 10,000,000", () => {
    for (const bad of ["-1", "1.234", "abc", "10000000.01"]) expect(parsePrice(bad, "USD")).toBeUndefined();
    expect(parsePrice("1.5", "LBP")).toBeUndefined();
    expect(parsePrice("10000000", "USD")).toBe(1_000_000_000n);
  });

  it("rejects a minimum above the maximum but allows one-sided ranges", () => {
    expect(parsePriceRange("50", "10", "USD")).toBeNull();
    expect(parsePriceRange("", "10", "USD")).toEqual({ min: null, max: 1000n });
    expect(parsePriceRange("x", "", "USD")).toBeNull();
  });

  it("builds listing links with only the set params", () => {
    expect(shopHref("demo", { q: "", cat: "c1", page: 2, min: undefined })).toBe("/s/demo/shop?cat=c1&page=2");
    expect(shopHref("demo", {})).toBe("/s/demo/shop");
  });
});
