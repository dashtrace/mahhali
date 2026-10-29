import { describe, expect, it } from "vitest";
import { itemLabel, orderTotals, parseOrderNumber } from "@/server/domain/orders";
import { isEditable, movementDelta, stockEffect } from "@/server/domain/orderStatus";

describe("orderTotals", () => {
  it("adds lines and the delivery fee; the courier collects the total", () => {
    expect(orderTotals([{ unitPriceMinor: 2450n, qty: 2 }, { unitPriceMinor: 1000n, qty: 1 }], 300n)).toEqual({
      subtotalMinor: 5900n,
      deliveryFeeMinor: 300n,
      totalMinor: 6200n,
      codMinor: 6200n,
    });
  });

  it("handles pound amounts far beyond a 32-bit int", () => {
    expect(orderTotals([{ unitPriceMinor: 2_237_500_000n, qty: 3 }], 0n).totalMinor).toBe(6_712_500_000n);
  });
});

describe("labels and parsing", () => {
  it("names a line by product, size and colour, skipping the blanks", () => {
    expect(itemLabel("Linen shirt", "M", "Sand")).toBe("Linen shirt / M / Sand");
    expect(itemLabel("Ring", null, "Gold")).toBe("Ring / Gold");
    expect(itemLabel("Bag", null, null)).toBe("Bag");
  });

  it("reads order numbers the way customers type them", () => {
    expect(parseOrderNumber("#1042")).toBe(1042);
    expect(parseOrderNumber(" 1042 ")).toBe(1042);
    expect(parseOrderNumber("# 1042")).toBe(1042);
    expect(parseOrderNumber("10a")).toBeNull();
    expect(parseOrderNumber("")).toBeNull();
  });
});

describe("stock movements", () => {
  it("records units back into stock as positive and units leaving as negative", () => {
    expect(movementDelta(stockEffect("OUT_FOR_DELIVERY")!, 2)).toBe(-2);
    expect(movementDelta(stockEffect("CANCELLED")!, 2)).toBe(2);
    expect(movementDelta(stockEffect("RETURNED")!, 3)).toBe(3);
  });

  it("lets the address change only before the parcel leaves", () => {
    expect(["NEW", "CONFIRMED", "PACKED"].every((s) => isEditable(s as never))).toBe(true);
    expect(["OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "RETURNED"].some((s) => isEditable(s as never))).toBe(false);
  });
});
