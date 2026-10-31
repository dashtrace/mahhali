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
  const longAgo = new Date("2026-01-01T00:00:00Z");

  it("defaults to the last 30 days, today included", () => {
    const p = periodOf(undefined, undefined, now);
    expect(p).toEqual({
      from: "2026-09-27",
      to: "2026-10-26",
      start: new Date("2026-09-27T00:00:00Z"),
      end: new Date("2026-10-27T00:00:00Z"),
    });
    expect(ordersPerDay(45, p, longAgo, now)).toBe(1.5);
  });

  it("treats from and to as whole UTC days", () => {
    const p = periodOf("2026-10-01", "2026-10-07", now);
    expect(p.start).toEqual(new Date("2026-10-01T00:00:00Z"));
    expect(p.end).toEqual(new Date("2026-10-08T00:00:00Z"));
    expect(ordersPerDay(14, p, longAgo, now)).toBe(2);
    expect(ordersPerDay(3, periodOf("2026-10-05", "2026-10-05", now), longAgo, now)).toBe(3);
  });

  it("averages over the days the shop was open, not the whole range", () => {
    const today = new Date("2026-10-31T10:00:00Z");
    // A shop that opened on 30 Oct with two orders, looking at all of October so far.
    expect(ordersPerDay(2, periodOf("2026-10-01", "2026-10-30", today), new Date("2026-10-30T09:00:00Z"), today)).toBe(2);
    // Days after today don't count either.
    expect(ordersPerDay(7, periodOf("2026-10-20", "2026-11-30", now), longAgo, now)).toBe(1);
    // A range that ends before the shop opened has no orders and no open days.
    expect(ordersPerDay(0, periodOf("2026-09-01", "2026-09-30", now), now, now)).toBe(0);
  });

  it("runs 30 days back from a given end", () => {
    expect(periodOf(undefined, "2026-10-10", now).from).toBe("2026-09-11");
  });
});
