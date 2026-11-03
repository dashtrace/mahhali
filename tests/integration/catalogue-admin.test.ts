import { mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { POST as createProduct } from "@/app/api/products/route";
import { DELETE as archiveProduct, GET as getProduct } from "@/app/api/products/[id]/route";
import { POST as addImage } from "@/app/api/products/[id]/images/route";
import { DELETE as deleteImage } from "@/app/api/products/[id]/images/[imageId]/route";
import { PUT as setOptions } from "@/app/api/products/[id]/options/route";
import { POST as addVariant } from "@/app/api/products/[id]/variants/route";
import { GET as catalogue } from "@/app/api/public/shops/[slug]/catalogue/route";
import { PATCH as patchVariant } from "@/app/api/variants/[id]/route";
import { GET as movements } from "@/app/api/variants/[id]/movements/route";
import { POST as adjustStock } from "@/app/api/variants/[id]/stock-adjustments/route";
import { GET as serveUpload } from "@/app/uploads/[...path]/route";
import { prisma } from "@/server/db";
import { seedVariant } from "./fixtures";
import { addMember, call, resetDb, signUpOwner } from "./helpers";

type Owner = Awaited<ReturnType<typeof signUpOwner>>;
type Handler = (req: Request, ctx: { params: Promise<Record<string, string | string[]>> }) => Promise<Response>;

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13];
const png = (size = PNG.length) => new File([new Uint8Array(size).map((_, i) => PNG[i] ?? 0)], "photo.png", { type: "image/png" });

