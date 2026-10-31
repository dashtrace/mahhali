import { describe, expect, it } from "vitest";
import { remapValues } from "@/server/domain/variants";

describe("remapValues", () => {
  const values = ["M", "Sand"];

  it("keeps values when nothing moves", () => {
    expect(remapValues(values, [0, 1])).toEqual(["M", "Sand"]);
  });

  it("adds a blank value for a new option and drops a removed one", () => {
    expect(remapValues(values, [0, 1, null])).toEqual(["M", "Sand", ""]);
    expect(remapValues(values, [1])).toEqual(["Sand"]);
    expect(remapValues(values, [])).toEqual([]);
  });

  it("follows a reorder", () => {
    expect(remapValues(values, [1, 0])).toEqual(["Sand", "M"]);
  });

  it("gives the first option to a product that had none", () => {
    expect(remapValues([], [null])).toEqual([""]);
  });

  it("reads a short row as blanks", () => {
    expect(remapValues(["M"], [0, 1])).toEqual(["M", ""]);
  });
});
