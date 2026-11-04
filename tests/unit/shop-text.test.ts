import { describe, expect, it } from "vitest";
import { nameUnits, socialHandle } from "@/lib/format";

describe("socialHandle", () => {
  it("reads one plain handle from a profile link", () => {
    expect(socialHandle("https://www.instagram.com/yourshop/")).toBe("@yourshop");
    expect(socialHandle("https://facebook.com/your.shop?ref=x")).toBe("@your.shop");
  });

  it("gives up on links that aren't a handle", () => {
    expect(socialHandle("https://www.facebook.com/profile.php?id=1")).toBeNull();
    expect(socialHandle("https://www.facebook.com/pages/Shop/123")).toBeNull();
    expect(socialHandle("https://www.instagram.com/")).toBeNull();
  });

  it("gives up on a link still being typed instead of throwing", () => {
    expect(socialHandle("https://")).toBeNull();
    expect(socialHandle("https://a b")).toBeNull();
  });
});

describe("nameUnits", () => {
  it("never counts a name as shorter than it is, so average names keep their size", () => {
    expect(nameUnits("Illustrate")).toBe(10);
  });

  it("counts wide letters for more", () => {
    expect(nameUnits("Mohammad Shop")).toBeGreaterThan(14);
    expect(nameUnits("مطعم")).toBe(4);
  });
});