/** A multipart POST, which helpers.call (JSON only) cannot send. */
async function upload(handler: Handler, url: string, cookie: string, fields: Record<string, string | File>, params: Record<string, string>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  const res = await handler(new Request(`http://localhost:3000${url}`, { method: "POST", headers: { cookie }, body: form }), {
    params: Promise.resolve(params),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

function serve(url: string) {
  const segments = url.split("/").slice(2);
  return serveUpload(new Request(`http://localhost:3000${url}`), { params: Promise.resolve({ path: segments }) });
}

let owner: Owner;
let other: Owner;
const cookies: Record<string, string> = {};

beforeAll(async () => {
  process.env.UPLOAD_DIR = await mkdtemp(path.join(tmpdir(), "mahhali-uploads-"));
  await resetDb();
  owner = await signUpOwner();
  other = await signUpOwner();
  for (const role of ["manager", "staff", "delivery"]) cookies[role] = (await addMember(owner.shop.id, role)).cookie;
});

describe("products and variants", () => {
  it("archives a product on DELETE instead of deleting it", async () => {
    const { product } = await seedVariant(owner.shop.id, { name: "Old scarf" });
    const res = await call(archiveProduct, `/api/products/${product.id}`, { method: "DELETE", cookie: owner.cookie }, { id: product.id });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ARCHIVED");
    expect(await prisma.product.count({ where: { id: product.id } })).toBe(1);
    const shop = await call(catalogue, "/catalogue", {}, { slug: owner.shop.slug });
    expect(shop.body.products.map((p: { id: string }) => p.id)).not.toContain(product.id);
  });

  it("adds a variant and logs its opening stock", async () => {
    const { product } = await seedVariant(owner.shop.id);
    const res = await call(
      addVariant,
      `/api/products/${product.id}/variants`,
      { method: "POST", cookie: owner.cookie, body: { optionValues: ["L", "Sand"], price: "26", stock: 4 } },
      { id: product.id },
    );
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ optionValues: ["L", "Sand"], priceMinor: 2600, available: 4 });
    const logged = await prisma.stockMovement.findMany({ where: { variantId: res.body.id } });
    expect(logged).toEqual([expect.objectContaining({ delta: 4, reason: "ADJUST", actorUserId: owner.user.id })]);
  });

  it("refuses duplicate option values, including two products sold one way", async () => {
    const { product } = await seedVariant(owner.shop.id);
    const dup = await call(
      addVariant,
      `/api/products/${product.id}/variants`,
      { method: "POST", cookie: owner.cookie, body: { optionValues: ["M", "Sand"], price: "10" } },
      { id: product.id },
    );
    expect(dup.status).toBe(422);
    expect(dup.body.error.code).toBe("DUPLICATE_VARIANT");

    const ring = await seedVariant(owner.shop.id, { name: "Ring", options: [], optionValues: [] });
    const empty = await call(
      addVariant,
      `/api/products/${ring.product.id}/variants`,
      { method: "POST", cookie: owner.cookie, body: { price: "10" } },
      { id: ring.product.id },
    );
    expect(empty.status).toBe(422);
    expect(empty.body.error.code).toBe("DUPLICATE_VARIANT");
  });

  it("needs one value per option and a known body", async () => {
    const { product, variant } = await seedVariant(owner.shop.id);
    const short = await call(
      addVariant,
      `/api/products/${product.id}/variants`,
      { method: "POST", cookie: owner.cookie, body: { optionValues: ["L"], price: "10" } },
      { id: product.id },
    );
    expect(short.status).toBe(422);
    expect(short.body.error.code).toBe("OPTION_VALUES_MISMATCH");
    const id = variant.id;
    const long = await call(patchVariant, `/api/variants/${id}`, { method: "PATCH", cookie: owner.cookie, body: { optionValues: ["L", "Sand", "x"] } }, { id });
    expect(long.status).toBe(422);
    expect(long.body.error.code).toBe("OPTION_VALUES_MISMATCH");
    // An old form still sending size and colour is refused, not saved with blank values.
    const stale = await call(
      addVariant,
      `/api/products/${product.id}/variants`,
      { method: "POST", cookie: owner.cookie, body: { size: "L", colour: "Sand", price: "10" } },
      { id: product.id },
    );
    expect(stale.status).toBe(400);
  });

  it("changes a variant's price and SKU but not into a sibling's option values", async () => {
    const { product } = await seedVariant(owner.shop.id);
    const large = await call(
      addVariant,
      `/api/products/${product.id}/variants`,
      { method: "POST", cookie: owner.cookie, body: { optionValues: ["L", "Sand"], price: "26" } },
      { id: product.id },
    );
    const id = large.body.id;
    const clash = await call(patchVariant, `/api/variants/${id}`, { method: "PATCH", cookie: owner.cookie, body: { optionValues: ["M", "Sand"] } }, { id });
    expect(clash.status).toBe(422);
    expect(clash.body.error.code).toBe("DUPLICATE_VARIANT");

    const res = await call(
      patchVariant,
      `/api/variants/${id}`,
      { method: "PATCH", cookie: owner.cookie, body: { price: "30.00", sku: "SH-L" } },
      { id },
    );
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ optionValues: ["L", "Sand"], priceMinor: 3000, sku: "SH-L" });
    const empty = await call(patchVariant, `/api/variants/${id}`, { method: "PATCH", cookie: owner.cookie, body: {} }, { id });
    expect(empty.status).toBe(400);
  });

  it("hides archived variants from the catalogue but keeps them on the dashboard", async () => {
    const created = await call(createProduct, "/api/products", {
      method: "POST",
      cookie: owner.cookie,
      body: { name: "Kaftan", options: ["Size"], variants: [{ optionValues: ["S"], price: "40", stock: 2 }, { optionValues: ["M"], price: "40", stock: 2 }] },
    });
    const [small, medium] = created.body.variants;
    const archive = (id: string) =>
      call(patchVariant, `/api/variants/${id}`, { method: "PATCH", cookie: owner.cookie, body: { archived: true } }, { id });
    expect((await archive(small.id)).status).toBe(200);

    const kaftan = async () =>
      (await call(catalogue, "/catalogue", {}, { slug: owner.shop.slug })).body.products.find(
        (p: { id: string }) => p.id === created.body.id,
      );
    expect((await kaftan()).variants.map((v: { id: string }) => v.id)).toEqual([medium.id]);

    // With no orderable variant left, the product drops out of the catalogue.
    await archive(medium.id);
    expect(await kaftan()).toBeUndefined();
    const dashboard = await call(getProduct, `/api/products/${created.body.id}`, { cookie: owner.cookie }, { id: created.body.id });
    expect(dashboard.body.variants).toHaveLength(2);
  });
});

