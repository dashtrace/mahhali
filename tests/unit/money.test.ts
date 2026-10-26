import { describe, expect, it } from "vitest";
import { collectedInOrderCurrency, fromMinor, rateToHundredths, toMinor } from "@/server/domain/money";

describe("toMinor / fromMinor", () => {
  it("stores dollars as cents", () => {
    expect(toMinor("12.5", "USD")).toBe(1250n);
    expect(toMinor("12.50", "USD")).toBe(1250n);
    expect(toMinor("12", "USD")).toBe(1200n);
    expect(toMinor("0.05", "USD")).toBe(5n);
    expect(fromMinor(1250n, "USD")).toBe("12.50");
    expect(fromMinor(5n, "USD")).toBe("0.05");
  });

  it("stores pounds as whole pounds", () => {
    expect(toMinor("450000", "LBP")).toBe(450000n);
    expect(toMinor("4,500,000", "LBP")).toBe(4500000n);
    expect(fromMinor(450000n, "LBP")).toBe("450000");
  });

  it("refuses amounts that do not fit the currency", () => {
    expect(() => toMinor("12.505", "USD")).toThrow(RangeError);
    expect(() => toMinor("100.5", "LBP")).toThrow(RangeError);
    expect(() => toMinor("-3", "USD")).toThrow(RangeError);
    expect(() => toMinor("abc", "USD")).toThrow(RangeError);
  });

  it("handles amounts beyond a 32-bit integer", () => {
    // $25,000 at 89,500 is 2,237,500,000 pounds, more than 2^31.
    expect(toMinor("2237500000", "LBP")).toBe(2_237_500_000n);
  });
});

describe("collectedInOrderCurrency", () => {
  const rate = "89500";

  it("returns dollars unchanged for a dollar order paid in dollars", () => {
    expect(collectedInOrderCurrency({ usdCents: 2500n, lbp: 0n }, "USD", null)).toBe(2500n);
  });

  it("converts pounds to cents at the order's rate", () => {
    // $20 + 447,500 LBP (= $5) for a $25 order
    expect(collectedInOrderCurrency({ usdCents: 2000n, lbp: 447_500n }, "USD", rate)).toBe(2500n);
  });

  it("rounds to the nearest cent", () => {
    // 1,000 LBP at 89,500 = 1.117 cents -> 1 cent
    expect(collectedInOrderCurrency({ usdCents: 0n, lbp: 1000n }, "USD", rate)).toBe(1n);
  });

  it("converts dollars to pounds for a pound order", () => {
    expect(collectedInOrderCurrency({ usdCents: 1000n, lbp: 100_000n }, "LBP", rate)).toBe(995_000n);
  });

  it("needs a rate to mix currencies", () => {
    expect(() => collectedInOrderCurrency({ usdCents: 0n, lbp: 1n }, "USD", null)).toThrow(RangeError);
    expect(() => collectedInOrderCurrency({ usdCents: 1n, lbp: 0n }, "LBP", null)).toThrow(RangeError);
  });

  it("parses rates with decimals", () => {
    expect(rateToHundredths("89500.50")).toBe(8_950_050n);
    expect(() => rateToHundredths("0")).toThrow(RangeError);
  });
});
