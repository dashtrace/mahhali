import { mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { POST as postSlide } from "@/app/api/shop/slides/route";
import { PATCH as patchSlide } from "@/app/api/shop/slides/[id]/route";
import { POST as replaceImage } from "@/app/api/shop/slides/[id]/image/route";
import { DELETE as deleteCollection } from "@/app/api/collections/[id]/route";
import { DELETE as deleteCategory } from "@/app/api/categories/[id]/route";
import { DELETE as deleteSection } from "@/app/api/sections/[id]/route";
import { GET as catalogue } from "@/app/api/public/shops/[slug]/catalogue/route";
import { heroDestination } from "@/app/s/[slug]/_components/heroDestination";
import { prisma } from "@/server/db";
import { addMember, call, resetDb, signUpOwner } from "./helpers";

type Owner = Awaited<ReturnType<typeof signUpOwner>>;
let owner: Owner, other: Owner, manager: string, staff: string;
let cat: string, collection: string, section: string, foreignCat: string, foreignCollection: string, foreignSection: string;
let slideId: string;
const png = () => new File([new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,13])], "hero.png", { type: "image/png" });
beforeAll(async () => {
  process.env.UPLOAD_DIR = await mkdtemp(path.join(tmpdir(), "hero-targets-"));
  await resetDb(); owner = await signUpOwner(); other = await signUpOwner();
  manager = (await addMember(owner.shop.id, "manager")).cookie;
  staff = (await addMember(owner.shop.id, "staff")).cookie;
  const tree = async (shopId: string) => {
    const c = await prisma.category.create({ data: { shopId, name: "Exclusive", position: 0 } });
    const group = await prisma.productCollection.create({ data: { shopId, categoryId: c.id, name: "Mists", position: 0 } });
    const s = await prisma.productSection.create({ data: { shopId, collectionId: group.id, name: "Body Mist", position: 0 } });
    return [c.id, group.id, s.id];
  };
  [cat, collection, section] = await tree(owner.shop.id);
  [foreignCat, foreignCollection, foreignSection] = await tree(other.shop.id);
});
async function upload(fields: Record<string, string> = {}, cookie = owner.cookie) {
  const form = new FormData(); form.set("file", png()); form.set("title", "Discover");
  Object.entries(fields).forEach(([k, v]) => form.set(k, v));
  const res = await postSlide(new Request("http://localhost:3000/api/shop/slides", { method: "POST", headers: { cookie }, body: form }), { params: Promise.resolve({}) });
  return { status: res.status, body: await res.json() };
}
const target = () => ({ ctaCategoryId: cat, ctaCollectionId: collection, ctaSectionId: section });
const patch = (body: object, cookie = owner.cookie) => call(patchSlide, "/slide", { method: "PATCH", cookie, body }, { id: slideId });
const publicData = async () => (await call(catalogue, "/catalogue", {}, { slug: owner.shop.slug })).body;

describe("per-slide buttons", () => {
  it("keeps old upload calls working and saves a custom label and full destination", async () => {
    const legacy = await upload();
    expect(legacy.status).toBe(201);
    expect(legacy.body).toMatchObject({ ctaLabel: null, ctaCategoryId: null, ctaCollectionId: null, ctaSectionId: null });
    const custom = await upload({ ...target(), ctaLabel: "Explore Body Mists" });
    expect(custom.status).toBe(201); slideId = custom.body.id;
    expect(custom.body).toMatchObject({ ...target(), ctaLabel: "Explore Body Mists" });
    const data = await publicData();
    expect(data.shop.slides.find((s: { id: string }) => s.id === slideId)).toMatchObject({ ...target(), ctaLabel: "Explore Body Mists" });
  });
  it("preserves the target when text, order or image changes", async () => {
    expect((await patch({ title: "Updated", position: 0 })).body).toMatchObject(target());
    const form = new FormData(); form.set("file", png());
    const res = await replaceImage(new Request("http://localhost:3000/image", { method: "POST", headers: { cookie: owner.cookie }, body: form }), { params: Promise.resolve({ id: slideId }) });
    expect(res.status).toBe(200);
    expect(await prisma.heroSlide.findUnique({ where: { id: slideId } })).toMatchObject({ ...target(), ctaLabel: "Explore Body Mists" });
  });
  it("clears lower targets on parent changes and allows restoring the default label", async () => {
    expect((await patch({ ctaLabel: "" })).body).toMatchObject({ ...target(), ctaLabel: null });
    expect((await patch({ ctaCollectionId: null })).body).toMatchObject({ ctaCategoryId: cat, ctaCollectionId: null, ctaSectionId: null });
    await patch(target());
    expect((await patch({ ctaCategoryId: null })).body).toMatchObject({ ctaCategoryId: null, ctaCollectionId: null, ctaSectionId: null });
    await patch(target());
  });
  it("rejects other-shop IDs, incorrect parent combinations and overlong labels without saving", async () => {
    expect((await patch({ ctaCategoryId: foreignCat })).status).toBe(404);
    expect((await patch({ ctaCollectionId: foreignCollection })).status).toBe(404);
    expect((await patch({ ctaSectionId: foreignSection })).status).toBe(404);
    const sibling = await prisma.productCollection.create({ data: { shopId: owner.shop.id, categoryId: cat, name: "Musk", position: 1 } });
    expect((await patch({ ctaCollectionId: sibling.id, ctaSectionId: section })).status).toBe(422);
    expect((await patch({ ctaCategoryId: null, ctaCollectionId: collection })).status).toBe(422);
    expect((await patch({ ctaLabel: "x".repeat(41) })).status).toBe(400);
    expect(await prisma.heroSlide.findUnique({ where: { id: slideId } })).toMatchObject(target());
    const files = await readdir(path.join(process.env.UPLOAD_DIR!, owner.shop.id));
    expect((await upload({ ...target(), ctaSectionId: foreignSection })).status).toBe(404);
    expect(await readdir(path.join(process.env.UPLOAD_DIR!, owner.shop.id))).toEqual(files);
  });
  it("keeps slide editing owner-only and scoped to the owner's shop", async () => {
    expect((await patch({ ctaLabel: "No" }, manager)).status).toBe(403);
    expect((await patch({ ctaLabel: "No" }, staff)).status).toBe(403);
    expect((await patch({ ctaLabel: "No" }, other.cookie)).status).toBe(404);
    expect((await upload({ ctaLabel: "No" }, manager)).status).toBe(403);
  });
  it("falls back to surviving parents after destinations are deleted", async () => {
    const href = "/s/demo/shop";
    const link = async () => {
      const data = await publicData();
      return heroDestination(href, data.shop.slides.find((s: { id: string }) => s.id === slideId), data.shop.categories);
    };
    expect((await call(deleteSection, "/s", { method: "DELETE", cookie: owner.cookie }, { id: section })).status).toBe(204);
    expect(await link()).toBe(`${href}?cat=${cat}&collection=${collection}`);
    // An ordinary copy edit still works when the saved target has since been removed.
    expect((await patch({ title: "Still editable" })).status).toBe(200);
    expect((await call(deleteCollection, "/c", { method: "DELETE", cookie: owner.cookie }, { id: collection })).status).toBe(204);
    expect(await link()).toBe(`${href}?cat=${cat}`);
    expect((await call(deleteCategory, "/c", { method: "DELETE", cookie: owner.cookie }, { id: cat })).status).toBe(204);
    expect(await link()).toBe(href);
  });
});