describe("product options", () => {
  type Option = { name: string; from: string | null };
  const put = (productId: string, options: Option[], cookie = owner.cookie) =>
    call(setOptions, `/api/products/${productId}/options`, { method: "PUT", cookie, body: { options } }, { id: productId });
  const valuesOf = async (productId: string) =>
    (await prisma.variant.findMany({ where: { productId }, orderBy: { id: "asc" } })).map((v) => v.optionValues);
  /** Shirt with Size and Colour: [M, Sand] and a hidden [L, Olive]. */
  async function shirt() {
    const { product } = await seedVariant(owner.shop.id);
    await prisma.variant.create({ data: { shopId: owner.shop.id, productId: product.id, optionValues: ["L", "Olive"], priceMinor: 1n, archived: true } });
    return product.id;
  }

  it("renames, adds and reorders, moving every variant's values, hidden ones too", async () => {
    const id = await shirt();
    const res = await put(id, [
      { name: "Shade", from: "Colour" },
      { name: "Fit", from: null },
      { name: "Size", from: "Size" },
    ]);
    expect(res.status).toBe(200);
    expect(res.body.options).toEqual(["Shade", "Fit", "Size"]);
    expect(await valuesOf(id)).toEqual([
      ["Sand", "", "M"],
      ["Olive", "", "L"],
    ]);
  });

  it("leaves every value alone on a rename", async () => {
    const id = await shirt();
    const before = await prisma.variant.findMany({ where: { productId: id }, orderBy: { id: "asc" } });
    expect((await put(id, [{ name: "Fit", from: "Size" }, { name: "Colour", from: "Colour" }])).status).toBe(200);
    expect(await prisma.variant.findMany({ where: { productId: id }, orderBy: { id: "asc" } })).toEqual(before);
  });

  it("swaps two options even when the variants mirror each other", async () => {
    const { product } = await seedVariant(owner.shop.id, { options: ["A", "B"], optionValues: ["x", "y"] });
    await prisma.variant.create({ data: { shopId: owner.shop.id, productId: product.id, optionValues: ["y", "x"], priceMinor: 1n } });
    expect((await put(product.id, [{ name: "B", from: "B" }, { name: "A", from: "A" }])).status).toBe(200);
    expect(await valuesOf(product.id)).toEqual([
      ["y", "x"],
      ["x", "y"],
    ]);
  });

  it("refuses a removal that would make two variants the same, changing nothing", async () => {
    const { product } = await seedVariant(owner.shop.id);
    await prisma.variant.create({ data: { shopId: owner.shop.id, productId: product.id, optionValues: ["M", "Olive"], priceMinor: 1n, archived: true } });
    const clash = await put(product.id, [{ name: "Size", from: "Size" }]);
    expect(clash.status).toBe(422);
    expect(clash.body.error.code).toBe("DUPLICATE_VARIANT");
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).options).toEqual(["Size", "Colour"]);
    expect(await valuesOf(product.id)).toEqual([
      ["M", "Sand"],
      ["M", "Olive"],
    ]);

    expect((await put(product.id, [{ name: "Colour", from: "Colour" }])).status).toBe(200);
    expect(await valuesOf(product.id)).toEqual([["Sand"], ["Olive"]]);
  });

  it("says when the options changed in the meantime, and checks the body", async () => {
    const id = await shirt();
    const stale = await put(id, [{ name: "Size", from: "Fit" }]);
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe("OPTIONS_CHANGED");
    expect((await put(id, [{ name: "Size", from: "Size" }, { name: "size", from: null }])).status).toBe(400);
    expect((await put(id, [{ name: "A", from: "Size" }, { name: "B", from: "Size" }])).status).toBe(400);
    const four = ["A", "B", "C", "D"].map((name) => ({ name, from: null }));
    expect((await put(id, four)).status).toBe(400);
    expect((await prisma.product.findUniqueOrThrow({ where: { id } })).options).toEqual(["Size", "Colour"]);
  });
});

