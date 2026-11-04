import { describe, expect, it } from "vitest";
import { productForItem } from "@/app/_storefront/orderItems";

describe("productForItem", () => {
  const rose = { name: "Rose" };
  const roseGold = { name: "Rose / Gold" };

  it("finds a product from an item name with or without options", () => {
    expect(productForItem([rose], "Rose")).toBe(rose);
    expect(productForItem([rose], "Rose / 50 ml")).toBe(rose);
  });

  it("prefers the exact name", () => {
    expect(productForItem([rose, roseGold], "Rose / Gold")).toBe(roseGold);
  });

  it("does not match a product whose name only starts the same", () => {
    expect(productForItem([rose], "Rosewater")).toBeUndefined();
  });
});
