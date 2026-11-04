import { describe, expect, it } from "vitest";
import { appendOrders, mergeOrders } from "@/app/dashboard/orders/_components/boardPages";

const order = (id: string, day: number) => ({ id, createdAt: `2026-11-${String(day).padStart(2, "0")}T10:00:00.000Z` });
const ids = (rows: { id: string }[]) => rows.map((o) => o.id);
const fresh = (...rows: { id: string }[]) => new Set(rows.map((o) => o.id));

describe("mergeOrders", () => {
  const [d, c, b, a] = [order("d", 4), order("c", 3), order("b", 2), order("a", 1)];

  it("keeps loaded pages after a refresh, without duplicates", () => {
    expect(ids(mergeOrders([d, c], [d, c, b, a], fresh(d, c)))).toEqual(["d", "c", "b", "a"]);
  });

  it("keeps an order a new arrival pushed off the first page", () => {
    const newest = order("e", 5);
    expect(ids(mergeOrders([newest, d], [d, c, b], fresh(newest, d)))).toEqual(["e", "d", "c", "b"]);
  });

  it("drops an order that left this status", () => {
    expect(ids(mergeOrders([d, b], [d, c, b, a], fresh(d, b)))).toEqual(["d", "b", "a"]);
  });

  it("drops an order now on another status's first page", () => {
    expect(ids(mergeOrders([d], [d, c, b], fresh(d, b)))).toEqual(["d", "c"]);
  });

  it("empties when the first page is empty", () => {
    expect(mergeOrders([], [d, c], fresh())).toEqual([]);
  });
});

describe("appendOrders", () => {
  it("skips orders already listed", () => {
    expect(ids(appendOrders([order("b", 2)], [order("b", 2), order("a", 1)]))).toEqual(["b", "a"]);
  });
});
