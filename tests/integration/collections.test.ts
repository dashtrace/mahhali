import { beforeAll, describe, expect, it } from "vitest";
import { POST as addCategory, GET as categories } from "@/app/api/categories/route";
import { DELETE as deleteCategory } from "@/app/api/categories/[id]/route";
import { POST as addCollection } from "@/app/api/categories/[id]/collections/route";
import { PATCH as editCollection, DELETE as deleteCollection } from "@/app/api/collections/[id]/route";
import { POST as addSection } from "@/app/api/collections/[id]/sections/route";
import { PATCH as editSection, DELETE as deleteSection } from "@/app/api/sections/[id]/route";
import { POST as addProduct } from "@/app/api/products/route";
import { PATCH as editProduct } from "@/app/api/products/[id]/route";
import { GET as catalogue } from "@/app/api/public/shops/[slug]/catalogue/route";
import { catalogueService } from "@/server/services/productService";
import { prisma } from "@/server/db";
import { addMember, call, resetDb, signUpOwner } from "./helpers";

type Owner = Awaited<ReturnType<typeof signUpOwner>>;
let owner: Owner, other: Owner, staff: string, manager: string;
beforeAll(async () => {
  await resetDb();
  owner = await signUpOwner(); other = await signUpOwner();
  staff = (await addMember(owner.shop.id, "staff")).cookie;
  manager = (await addMember(owner.shop.id, "manager")).cookie;
});
async function tree(name = crypto.randomUUID()) {
  const cat = await call(addCategory, "/api/categories", { method: "POST", cookie: owner.cookie, body: { name } });
  expect(cat.status).toBe(201);
  const c = await call(addCollection, "/collections", { method: "POST", cookie: owner.cookie, body: { name: "Signature" } }, { id: cat.body.id });
  expect(c.status).toBe(201);
  const s = await call(addSection, "/sections", { method: "POST", cookie: owner.cookie, body: { name: "For Her" } }, { id: c.body.id });
  expect(s.status).toBe(201);
  return { categoryId: cat.body.id as string, collectionId: c.body.id as string, sectionId: s.body.id as string };
}
async function product(placement: object) {
  return call(addProduct, "/products", { method: "POST", cookie: owner.cookie, body: {
    name: "Amber", variants: [{ price: "25", stock: 4 }], ...placement,
  } });
}
const patch = (id: string, body: object) => call(editProduct, "/product", { method: "PATCH", cookie: owner.cookie, body }, { id });

