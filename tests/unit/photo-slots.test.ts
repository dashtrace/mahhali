import { describe, expect, it } from "vitest";
import { colourCoverage, fitPicked } from "@/lib/photoSlots";

describe("photo slots on the add-photos page", () => {
  it("counts the photos of each colour", () => {
    const photos = [{ colour: "Beige" }, { colour: null }, { colour: "Beige" }];
    expect(colourCoverage(["Beige", "Black"], photos)).toEqual([
      { colour: "Beige", count: 2 },
      { colour: "Black", count: 0 },
    ]);
    expect(colourCoverage([], photos)).toEqual([]);
  });

  it("keeps only the picked photos that fit", () => {
    expect(fitPicked(["a", "b", "c"], 3, 5)).toEqual({ kept: ["a", "b"], dropped: 1 });
    expect(fitPicked(["a"], 0, 5)).toEqual({ kept: ["a"], dropped: 0 });
    expect(fitPicked(["a"], 5, 5)).toEqual({ kept: [], dropped: 1 });
  });
});
