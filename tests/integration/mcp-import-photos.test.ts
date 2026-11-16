import { mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { POST as expireRoute } from "@/app/api/cron/expire-reservations/route";
import { GET as getProduct } from "@/app/api/products/[id]/route";
import { GET as publicCatalogue } from "@/app/api/public/shops/[slug]/catalogue/route";
import { prisma } from "@/server/db";
import { photoFetchConfig, type PhotoFetchDeps } from "@/server/storage/fetchPhoto";
import { call, resetDb, signUpOwner } from "./helpers";
import { callTool } from "./mcpHelpers";
import { connect } from "./oauthHelpers";
import { startPhotoServer, type PhotoServer } from "./photoServer";

let server: PhotoServer;
let original: PhotoFetchDeps;
let owner: Awaited<ReturnType<typeof signUpOwner>>;
let token: string;
let n = 0;

const files = async () => readdir(path.join(process.env.UPLOAD_DIR!, owner.shop.id)).catch(() => [] as string[]);

/** A product with Black and White variants and the given photo links. */
const tee = (images: { url: string; colour?: string }[]) => ({
  name: `Tee ${++n}`,
  options: ["Colour"],
  variants: [
    { optionValues: ["Black"], price: "12", stock: 3 },
    { optionValues: ["White"], price: "12", stock: 3 },
  ],
  images,
});

async function preview(products: unknown[]) {
  const res = await callTool(token, "preview_product_import", { products });
  if (!res.ok) throw new Error(`preview refused: ${res.error}`);
  return res.data;
}

async function confirm(importId: string) {
  const res = await callTool(token, "confirm_product_import", { importId });
  if (!res.ok) throw new Error(`confirm refused: ${res.error}`);
  return res.data;
}

beforeAll(async () => {
  await resetDb();
  process.env.UPLOAD_DIR = await mkdtemp(path.join(tmpdir(), "mahhali-uploads-"));
  process.env.CRON_SECRET = "test-cron-secret";
  server = await startPhotoServer();
  original = { ...photoFetchConfig };
  Object.assign(photoFetchConfig, server.deps);
  owner = await signUpOwner();
  token = (await connect({ cookie: owner.cookie, scopes: ["catalogue:read", "catalogue:write"] })).access_token;
});

afterAll(async () => {
  Object.assign(photoFetchConfig, original);
  await server.close();
});

beforeEach(async () => {
  // Each test starts without a waiting preview.
  await prisma.productImport.deleteMany({ where: { status: "PREVIEWED" } });
});

describe("product photos from links", () => {
  it("downloads good links at preview, reports bad ones and keeps the product importable", async () => {
    const d = await preview([
      tee([
        { url: server.url("/good.png") },
        { url: server.url("/page.html") },
        { url: server.url("/good.jpg"), colour: "white" },
      ]),
    ]);
    expect(d.summary).toMatchObject({ ready: 1, photos: 2, photoProblems: 1 });
    expect(d.rows[0].status).toBe("ready");
    expect(d.rows[0].product.photos).toEqual([{ colour: null }, { colour: "White" }]);
    expect(d.rows[0].photoProblems).toEqual([{ url: server.url("/page.html"), problem: "The link is not a PNG, JPEG or WebP image." }]);
    expect(await files()).toHaveLength(2);
    expect(await prisma.productImage.count({ where: { shopId: owner.shop.id } })).toBe(0);
  });

  it("attaches the photos on confirm, in order, with their colour", async () => {
    const d = await preview([tee([{ url: server.url("/good.png") }, { url: server.url("/good.jpg"), colour: "Black" }])]);
    const done = await confirm(d.importId);
    const productId = done.products[0].id;

    const res = await call(getProduct, `/api/products/${productId}`, { cookie: owner.cookie }, { id: productId });
    expect(res.status).toBe(200);
    const images = res.body.images as { url: string; optionValue: string | null }[];
    expect(images.map((i) => i.optionValue)).toEqual([null, "Black"]);
    expect(images[0].url).toMatch(new RegExp(`^/uploads/${owner.shop.id}/[\\w-]+\\.png$`));
    expect(images[1].url).toMatch(/\.jpg$/);

    const catalogue = await call(publicCatalogue, `/api/public/shops/${owner.shop.slug}/catalogue`, {}, { slug: owner.shop.slug });
    const listed = JSON.stringify(catalogue.body);
    expect(listed).toContain(images[0].url);
  });

  it("keeps five photos per product and says which were left out", async () => {
    const links = Array.from({ length: 7 }, (_, i) => ({ url: server.url(`/good.png?n=${i}`) }));
    const d = await preview([tee(links)]);
    expect(d.rows[0].product.photos).toHaveLength(5);
    expect(d.rows[0].photoProblems).toHaveLength(2);
    expect(d.rows[0].photoProblems[0].problem).toContain("up to 5 photos");
  });

  it("keeps a photo whose colour is unknown, for every variant", async () => {
    const d = await preview([tee([{ url: server.url("/good.png"), colour: "Red" }])]);
    expect(d.rows[0].product.photos).toEqual([{ colour: null }]);
    expect(d.rows[0].photoProblems[0].problem).toContain('"Red" is not one of');
  });

  it("refuses private and plain-http links without downloading them", async () => {
    const before = server.hits();
    const d = await preview([tee([{ url: "http://example.com/a.png" }, { url: "https://192.168.1.10/a.png" }, { url: server.url("/to-private") }])]);
    expect(d.rows[0].product.photos).toEqual([]);
    expect(d.rows[0].photoProblems.map((p: { problem: string }) => p.problem)).toEqual([
      "Only https:// links can be used.",
      "This link points to a private address.",
      "This link points to a private address.",
    ]);
    expect(server.hits() - before).toBe(1);
  });

  it("downloads nothing for products that won't be created", async () => {
    const before = server.hits();
    const bad = { ...tee([{ url: server.url("/good.png") }]), variants: [{ optionValues: ["Black"], price: "abc" }] };
    const d = await preview([bad, tee([])]);
    expect(d.rows[0].status).toBe("error");
    expect(server.hits()).toBe(before);
  });

  it("works with Arabic names and colours", async () => {
    const d = await preview([
      {
        name: "قميص قطن",
        options: ["اللون"],
        variants: [{ optionValues: ["أسود"], price: "15", stock: 2 }],
        images: [{ url: server.url("/good.png"), colour: "اسود" }],
      },
    ]);
    const done = await confirm(d.importId);
    const images = await prisma.productImage.findMany({ where: { productId: done.products[0].id } });
    expect(images.map((i) => i.optionValue)).toEqual(["أسود"]);
  });

  it("deletes the photos of a preview that a new preview replaces", async () => {
    const first = await preview([tee([{ url: server.url("/good.png") }, { url: server.url("/good.jpg") }])]);
    const stored = (await prisma.productImport.findUniqueOrThrow({ where: { id: first.importId } })).rows as { photos: { url: string }[] }[];
    const names = stored[0].photos.map((p) => p.url.split("/").pop());
    expect(await files()).toEqual(expect.arrayContaining(names));
    await preview([tee([])]);
    const left = await files();
    for (const name of names) expect(left).not.toContain(name);
  });

  it("deletes the photos of expired previews with the scheduled cleanup, and keeps confirmed ones", async () => {
    const kept = await confirm((await preview([tee([{ url: server.url("/good.png") }])])).importId);
    const keptFile = (await prisma.productImage.findFirstOrThrow({ where: { productId: kept.products[0].id } })).url.split("/").pop();

    const stale = await preview([tee([{ url: server.url("/good.jpg") }])]);
    const staleRows = (await prisma.productImport.findUniqueOrThrow({ where: { id: stale.importId } })).rows as { photos: { url: string }[] }[];
    const staleFile = staleRows[0].photos[0].url.split("/").pop();
    await prisma.productImport.update({ where: { id: stale.importId }, data: { expiresAt: new Date(Date.now() - 2 * 60 * 60 * 1000) } });

    const res = await call(expireRoute, "/api/cron/expire-reservations", { method: "POST", headers: { "x-cron-secret": "test-cron-secret" } });
    expect(res.status).toBe(200);
    const left = await files();
    expect(left).not.toContain(staleFile);
    expect(left).toContain(keptFile);
  });
});
