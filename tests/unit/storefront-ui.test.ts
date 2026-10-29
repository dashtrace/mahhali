import { describe, expect, it } from "vitest";
import { MAX_QTY, fromLegacy, parseLines, qtyOf, roomIn, withLine } from "@/app/_storefront/cart";
import { cx, pageTokens } from "@/components/ui";

describe("cx", () => {
  it("lets a later class replace an earlier one of the same group", () => {
    expect(cx("p-4 text-sm text-sl-fg rounded-sl-lg", "p-0 text-sl-danger rounded-full")).toBe("text-sm p-0 text-sl-danger rounded-full");
    expect(cx("border border-sl-border bg-sl-panel", "border-sl-danger! bg-[color-mix(in_srgb,red_10%,white)]")).toBe("border border-sl-danger! bg-[color-mix(in_srgb,red_10%,white)]");
  });

  it("keeps different variants, sizes vs colours, sides and images apart", () => {
    const keep = "text-[13px] text-[#c34538] hover:text-sl-accent border-b border-sl-border rounded-sl rounded-t-none min-h-11 h-9 bg-sl-hero bg-[radial-gradient(circle,red,blue)] [--tone:#123456] has-[a:focus-visible]:outline-3";
    expect(cx(keep)).toBe(keep);
    expect(cx("[--tone:red]", "[--tone:blue]", false, null, "inline-flex", "hidden")).toBe("[--tone:blue] hidden");
  });
});

describe("pageTokens", () => {
  it("shows every page up to 7", () => {
    expect(pageTokens(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("keeps first, last and current ±1, with gaps", () => {
    expect(pageTokens(6, 12)).toEqual([1, "…", 5, 6, 7, "…", 12]);
  });

  it("adds the first or last three near either end", () => {
    expect(pageTokens(1, 12)).toEqual([1, 2, 3, "…", 12]);
    expect(pageTokens(12, 12)).toEqual([1, "…", 10, 11, 12]);
  });
});

describe("cart lines", () => {
  it("keeps the same variant with different notes as separate lines", () => {
    let lines = withLine([], { variantId: "v", qty: 1, note: "Sara" }).lines;
    lines = withLine(lines, { variantId: "v", qty: 2, note: " Sara " }).lines;
    lines = withLine(lines, { variantId: "v", qty: 1 }).lines;
    expect(lines).toEqual([
      { variantId: "v", qty: 3, note: "Sara" },
      { variantId: "v", qty: 1 },
    ]);
  });

  it("caps a variant at MAX_QTY summed across its lines", () => {
    const first = withLine([], { variantId: "v", qty: MAX_QTY - 1, note: "a" });
    const second = withLine(first.lines, { variantId: "v", qty: 5, note: "b" });
    expect(second.added).toBe(1);
    expect(qtyOf(second.lines, "v")).toBe(MAX_QTY);
    expect(withLine(second.lines, { variantId: "v", qty: 1 }).added).toBe(0);
  });

  it("leaves room only up to the stock left, across all lines of a variant", () => {
    const lines = [{ variantId: "v", qty: 1, note: "a" }, { variantId: "v", qty: 1 }];
    expect(roomIn(lines, "v", 3)).toBe(1);
    expect(roomIn(lines, "v", 1)).toBe(-1); // cart holds more than is left
    expect(roomIn(lines, "v")).toBe(MAX_QTY - 2);
    expect(roomIn([], "v", 50)).toBe(MAX_QTY);
  });

  it("drops junk and migrates the old { variantId: qty } shape", () => {
    expect(parseLines([{ variantId: "v", qty: 0 }, { variantId: 3, qty: 1 }, null, { variantId: "w", qty: 2 }])).toEqual([{ variantId: "w", qty: 2 }]);
    expect(fromLegacy({ a: 2, b: 99, c: -1 })).toEqual([
      { variantId: "a", qty: 2 },
      { variantId: "b", qty: MAX_QTY },
    ]);
  });
});
