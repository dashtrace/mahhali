import { describe, expect, it } from "vitest";
import { browseProducts, checkNote, isAllowedSocialUrl, matchPrice, moveTo, type BrowsableProduct } from "@/server/domain/storefront";

describe("isAllowedSocialUrl", () => {
  it("accepts https links on the network's own hosts", () => {
    expect(isAllowedSocialUrl("instagram", "https://instagram.com/layla.boutique")).toBe(true);
    expect(isAllowedSocialUrl("instagram", "https://www.instagram.com/layla.boutique/")).toBe(true);
    expect(isAllowedSocialUrl("facebook", "https://m.facebook.com/layla")).toBe(true);
  });

  it("refuses other hosts, plain http, logins, ports and look-alikes", () => {
    expect(isAllowedSocialUrl("instagram", "http://instagram.com/x")).toBe(false);
    expect(isAllowedSocialUrl("instagram", "https://instagram.com.evil.io/x")).toBe(false);
    expect(isAllowedSocialUrl("instagram", "https://evil.io/instagram.com")).toBe(false);
    expect(isAllowedSocialUrl("instagram", "https://user@instagram.com/x")).toBe(false);
    expect(isAllowedSocialUrl("instagram", "https://instagram.com:8443/x")).toBe(false);
    expect(isAllowedSocialUrl("instagram", "https://facebook.com/x")).toBe(false);
    expect(isAllowedSocialUrl("facebook", "javascript:alert(1)")).toBe(false);
    expect(isAllowedSocialUrl("facebook", "not a url")).toBe(false);
  });
});

describe("checkNote", () => {
  const engraving = { label: "Engraving", required: true, maxLength: 5 };

  it("drops a note for a product without customization", () => {
    expect(checkNote({ label: null, required: true, maxLength: 5 }, "hello world")).toEqual({ ok: true, note: null });
  });

  it("requires a note when the product says so, ignoring blanks", () => {
    expect(checkNote(engraving, undefined)).toEqual({ ok: false, code: "CUSTOMIZATION_REQUIRED" });
    expect(checkNote(engraving, "   ")).toEqual({ ok: false, code: "CUSTOMIZATION_REQUIRED" });
    expect(checkNote({ ...engraving, required: false }, "")).toEqual({ ok: true, note: null });
  });

  it("caps the length in characters, so Arabic counts like Latin", () => {
    expect(checkNote(engraving, " Maya ")).toEqual({ ok: true, note: "Maya" });
    expect(checkNote(engraving, "مايا ح")).toEqual({ ok: false, code: "NOTE_TOO_LONG" });
    expect(checkNote(engraving, "مايا")).toEqual({ ok: true, note: "مايا" });
  });
});

const product = (o: Partial<BrowsableProduct> & { id: string }): BrowsableProduct & { id: string } => ({
  name: o.id,
  description: null,
  categoryId: null,
  categoryName: null,
  featured: false,
  soldCount: 0,
  createdAt: "2026-10-01T00:00:00.000Z",
  variants: [{ priceMinor: 1000n, inStock: true }],
  ...o,
});

const ids = (r: { items: { id: string }[] }) => r.items.map((p) => p.id);

describe("matchPrice", () => {
  it("is the cheapest in-stock price in range, never a sold-out one", () => {
    const variants = [
      { priceMinor: 500n, inStock: false },
      { priceMinor: 1500n, inStock: true },
      { priceMinor: 900n, inStock: true },
    ];
    expect(matchPrice(variants)).toBe(900n);
    expect(matchPrice(variants, 1000n)).toBe(1500n);
    expect(matchPrice(variants, 0n, 600n)).toBeNull();
  });
});

describe("browseProducts", () => {
  const catalogue = [
    product({ id: "old", createdAt: "2026-09-01T00:00:00.000Z", soldCount: 3, categoryId: "c1", categoryName: "Rings" }),
    product({ id: "new", createdAt: "2026-10-20T00:00:00.000Z", featured: true, description: "Gold hoop" }),
    product({
      id: "cheap-sold-out",
      createdAt: "2026-10-10T00:00:00.000Z",
      soldCount: 9,
      variants: [
        { priceMinor: 200n, inStock: false },
        { priceMinor: 5000n, inStock: true },
      ],
    }),
  ];

  it("lists everything newest first by default", () => {
    expect(ids(browseProducts(catalogue))).toEqual(["new", "cheap-sold-out", "old"]);
  });

  it("filters by collection and category", () => {
    expect(ids(browseProducts(catalogue, { sort: "bestsellers" }))).toEqual(["cheap-sold-out", "old"]);
    expect(ids(browseProducts(catalogue, { sort: "featured" }))).toEqual(["new"]);
    expect(ids(browseProducts(catalogue, { categoryId: "c1" }))).toEqual(["old"]);
  });

  it("searches name, description and category name, ignoring case", () => {
    expect(ids(browseProducts(catalogue, { q: "HOOP" }))).toEqual(["new"]);
    expect(ids(browseProducts(catalogue, { q: "rings" }))).toEqual(["old"]);
  });

  it("matches a price range on in-stock variants only and reports the matched price", () => {
    const r = browseProducts(catalogue, { min: 0n, max: 1000n });
    expect(ids(r)).toEqual(["new", "old"]);
    expect(r.items[0].matchPriceMinor).toBe(1000n);
    expect(ids(browseProducts(catalogue, { min: 4000n }))).toEqual(["cheap-sold-out"]);
  });

  it("pages the results and clamps the page number", () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      product({ id: `p${i}`, createdAt: new Date(Date.UTC(2026, 0, 1 + i)).toISOString() }),
    );
    const last = browseProducts(many, { page: 2, pageSize: 8 });
    expect(last).toMatchObject({ total: 10, page: 2, pageCount: 2 });
    expect(ids(last)).toEqual(["p1", "p0"]);
    expect(browseProducts(many, { page: 99 }).page).toBe(2);
    expect(browseProducts(many, { page: -3 }).page).toBe(1);
    expect(browseProducts([], { page: 4 })).toEqual({ items: [], total: 0, page: 1, pageCount: 1 });
  });
});

describe("moveTo", () => {
  it("moves an id and shifts the rest", () => {
    expect(moveTo(["a", "b", "c"], "c", 0)).toEqual(["c", "a", "b"]);
    expect(moveTo(["a", "b", "c"], "a", 1)).toEqual(["b", "a", "c"]);
    expect(moveTo(["a", "b", "c"], "a", 99)).toEqual(["b", "c", "a"]);
    expect(moveTo(["a", "b"], "x", 0)).toEqual(["a", "b"]);
  });
});