describe("stock adjustments", () => {
  const adjust = (id: string, delta: unknown, cookie = owner.cookie) =>
    call(adjustStock, `/api/variants/${id}/stock-adjustments`, { method: "POST", cookie, body: { delta } }, { id });

  it("adds and removes stock, never below zero, and logs who did it", async () => {
    const { variant } = await seedVariant(owner.shop.id, { available: 3 });
    expect((await adjust(variant.id, 5)).body.available).toBe(8);

    const tooMany = await adjust(variant.id, -10);
    expect(tooMany.status).toBe(422);
    expect(tooMany.body.error.code).toBe("STOCK_NEGATIVE");
    expect((await prisma.variant.findUniqueOrThrow({ where: { id: variant.id } })).available).toBe(8);

    expect((await adjust(variant.id, 0)).status).toBe(400);
    expect((await adjust(variant.id, 1.5)).status).toBe(400);
    expect((await adjust(variant.id, -8, cookies.manager)).body.available).toBe(0);

    const history = await call(movements, `/api/variants/${variant.id}/movements`, { cookie: cookies.staff }, { id: variant.id });
    expect(history.status).toBe(200);
    expect(history.body.map((m: { delta: number }) => m.delta)).toEqual([-8, 5]);
    expect(history.body[1]).toMatchObject({ reason: "ADJUST", actorUserId: owner.user.id });
  });

  it("keeps the reason given for an adjustment", async () => {
    const { variant } = await seedVariant(owner.shop.id, { available: 3 });
    const res = await call(
      adjustStock,
      `/api/variants/${variant.id}/stock-adjustments`,
      { method: "POST", cookie: owner.cookie, body: { delta: -1, note: "Damaged in the shop" } },
      { id: variant.id },
    );
    expect(res.status).toBe(201);
    const movement = await prisma.stockMovement.findFirstOrThrow({ where: { variantId: variant.id, delta: -1 } });
    expect(movement.note).toBe("Damaged in the shop");
  });

  it("refuses a second variant with the same values and a blank one, even when two arrive at once", async () => {
    const { product } = await seedVariant(owner.shop.id, { name: "Bag", optionValues: ["", "Black"] });
    const results = await Promise.all(
      Array.from({ length: 4 }, () =>
        call(
          addVariant,
          `/api/products/${product.id}/variants`,
          { method: "POST", cookie: owner.cookie, body: { optionValues: ["", "Tan"], price: "10" } },
          { id: product.id },
        ),
      ),
    );
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(await prisma.variant.count({ where: { productId: product.id, optionValues: { equals: ["", "Tan"] } } })).toBe(1);
  });

  it("stops concurrent removals exactly at zero", async () => {
    const { variant } = await seedVariant(owner.shop.id, { available: 5 });
    const results = await Promise.all(Array.from({ length: 10 }, () => adjust(variant.id, -1)));
    expect(results.filter((r) => r.status === 201)).toHaveLength(5);
    expect(results.filter((r) => r.status === 422)).toHaveLength(5);
    expect((await prisma.variant.findUniqueOrThrow({ where: { id: variant.id } })).available).toBe(0);
    expect(await prisma.stockMovement.count({ where: { variantId: variant.id } })).toBe(5);
  });
});

describe("product photos", () => {
  it("stores a photo and serves it with headers that stop sniffing and scripts", async () => {
    const { product } = await seedVariant(owner.shop.id);
    const res = await upload(addImage, `/api/products/${product.id}/images`, owner.cookie, { file: png(), optionValue: "Sand" }, { id: product.id });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ optionValue: "Sand", position: 0 });
    expect(res.body.url).toMatch(new RegExp(`^/uploads/${owner.shop.id}/[\\w-]+\\.png$`));

    const served = await serve(res.body.url);
    expect(served.status).toBe(200);
    expect(served.headers.get("content-type")).toBe("image/png");
    expect(served.headers.get("x-content-type-options")).toBe("nosniff");
    expect(served.headers.get("content-security-policy")).toContain("sandbox");
    expect([...new Uint8Array(await served.arrayBuffer())]).toEqual(PNG);

    const second = await upload(addImage, `/api/products/${product.id}/images`, owner.cookie, { file: png() }, { id: product.id });
    expect(second.body).toMatchObject({ optionValue: null, position: 1 });
    const shown = await call(getProduct, `/api/products/${product.id}`, { cookie: owner.cookie }, { id: product.id });
    expect(shown.body.images).toHaveLength(2);
  });

  it("reads the type from the bytes: a .png name with other content is refused", async () => {
    const { product } = await seedVariant(owner.shop.id);
    const send = (file: File) => upload(addImage, `/api/products/${product.id}/images`, owner.cookie, { file }, { id: product.id });

    const fake = await send(new File(["<html><script>alert(1)</script>"], "photo.png", { type: "image/png" }));
    expect(fake.status).toBe(422);
    expect(fake.body.error.code).toBe("UNSUPPORTED_FILE");
    // SVG is only accepted for logos.
    const svg = await send(new File(['<svg xmlns="http://www.w3.org/2000/svg"/>'], "a.svg", { type: "image/svg+xml" }));
    expect(svg.status).toBe(422);
    const big = await send(png(3 * 1024 * 1024 + 1));
    expect(big.status).toBe(422);
    expect(big.body.error.code).toBe("FILE_TOO_LARGE");
    expect(await prisma.productImage.count({ where: { productId: product.id } })).toBe(0);
  });

  it("asks for a file and for multipart", async () => {
    const { product } = await seedVariant(owner.shop.id);
    const none = await upload(addImage, `/api/products/${product.id}/images`, owner.cookie, { optionValue: "Red" }, { id: product.id });
    expect(none.status).toBe(400);
    const json = await call(addImage, `/api/products/${product.id}/images`, { method: "POST", cookie: owner.cookie, body: {} }, { id: product.id });
    expect(json.status).toBe(400);
  });

  it("deletes a photo and its file", async () => {
    const { product } = await seedVariant(owner.shop.id);
    const image = (await upload(addImage, `/api/products/${product.id}/images`, owner.cookie, { file: png() }, { id: product.id })).body;
    const res = await call(
      deleteImage,
      `/api/products/${product.id}/images/${image.id}`,
      { method: "DELETE", cookie: owner.cookie },
      { id: product.id, imageId: image.id },
    );
    expect(res.status).toBe(204);
    expect(await prisma.productImage.count({ where: { id: image.id } })).toBe(0);
    expect((await serve(image.url)).status).toBe(404);
    const files = await readdir(path.join(process.env.UPLOAD_DIR!, owner.shop.id));
    expect(files).not.toContain(image.url.split("/").pop());
  });

  it("serves nothing outside the upload folder", async () => {
    for (const segments of [["..", "package.json"], [owner.shop.id, "..", "x.png"], [owner.shop.id, "..%2Fx.png"], [owner.shop.id, "a.txt"]]) {
      const res = await serveUpload(new Request("http://localhost:3000/uploads/x"), { params: Promise.resolve({ path: segments }) });
      expect(res.status).toBe(404);
    }
  });
});

