import { mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { GET as viewLink } from "@/app/api/public/photo-links/[token]/route";
import { POST as uploadPhotos } from "@/app/api/public/photo-links/[token]/photos/route";
import { GET as getProduct } from "@/app/api/products/[id]/route";
import { prisma } from "@/server/db";
import { hashToken } from "@/server/domain/tokens";
import { seedVariant } from "./fixtures";
import { addMember, call, resetDb, signUpOwner } from "./helpers";
import { callTool } from "./mcpHelpers";
import { connect } from "./oauthHelpers";
import { JPG, PNG } from "./photoServer";

let owner: Awaited<ReturnType<typeof signUpOwner>>;
let ownerToken: string;
let managerToken: string;
let n = 0;
let ip = 0;

const tokenOf = (url: string) => url.split("/p/")[1];

/** Previews and confirms one import as the owner; returns the import, its products and the photo link token. */
async function importProducts(products = [tee()]) {
  const preview = await callTool(ownerToken, "preview_product_import", { products });
  if (!preview.ok) throw new Error(preview.error);
  const done = await callTool(ownerToken, "confirm_product_import", { importId: preview.data.importId });
  if (!done.ok) throw new Error(done.error);
  return { importId: preview.data.importId as string, products: done.data.products as { id: string }[], token: tokenOf(done.data.addPhotos.url) };
}

function tee() {
  return {
    name: `Photo tee ${++n}`,
    options: ["Colour"],
    variants: [
      { optionValues: ["Black"], price: "10", stock: 1 },
      { optionValues: ["أبيض"], price: "10", stock: 1 },
    ],
  };
}

const view = (token: string) => call(viewLink, `/api/public/photo-links/${token}`, { headers: { "x-real-ip": `10.9.0.${++ip}` } }, { token });

async function upload(token: string, fields: { productId: string; colour?: string; files: Uint8Array[] }, from = `10.8.0.${++ip}`) {
  const form = new FormData();
  form.set("productId", fields.productId);
  if (fields.colour) form.set("colour", fields.colour);
  fields.files.forEach((bytes, i) => form.append("file", new File([bytes.slice()], `photo-${i}`)));
  const req = new Request(`http://localhost:3000/api/public/photo-links/${token}/photos`, {
    method: "POST",
    headers: { "x-real-ip": from },
    body: form,
  });
  const res = await uploadPhotos(req, { params: Promise.resolve({ token }) });
  return { status: res.status, body: await res.json() };
}

const files = async () => readdir(path.join(process.env.UPLOAD_DIR!, owner.shop.id)).catch(() => [] as string[]);

beforeAll(async () => {
  await resetDb();
  process.env.UPLOAD_DIR = await mkdtemp(path.join(tmpdir(), "mahhali-uploads-"));
  owner = await signUpOwner();
  ownerToken = (await connect({ cookie: owner.cookie, scopes: ["catalogue:read", "catalogue:write"] })).access_token;
  const manager = await addMember(owner.shop.id, "manager");
  managerToken = (await connect({ cookie: manager.cookie, scopes: ["catalogue:write"] })).access_token;
});

describe("the add-photos link", () => {
  it("comes with every confirmed import, valid for 24 hours, stored only as a hash", async () => {
    const preview = await callTool(ownerToken, "preview_product_import", { products: [tee()] });
    const done = await callTool(ownerToken, "confirm_product_import", { importId: preview.ok && preview.data.importId });
    if (!done.ok) throw new Error(done.error);
    expect(done.data.addPhotos.url).toMatch(/^http:\/\/localhost:3000\/p\/[\w-]{32}$/);
    const expires = new Date(done.data.addPhotos.expiresAt).getTime();
    expect(expires).toBeGreaterThan(Date.now() + 23.9 * 3600_000);
    expect(expires).toBeLessThan(Date.now() + 24.1 * 3600_000);
    const token = tokenOf(done.data.addPhotos.url);
    const row = await prisma.importPhotoLink.findUniqueOrThrow({ where: { importId: preview.ok ? preview.data.importId : "" } });
    expect(row.tokenHash).toBe(hashToken(token));
    expect(JSON.stringify(row)).not.toContain(token);

    const replay = await callTool(ownerToken, "confirm_product_import", { importId: preview.ok && preview.data.importId });
    expect(replay.ok && replay.data.addPhotos).toContain("photo_upload_link");
    expect((await view(token)).status).toBe(200);
  });

  it("photo_upload_link makes a new link and the old one stops working", async () => {
    const { importId, token: old } = await importProducts();
    const res = await callTool(ownerToken, "photo_upload_link", { importId });
    if (!res.ok) throw new Error(res.error);
    const fresh = tokenOf(res.data.url);
    expect(fresh).not.toBe(old);
    expect((await view(old)).status).toBe(404);
    expect((await view(fresh)).status).toBe(200);
  });

  it("is only for the member's own confirmed import", async () => {
    const { importId } = await importProducts();
    const other = await callTool(managerToken, "photo_upload_link", { importId });
    expect(other).toMatchObject({ ok: false });
    expect(!other.ok && other.error).toContain("not found");

    const preview = await callTool(ownerToken, "preview_product_import", { products: [tee()] });
    const unconfirmed = await callTool(ownerToken, "photo_upload_link", { importId: preview.ok && preview.data.importId });
    expect(!unconfirmed.ok && unconfirmed.error).toContain("confirmed");
  });

  it("stops working when the import is undone", async () => {
    const { importId, token } = await importProducts();
    await callTool(ownerToken, "undo_product_import", { importId });
    expect((await view(token)).status).toBe(404);
    const again = await callTool(ownerToken, "photo_upload_link", { importId });
    expect(!again.ok && again.error).toContain("confirmed");
  });

  it("stops working when it expires or the shop is suspended", async () => {
    const expired = await importProducts();
    await prisma.importPhotoLink.update({ where: { importId: expired.importId }, data: { expiresAt: new Date(Date.now() - 1000), createdAt: new Date(Date.now() - 2000) } });
    expect((await view(expired.token)).status).toBe(404);

    const live = await importProducts();
    await prisma.shop.update({ where: { id: owner.shop.id }, data: { suspended: true } });
    try {
      expect((await view(live.token)).status).toBe(404);
      expect((await upload(live.token, { productId: live.products[0].id, files: [PNG] })).status).toBe(404);
    } finally {
      await prisma.shop.update({ where: { id: owner.shop.id }, data: { suspended: false } });
    }
  });

  it("refuses unknown and malformed links", async () => {
    expect((await view("A".repeat(32))).status).toBe(404);
    expect((await view("bad token!")).status).toBe(400);
  });
});

describe("the add-photos page", () => {
  it("lists only the import's products with their colours and photos", async () => {
    await seedVariant(owner.shop.id, { name: "Not imported" });
    const { token, products } = await importProducts([tee(), tee()]);
    const res = await view(token);
    expect(res.status).toBe(200);
    expect(res.body.shop).toEqual({ name: owner.shop.name });
    expect(res.body.maxPhotosPerProduct).toBe(5);
    expect(res.body.products.map((p: { id: string }) => p.id)).toEqual(products.map((p) => p.id));
    expect(res.body.products[0]).toMatchObject({ colours: ["Black", "أبيض"], photos: [], photosLeft: 5 });
  });

  it("adds several photos at once, with a colour, and they show in the dashboard", async () => {
    const { token, products } = await importProducts();
    const res = await upload(token, { productId: products[0].id, colour: "ابيض", files: [PNG, JPG] });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ added: 2, photosLeft: 3 });
    expect(res.body.photos.map((p: { colour: string }) => p.colour)).toEqual(["أبيض", "أبيض"]);

    const product = await call(getProduct, `/api/products/${products[0].id}`, { cookie: owner.cookie }, { id: products[0].id });
    expect(product.body.images.map((i: { url: string }) => i.url)).toEqual(res.body.photos.map((p: { url: string }) => p.url));
    expect((await view(token)).body.products[0].photos).toHaveLength(2);
  });

  it("adds photos for every variant when no colour is given", async () => {
    const { token, products } = await importProducts();
    const res = await upload(token, { productId: products[0].id, files: [PNG] });
    expect(res.body.photos).toEqual([expect.objectContaining({ colour: null })]);
  });

  it("allows five photos per product and refuses a sixth", async () => {
    const { token, products } = await importProducts();
    const productId = products[0].id;
    expect((await upload(token, { productId, files: [PNG, PNG, PNG, PNG] })).status).toBe(201);
    const tooMany = await upload(token, { productId, files: [PNG, PNG] });
    expect(tooMany.status).toBe(422);
    expect(tooMany.body.error).toMatchObject({ code: "PHOTO_LIMIT", details: { photosLeft: 1 } });
    expect(await prisma.productImage.count({ where: { productId } })).toBe(4);
    expect((await upload(token, { productId, files: [JPG] })).body.photosLeft).toBe(0);
    expect((await upload(token, { productId, files: [JPG] })).status).toBe(422);
  });

  it("keeps nothing when one of the files is not a real image", async () => {
    const { token, products } = await importProducts();
    const before = await files();
    const fake = new TextEncoder().encode("<html>not a photo</html>");
    const res = await upload(token, { productId: products[0].id, files: [PNG, fake] });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("UNSUPPORTED_FILE");
    expect(await prisma.productImage.count({ where: { productId: products[0].id } })).toBe(0);
    expect((await files()).sort()).toEqual(before.sort());
  });

  it("refuses a colour the product doesn't have, and an empty upload", async () => {
    const { token, products } = await importProducts();
    expect((await upload(token, { productId: products[0].id, colour: "Red", files: [PNG] })).body.error.code).toBe("UNKNOWN_COLOUR");
    expect((await upload(token, { productId: products[0].id, files: [] })).body.error.code).toBe("NO_FILES");
  });

  it("refuses products outside the link's import, including another shop's", async () => {
    const first = await importProducts();
    const second = await importProducts();
    expect((await upload(first.token, { productId: second.products[0].id, files: [PNG] })).status).toBe(404);

    const otherShop = await signUpOwner();
    const { product } = await seedVariant(otherShop.shop.id);
    expect((await upload(first.token, { productId: product.id, files: [PNG] })).status).toBe(404);
    expect(await prisma.productImage.count({ where: { productId: product.id } })).toBe(0);
  });

  it("limits how often one link can be used", async () => {
    const { token, products } = await importProducts();
    const statuses: number[] = [];
    for (let i = 0; i < 41; i++) statuses.push((await upload(token, { productId: products[0].id, colour: "Red", files: [PNG] })).status);
    expect(statuses.slice(0, 40).every((s) => s === 422)).toBe(true);
    expect(statuses[40]).toBe(429);
  });

  it("limits how often one address can upload, across links", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 61; i++) statuses.push((await upload(`unknown-link-${String(i).padStart(4, "0")}`, { productId: "x", files: [PNG] }, "10.7.7.7")).status);
    expect(statuses.slice(0, 60).every((s) => s === 404)).toBe(true);
    expect(statuses[60]).toBe(429);
  });
});
