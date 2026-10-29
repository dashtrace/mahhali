import { describe, expect, it } from "vitest";
import { normalizePhone } from "@/server/domain/phone";
import { isValidSlug } from "@/server/domain/slug";

describe("normalizePhone", () => {
  it("turns Lebanese local numbers into +961 format", () => {
    expect(normalizePhone("71 123 456")).toBe("+96171123456");
    expect(normalizePhone("03 123 456")).toBe("+9613123456");
    expect(normalizePhone("+961 71 123 456")).toBe("+96171123456");
  });

  it("rejects numbers that cannot be valid", () => {
    expect(normalizePhone("123")).toBeNull();
    expect(normalizePhone("not a phone")).toBeNull();
  });
});

describe("isValidSlug", () => {
  it("accepts short lowercase links", () => {
    expect(isValidSlug("layla-boutique")).toBe(true);
    expect(isValidSlug("shop7")).toBe(true);
  });

  it("rejects bad or reserved links", () => {
    expect(isValidSlug("Layla")).toBe(false);
    expect(isValidSlug("-layla")).toBe(false);
    expect(isValidSlug("a--b")).toBe(false);
    expect(isValidSlug("ab")).toBe(false);
    expect(isValidSlug("admin")).toBe(false);
  });
});
