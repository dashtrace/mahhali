import { describe, expect, it } from "vitest";
import { medianConfirmMinutes, ordersPerDay, periodOf } from "@/server/domain/metrics";

const at = (minutes: number) => new Date(Date.UTC(2026, 9, 1, 9, 0) + minutes * 60_000);
const confirmedAfter = (minutes: number) => ({ firstContactAt: at(0), confirmedAt: at(minutes) });

describe("medianConfirmMinutes", () => {
  it("takes the middle value of an odd count", () => {
    expect(medianConfirmMinutes([confirmedAfter(30), confirmedAfter(5), confirmedAfter(12)])).toBe(12);
  });

  it("averages the two middle values of an even count", () => {
    expect(medianConfirmMinutes([confirmedAfter(10), confirmedAfter(40), confirmedAfter(15), confirmedAfter(1)])).toBe(12.5);
  });

  it("ignores orders not confirmed yet", () => {
    expect(medianConfirmMinutes([confirmedAfter(20), { firstContactAt: at(0), confirmedAt: null }])).toBe(20);
  });

  it("is null when nothing was confirmed", () => {
    expect(medianConfirmMinutes([])).toBeNull();
    expect(medianConfirmMinutes([{ firstContactAt: at(0), confirmedAt: null }])).toBeNull();
  });
});

describe("periodOf / ordersPerDay", () => {
  const now = new Date("2026-10-26T15:30:00Z");

  it("defaults to the last 30 days, today included", () => {
    const p = periodOf(undefined, undefined, now);
    expect(p).toEqual({
      from: "2026-09-27",
      to: "2026-10-26",
      start: new Date("2026-09-27T00:00:00Z"),
      end: new Date("2026-10-27T00:00:00Z"),
    });
    expect(ordersPerDay(45, p)).toBe(1.5);
  });

  it("treats from and to as whole UTC days", () => {
    const p = periodOf("2026-10-01", "2026-10-07", now);
    expect(p.start).toEqual(new Date("2026-10-01T00:00:00Z"));
    expect(p.end).toEqual(new Date("2026-10-08T00:00:00Z"));
    expect(ordersPerDay(14, p)).toBe(2);
    expect(ordersPerDay(3, periodOf("2026-10-05", "2026-10-05", now))).toBe(3);
  });

  it("runs 30 days back from a given end", () => {
    expect(periodOf(undefined, "2026-10-10", now).from).toBe("2026-09-11");
  });
});
