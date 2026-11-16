import { describe, expect, it } from "vitest";
import { canSendAsIs, MAX_SIDE, QUALITY_STEPS, scaledSize, UPLOAD_MAX_BYTES } from "@/lib/photoResize";

describe("shrinking phone photos before upload", () => {
  it("keeps the proportions and caps the longest side", () => {
    expect(scaledSize(4032, 3024)).toEqual({ width: 2000, height: 1500 });
    expect(scaledSize(3024, 4032)).toEqual({ width: 1500, height: 2000 });
    expect(scaledSize(4000, 4000)).toEqual({ width: 2000, height: 2000 });
  });

  it("never enlarges a small photo", () => {
    expect(scaledSize(800, 600)).toEqual({ width: 800, height: 600 });
    expect(scaledSize(MAX_SIDE, 10)).toEqual({ width: MAX_SIDE, height: 10 });
  });

  it("keeps very thin photos at least a pixel wide", () => {
    expect(scaledSize(10_000, 1)).toEqual({ width: 2000, height: 1 });
  });

  it("sends small PNG, JPEG and WebP photos untouched", () => {
    expect(canSendAsIs({ type: "image/jpeg", size: 900_000 }, 1600, 1200)).toBe(true);
    expect(canSendAsIs({ type: "image/webp", size: 200_000 }, 800, 800)).toBe(true);
  });

  it("re-encodes photos that are too big, too large or another type", () => {
    expect(canSendAsIs({ type: "image/jpeg", size: UPLOAD_MAX_BYTES + 1 }, 1600, 1200)).toBe(false);
    expect(canSendAsIs({ type: "image/jpeg", size: 900_000 }, 4032, 3024)).toBe(false);
    expect(canSendAsIs({ type: "image/heic", size: 900_000 }, 1600, 1200)).toBe(false);
  });

  it("tries lower qualities in order", () => {
    expect([...QUALITY_STEPS].sort((a, b) => b - a)).toEqual(QUALITY_STEPS);
    expect(QUALITY_STEPS.every((q) => q > 0 && q < 1)).toBe(true);
  });
});