describe("roles", () => {
  it("lets staff read stock history but change nothing, and keeps delivery out", async () => {
    const { product, variant } = await seedVariant(owner.shop.id);
    const staff = cookies.staff;
    const id = { id: product.id };
    expect((await call(addVariant, "/v", { method: "POST", cookie: staff, body: { price: "1" } }, id)).status).toBe(403);
    expect((await call(archiveProduct, "/p", { method: "DELETE", cookie: staff }, id)).status).toBe(403);
    expect((await call(setOptions, "/o", { method: "PUT", cookie: staff, body: { options: [] } }, id)).status).toBe(403);
    expect((await call(patchVariant, "/v", { method: "PATCH", cookie: staff, body: { sku: "x" } }, { id: variant.id })).status).toBe(403);
    expect((await call(adjustStock, "/s", { method: "POST", cookie: staff, body: { delta: 1 } }, { id: variant.id })).status).toBe(403);
    expect((await upload(addImage, "/i", staff, { file: png() }, id)).status).toBe(403);
    expect((await call(movements, "/m", { cookie: cookies.delivery }, { id: variant.id })).status).toBe(403);
    expect((await call(adjustStock, "/s", { method: "POST", cookie: cookies.delivery, body: { delta: 1 } }, { id: variant.id })).status).toBe(403);
  });
});

describe("tenant isolation", () => {
  it("gives another shop's owner 404 on every product, variant and photo route, and changes nothing", async () => {
    const { product, variant } = await seedVariant(owner.shop.id, { available: 2 });
    const image = (await upload(addImage, `/api/products/${product.id}/images`, owner.cookie, { file: png() }, { id: product.id })).body;
    const cookie = other.cookie;
    const pid = { id: product.id };
    const vid = { id: variant.id };

    const statuses = [
      (await call(getProduct, "/p", { cookie }, pid)).status,
      (await call(archiveProduct, "/p", { method: "DELETE", cookie }, pid)).status,
      (await call(setOptions, "/o", { method: "PUT", cookie, body: { options: [] } }, pid)).status,
      (await call(addVariant, "/v", { method: "POST", cookie, body: { optionValues: ["XL", "Sand"], price: "1" } }, pid)).status,
      (await call(patchVariant, "/v", { method: "PATCH", cookie, body: { price: "0.01" } }, vid)).status,
      (await call(adjustStock, "/s", { method: "POST", cookie, body: { delta: -2 } }, vid)).status,
      (await call(movements, "/m", { cookie }, vid)).status,
      (await upload(addImage, "/i", cookie, { file: png() }, pid)).status,
      (await call(deleteImage, "/d", { method: "DELETE", cookie }, { id: product.id, imageId: image.id })).status,
    ];
    expect(statuses).toEqual(Array(statuses.length).fill(404));

    const after = await prisma.product.findUniqueOrThrow({ where: { id: product.id }, include: { variants: true, images: true } });
    expect(after.status).toBe("ACTIVE");
    expect(after.options).toEqual(["Size", "Colour"]);
    expect(after.variants).toEqual([expect.objectContaining({ available: 2, priceMinor: 2500n, optionValues: ["M", "Sand"] })]);
    expect(after.images).toHaveLength(1);
    expect((await serve(image.url)).status).toBe(200);
  });
});
