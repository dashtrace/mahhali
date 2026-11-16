import { mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { POST as create } from "@/app/api/shop/slides/route";
import { DELETE as removeSlide } from "@/app/api/shop/slides/[id]/route";
import { POST as desktopImage } from "@/app/api/shop/slides/[id]/image/route";
import { POST as mobileImage, DELETE as removeMobile } from "@/app/api/shop/slides/[id]/mobile-image/route";
import { GET as catalogue } from "@/app/api/public/shops/[slug]/catalogue/route";
import { prisma } from "@/server/db";
import { addMember, call, resetDb, signUpOwner } from "./helpers";

type Owner = Awaited<ReturnType<typeof signUpOwner>>;
let owner: Owner, other: Owner;
const png = () => new File([new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,13])], "image.png", { type: "image/png" });
beforeAll(async () => { process.env.UPLOAD_DIR = await mkdtemp(path.join(tmpdir(), "hero-mobile-")); await resetDb(); other = await signUpOwner(); });
beforeEach(async () => { owner = await signUpOwner(); });
async function upload(mobileFile?: File) {
  const form = new FormData(); form.set("file", png()); form.set("title", "Two artworks"); form.set("ctaLabel", "Explore");
  if (mobileFile) form.set("mobileFile", mobileFile);
  const res = await create(new Request("http://localhost:3000/slides", { method: "POST", headers: { cookie: owner.cookie }, body: form }), { params: Promise.resolve({}) });
  return { status: res.status, body: await res.json() };
}
async function replace(handler: typeof mobileImage, id: string, cookie = owner.cookie, file = png()) {
  const form = new FormData(); form.set("file", file);
  const res = await handler(new Request("http://localhost:3000/image", { method: "POST", headers: { cookie }, body: form }), { params: Promise.resolve({ id }) });
  return { status: res.status, body: await res.json() };
}
const files = () => readdir(path.join(process.env.UPLOAD_DIR!, owner.shop.id));

describe("optional mobile hero artwork", () => {
  it("keeps legacy uploads and exposes two distinct images on slides that have them", async () => {
    const legacy = await upload(); const dual = await upload(png());
    expect(legacy.status).toBe(201); expect(legacy.body.mobileImageUrl).toBeNull();
    expect(dual.status).toBe(201); expect(dual.body.mobileImageUrl).not.toBe(dual.body.imageUrl);
    expect(await files()).toHaveLength(3);
    const data = await call(catalogue, "/catalogue", {}, { slug: owner.shop.slug });
    expect(data.body.shop.slides.find((s: { id: string }) => s.id === dual.body.id)).toMatchObject({ imageUrl: dual.body.imageUrl, mobileImageUrl: dual.body.mobileImageUrl, ctaLabel: "Explore" });
  });
  it("replaces either artwork without changing the other artwork or button text", async () => {
    const original = await upload(png());
    const mobile = await replace(mobileImage, original.body.id);
    expect(mobile.status).toBe(200);
    expect(mobile.body).toMatchObject({ imageUrl: original.body.imageUrl, ctaLabel: "Explore" });
    expect(await files()).not.toContain(original.body.mobileImageUrl.split("/").pop());
    const desktop = await replace(desktopImage, original.body.id);
    expect(desktop.status).toBe(200);
    expect(desktop.body).toMatchObject({ mobileImageUrl: mobile.body.mobileImageUrl, ctaLabel: "Explore" });
    expect(await files()).toHaveLength(2);
    expect(await files()).not.toContain(original.body.imageUrl.split("/").pop());
  });
  it("removes the mobile file and retains the desktop fallback, including repeated removal", async () => {
    const original = await upload(png());
    const remove = () => call(removeMobile, "/image", { method: "DELETE", cookie: owner.cookie }, { id: original.body.id });
    expect((await remove()).body).toMatchObject({ mobileImageUrl: null, imageUrl: original.body.imageUrl });
    expect(await files()).toEqual([original.body.imageUrl.split("/").pop()]);
    expect((await remove()).status).toBe(200);
  });
  it("removes both files when a slide is deleted", async () => {
    const slide = await upload(png());
    expect((await call(removeSlide, "/slide", { method: "DELETE", cookie: owner.cookie }, { id: slide.body.id })).status).toBe(204);
    expect(await files()).toEqual([]);
    expect(await prisma.heroSlide.findUnique({ where: { id: slide.body.id } })).toBeNull();
  });
  it("rejects invalid artwork and cleans up both files when the slide limit rejects creation", async () => {
    expect((await upload(new File(["<html>"], "bad.png"))).body.error.code).toBe("UNSUPPORTED_FILE");
    expect(await files()).toEqual([]);
    expect((await upload(new File([new Uint8Array(3 * 1024 * 1024 + 1)], "huge.png"))).body.error.code).toBe("FILE_TOO_LARGE");
    expect(await files()).toEqual([]);
    let firstId = "";
    for (let i = 0; i < 6; i++) { const slide = await upload(); expect(slide.status).toBe(201); firstId = slide.body.id; }
    const before = await files();
    expect((await upload(png())).body.error.code).toBe("SLIDE_LIMIT");
    expect(await files()).toEqual(before);
    expect((await replace(mobileImage, firstId, owner.cookie, new File(["<svg>"], "bad.png"))).status).toBe(422);
    expect(await files()).toEqual(before);
  });
  it("restricts mobile-image mutations to this shop's owner", async () => {
    const slide = await upload(png()); const before = await files();
    const manager = (await addMember(owner.shop.id, "manager")).cookie;
    const staff = (await addMember(owner.shop.id, "staff")).cookie;
    for (const cookie of [manager, staff, other.cookie]) {
      const status = cookie === other.cookie ? 404 : 403;
      expect((await replace(mobileImage, slide.body.id, cookie)).status).toBe(status);
      expect((await call(removeMobile, "/image", { method: "DELETE", cookie }, { id: slide.body.id })).status).toBe(status);
    }
    expect(await files()).toEqual(before);
  });
});
