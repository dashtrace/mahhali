import { describe, expect, it } from "vitest";
import { ORDER_STATUSES, allowedNext, canTransition, isFinal, stockEffect } from "@/server/domain/orderStatus";

describe("order status machine", () => {
  it("follows the board from New to Delivered", () => {
    expect(canTransition("NEW", "CONFIRMED")).toBe(true);
    expect(canTransition("CONFIRMED", "PACKED")).toBe(true);
    expect(canTransition("PACKED", "OUT_FOR_DELIVERY")).toBe(true);
    expect(canTransition("OUT_FOR_DELIVERY", "DELIVERED")).toBe(true);
  });

  it("allows cancelling only before the order leaves", () => {
    expect(canTransition("NEW", "CANCELLED")).toBe(true);
    expect(canTransition("CONFIRMED", "CANCELLED")).toBe(true);
    expect(canTransition("PACKED", "CANCELLED")).toBe(true);
    expect(canTransition("OUT_FOR_DELIVERY", "CANCELLED")).toBe(false);
  });

  it("allows a return only from Out for delivery", () => {
    expect(allowedNext("OUT_FOR_DELIVERY")).toContain("RETURNED");
    for (const s of ORDER_STATUSES.filter((s) => s !== "OUT_FOR_DELIVERY")) {
      expect(canTransition(s, "RETURNED")).toBe(false);
    }
  });

  it("refuses skipping steps and going backwards", () => {
    expect(canTransition("NEW", "DELIVERED")).toBe(false);
    expect(canTransition("PACKED", "CONFIRMED")).toBe(false);
    expect(canTransition("DELIVERED", "NEW")).toBe(false);
  });

  it("treats Delivered, Cancelled and Returned as final", () => {
    expect(ORDER_STATUSES.filter(isFinal).sort()).toEqual(["CANCELLED", "DELIVERED", "RETURNED"]);
  });

  it("describes what each move does to stock", () => {
    expect(stockEffect("OUT_FOR_DELIVERY")).toEqual({ reason: "SHIP", available: 0, reserved: -1 });
    expect(stockEffect("CANCELLED")).toEqual({ reason: "RELEASE", available: 1, reserved: -1 });
    expect(stockEffect("RETURNED")).toEqual({ reason: "RESTOCK", available: 1, reserved: 0 });
    expect(stockEffect("CONFIRMED")).toBeNull();
    expect(stockEffect("DELIVERED")).toBeNull();
  });
});
