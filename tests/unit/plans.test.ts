import { describe, expect, it } from "vitest";
import { orderLimit, PLANS } from "@/server/domain/plans";

describe("plans", () => {
  it("limits free shops to 50 orders a month", () => {
    expect(orderLimit("free")).toBe(50);
  });

  it("gives pro shops unlimited orders", () => {
    expect(orderLimit("pro")).toBeNull();
  });

  it("treats an unknown plan as free", () => {
    expect(orderLimit("enterprise")).toBe(PLANS.free.monthlyOrderLimit);
  });

  it("prices pro at $19/month", () => {
    expect(PLANS.pro.priceLabel).toBe("$19/month");
  });
});