describe("optional category collections and sections", () => {
  it("keeps category-only products and shows an ordered public hierarchy with filtered products", async () => {
    const placement = await tree();
    const old = await product({ categoryId: placement.categoryId });
    const full = await product(placement);
    expect(old.status).toBe(201); expect(full.status).toBe(201);
    expect(old.body).toMatchObject({ collectionId: null, sectionId: null });
    const publicData = await call(catalogue, "/catalogue", {}, { slug: owner.shop.slug });
    expect(publicData.status).toBe(200);
    const category = publicData.body.shop.categories.find((c: { id: string }) => c.id === placement.categoryId);
    expect(category).toMatchObject({ productCount: 2, collections: [{ id: placement.collectionId, sections: [{ id: placement.sectionId, name: "For Her" }] }] });
    const all = await catalogueService.browse(owner.shop.slug, { categoryId: placement.categoryId });
    expect(all.total).toBe(2);
    const filtered = await catalogueService.browse(owner.shop.slug, { categoryId: placement.categoryId, collectionId: placement.collectionId, sectionId: placement.sectionId });
    expect(filtered.items.map((p) => p.id)).toEqual([full.body.id]);
    expect(filtered.total).toBe(1);
  });
  it("rejects mismatched parents and another tenant's IDs, without changing products", async () => {
    const a = await tree(), b = await tree();
    expect((await product({ ...a, collectionId: b.collectionId })).status).toBe(422);
    expect((await product({ ...a, sectionId: b.sectionId })).status).toBe(422);
    expect((await product({ collectionId: a.collectionId })).status).toBe(422);
    expect((await product({ categoryId: a.categoryId, sectionId: a.sectionId })).status).toBe(422);
    const foreignCategory = await prisma.category.create({ data: { shopId: other.shop.id, name: "Other", position: 0 } });
    const foreign = await prisma.productCollection.create({ data: { shopId: other.shop.id, categoryId: foreignCategory.id, name: "Other", position: 0 } });
    expect((await product({ categoryId: a.categoryId, collectionId: foreign.id })).status).toBe(404);
    const foreignSection = await prisma.productSection.create({ data: { shopId: other.shop.id, collectionId: foreign.id, name: "Secret", position: 0 } });
    expect((await product({ ...a, sectionId: foreignSection.id })).status).toBe(404);
    const p = await product(a);
    expect((await patch(p.body.id, { sectionId: b.sectionId })).status).toBe(422);
    expect(await prisma.product.findUnique({ where: { id: p.body.id } })).toMatchObject(a);
  });
  it("preserves placement on ordinary edits and clears descendants when a parent changes", async () => {
    const a = await tree(), b = await tree();
    const p = await product(a);
    expect((await patch(p.body.id, { name: "Renamed" })).body).toMatchObject(a);
    expect((await patch(p.body.id, { categoryId: b.categoryId })).body).toMatchObject({ categoryId: b.categoryId, collectionId: null, sectionId: null });
    expect((await patch(p.body.id, b)).status).toBe(200);
    const c = await call(addCollection, "/c", { method: "POST", cookie: manager, body: { name: "Musk" } }, { id: b.categoryId });
    expect(c.status).toBe(201);
    expect((await patch(p.body.id, { collectionId: c.body.id })).body).toMatchObject({ collectionId: c.body.id, sectionId: null });
    expect((await patch(p.body.id, { categoryId: null })).body).toMatchObject({ categoryId: null, collectionId: null, sectionId: null });
  });
  it("renames and reorders siblings, rejects duplicates and empty names, and appends after deletion", async () => {
    const a = await tree();
    const send = (name: string) => call(addCollection, "/c", { method: "POST", cookie: owner.cookie, body: { name } }, { id: a.categoryId });
    const b = await send("Musk"), c = await send("Mist");
    expect((await send("Musk")).status).toBe(422);
    expect((await send("  ")).status).toBe(400);
    expect((await call(editCollection, "/c", { method: "PATCH", cookie: owner.cookie, body: { position: 0, name: "Mists" } }, { id: c.body.id })).status).toBe(200);
    await call(deleteCollection, "/c", { method: "DELETE", cookie: owner.cookie }, { id: b.body.id });
    const d = await send("New");
    const list = (await call(categories, "/categories", { cookie: owner.cookie })).body;
    expect(list.find((x: { id: string }) => x.id === a.categoryId).collections.map((x: { id: string }) => x.id)).toEqual([c.body.id, a.collectionId, d.body.id]);
    const s = await call(addSection, "/s", { method: "POST", cookie: manager, body: { name: "For Him" } }, { id: a.collectionId });
    expect(s.status).toBe(201);
    expect((await call(editSection, "/s", { method: "PATCH", cookie: manager, body: { name: "Everyone", position: 0 } }, { id: s.body.id })).status).toBe(200);
  });
  it("keeps products when removing a section, collection or category", async () => {
    const a = await tree(); const p = await product(a);
    expect((await call(deleteSection, "/s", { method: "DELETE", cookie: owner.cookie }, { id: a.sectionId })).status).toBe(204);
    expect(await prisma.product.findUnique({ where: { id: p.body.id } })).toMatchObject({ categoryId: a.categoryId, collectionId: a.collectionId, sectionId: null });
    const s = await call(addSection, "/s", { method: "POST", cookie: owner.cookie, body: { name: "New" } }, { id: a.collectionId });
    await patch(p.body.id, { sectionId: s.body.id });
    expect((await call(deleteCollection, "/c", { method: "DELETE", cookie: owner.cookie }, { id: a.collectionId })).status).toBe(204);
    expect(await prisma.product.findUnique({ where: { id: p.body.id } })).toMatchObject({ categoryId: a.categoryId, collectionId: null, sectionId: null });
    const b = await tree(); const p2 = await product(b);
    expect((await call(deleteCategory, "/cat", { method: "DELETE", cookie: owner.cookie }, { id: b.categoryId })).status).toBe(204);
    expect(await prisma.product.findUnique({ where: { id: p2.body.id } })).toMatchObject({ categoryId: null, collectionId: null, sectionId: null });
    expect(await prisma.productSection.count({ where: { id: b.sectionId } })).toBe(0);
  });
  it("enforces the per-parent limit even when collections are added concurrently", async () => {
    const a = await tree();
    await prisma.productCollection.createMany({ data: Array.from({ length: 28 }, (_, i) => ({
      shopId: owner.shop.id, categoryId: a.categoryId, name: `Existing ${i}`, position: i + 1,
    })) });
    const results = await Promise.all(Array.from({ length: 4 }, (_, i) => call(addCollection, "/c", {
      method: "POST", cookie: owner.cookie, body: { name: `Concurrent ${i}` },
    }, { id: a.categoryId })));
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.body?.error?.code === "COLLECTION_LIMIT")).toHaveLength(3);
    expect(await prisma.productCollection.count({ where: { shopId: owner.shop.id, categoryId: a.categoryId } })).toBe(30);
    await prisma.productSection.createMany({ data: Array.from({ length: 29 }, (_, i) => ({
      shopId: owner.shop.id, collectionId: a.collectionId, name: `Section ${i}`, position: i + 1,
    })) });
    expect((await call(addSection, "/s", { method: "POST", cookie: owner.cookie, body: { name: "Extra" } }, { id: a.collectionId })).body.error.code).toBe("COLLECTION_LIMIT");
  });
  it("enforces permissions and tenant scope on every new route", async () => {
    const a = await tree();
    for (const cookie of [staff, other.cookie]) {
      const expected = cookie === staff ? 403 : 404;
      for (const [handler, method, id, body] of [
        [addCollection, "POST", a.categoryId, { name: "X" }],
        [editCollection, "PATCH", a.collectionId, { name: "X" }],
        [deleteCollection, "DELETE", a.collectionId, undefined],
        [addSection, "POST", a.collectionId, { name: "X" }],
        [editSection, "PATCH", a.sectionId, { name: "X" }],
        [deleteSection, "DELETE", a.sectionId, undefined],
      ] as const) expect((await call(handler, "/item", { method, cookie, body }, { id })).status).toBe(expected);
    }
    expect((await call(categories, "/categories", { cookie: staff })).status).toBe(200);
  });
});
