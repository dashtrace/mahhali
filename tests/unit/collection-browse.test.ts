import { describe, expect, it, vi } from "vitest";
import { browseProducts, type BrowsableProduct } from "@/server/domain/storefront";
import { filterHref } from "@/app/s/[slug]/_components/browse";
import { extrasBody, extrasOf } from "@/app/dashboard/products/_components/ProductExtras";

vi.mock("@/app/dashboard/_components/DashIcon", () => ({ DashIcon: () => null }));

const item = (id: string, categoryId: string, collectionId: string | null, sectionId: string | null): BrowsableProduct & { id: string } => ({
  id, categoryId, collectionId, sectionId, name: "Rose", description: null, categoryName: null,
  featured: true, soldCount: 2, createdAt: "2026-11-14T00:00:00Z", variants: [{ priceMinor: 2000n, inStock: true }],
});
const products = [item("plain", "sense", null, null), item("her", "sense", "signature", "her"), item("him", "sense", "signature", "him"), item("musk", "sense", "musk", null), item("aura", "recreation", "aura", "women")];
const ids = (options: Parameters<typeof browseProducts>[1]) => browseProducts(products, options).items.map((p) => p.id);

describe("collection browsing", () => {
  it("includes category-only products at the category level and narrows each optional level", () => {
    expect(ids({ categoryId: "sense" })).toEqual(["plain", "her", "him", "musk"]);
    expect(ids({ categoryId: "sense", collectionId: "signature" })).toEqual(["her", "him"]);
    expect(ids({ categoryId: "sense", collectionId: "signature", sectionId: "her" })).toEqual(["her"]);
    expect(ids({ categoryId: "recreation", collectionId: "signature" })).toEqual([]);
    expect(ids({ categoryId: "sense", collectionId: "musk", sectionId: "her" })).toEqual([]);
  });
  it("combines taxonomy with search, price, sort and pagination", () => {
    const opts = { categoryId: "sense", collectionId: "signature", q: "rose", min: 1000n, max: 2500n, sort: "featured" as const, pageSize: 1, page: 2 };
    expect(browseProducts(products, opts)).toMatchObject({ total: 2, pageCount: 2, page: 2 });
    expect(ids(opts)).toEqual(["him"]);
    expect(ids({ ...opts, min: 2500n })).toEqual([]);
  });
  it("clears lower URL filters when switching parents, while search and price keep placement", () => {
    const f = { cat: "sense", collection: "signature", section: "her", q: "rose", min: "10" };
    const url = (change: Parameters<typeof filterHref>[2]) => new URL(filterHref("demo", f, change), "http://local").searchParams;
    expect([...url({ cat: "recreation" }).keys()]).toEqual(["cat", "q", "min"]);
    expect(url({ collection: "musk" }).has("section")).toBe(false);
    expect(url({ collection: undefined }).has("section")).toBe(false);
    expect(url({ q: "amber" }).get("section")).toBe("her");
    expect(url({ min: "20" }).get("collection")).toBe("signature");
    expect(url({ cat: undefined }).has("collection")).toBe(false);
  });
  it("round-trips placement through the dashboard edit fields, including existing products", () => {
    const p = { categoryId: "sense", collectionId: "signature", sectionId: "her", featured: false, specs: null, customLabel: null, customPlaceholder: null, customRequired: false, customMaxLength: 240 };
    expect(extrasBody(extrasOf(p))).toMatchObject({ categoryId: "sense", collectionId: "signature", sectionId: "her" });
    expect(extrasBody(extrasOf({ ...p, collectionId: undefined, sectionId: undefined }))).toMatchObject({ collectionId: null, sectionId: null });
  });
});
