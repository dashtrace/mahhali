import { mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { GET as listCategories, POST as createCategory } from "@/app/api/categories/route";
import { DELETE as deleteCategory, PATCH as patchCategory } from "@/app/api/categories/[id]/route";
import { GET as getOrder } from "@/app/api/orders/[id]/route";
import { POST as createProduct } from "@/app/api/products/route";
import { PATCH as patchProduct } from "@/app/api/products/[id]/route";
import { GET as tracking } from "@/app/api/public/orders/[token]/route";
import { GET as catalogue } from "@/app/api/public/shops/[slug]/catalogue/route";
import { POST as submitTestimonial } from "@/app/api/public/shops/[slug]/testimonials/route";
import { GET as listSlides, POST as postSlide } from "@/app/api/shop/slides/route";
import { DELETE as deleteSlide, PATCH as patchSlide } from "@/app/api/shop/slides/[id]/route";
import { GET as getStorefront, PATCH as patchStorefront } from "@/app/api/shop/storefront/route";
import { GET as listTestimonials } from "@/app/api/testimonials/route";
import { PATCH as moderate } from "@/app/api/testimonials/[id]/route";
import { prisma } from "@/server/db";
import { resetRateLimits } from "@/server/http/rateLimit";
import { catalogueService } from "@/server/services/productService";
import { seedOrder, seedVariant } from "./fixtures";
import { addMember, call, resetDb, signUpOwner } from "./helpers";
import { orderBody, placeOrder } from "./orderHelpers";

type Owner = Awaited<ReturnType<typeof signUpOwner>>;

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);

let owner: Owner;
let other: Owner;
let manager: string;
let staff: string;

beforeAll(async () => {
  process.env.UPLOAD_DIR = await mkdtemp(path.join(tmpdir(), "mahhali-uploads-"));
  await resetDb();
  owner = await signUpOwner();
  other = await signUpOwner();
  manager = (await addMember(owner.shop.id, "manager")).cookie;
  staff = (await addMember(owner.shop.id, "staff")).cookie;
});

const publicCatalogue = (slug = owner.shop.slug) =>
  call(catalogue, `/api/public/shops/${slug}/catalogue`, {}, { slug });

describe("storefront settings", () => {
  const patch = (body: unknown, cookie = owner.cookie) =>
    call(patchStorefront, "/api/shop/storefront", { method: "PATCH", cookie, body });

  it("starts from the defaults", async () => {
    const res = await call(getStorefront, "/api/shop/storefront", { cookie: owner.cookie });
    expect(res.body).toEqual({
      tagline: null,
      about: null,
      shippingInfo: null,
      instagramUrl: null,
      facebookUrl: null,
      logoMode: "image-and-name",
      homeSection: "bestsellers",
      showTestimonials: true,
    });
  });

  it("saves copy, links and layout, and an empty string clears a field", async () => {
    const res = await patch({
      tagline: " Handmade in Beirut ",
      about: "We make rings.",
      instagramUrl: "https://www.instagram.com/layla",
      facebookUrl: "https://m.facebook.com/layla",
      logoMode: "name-only",
      homeSection: "featured",
      showTestimonials: false,
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ tagline: "Handmade in Beirut", logoMode: "name-only", homeSection: "featured", showTestimonials: false });
    const cleared = await patch({ tagline: "", facebookUrl: null });
    expect(cleared.body).toMatchObject({ tagline: null, facebookUrl: null, instagramUrl: "https://www.instagram.com/layla" });
    expect((await publicCatalogue()).body.shop).toMatchObject({ about: "We make rings.", logoMode: "name-only" });
  });

  it("refuses links to other hosts, unknown modes, long text and unknown fields", async () => {
    for (const body of [
      { instagramUrl: "https://evil.example/instagram.com" },
      { instagramUrl: "http://instagram.com/layla" },
      { facebookUrl: "https://www.instagram.com/layla" },
      { logoMode: "huge" },
      { homeSection: "random" },
      { tagline: "x".repeat(81) },
      { currency: "LBP" },
      {},
    ]) {
      expect((await patch(body)).status, JSON.stringify(body)).toBe(400);
    }
    expect((await prisma.shop.findUniqueOrThrow({ where: { id: owner.shop.id } })).instagramUrl).toBe("https://www.instagram.com/layla");
  });

  it("is owner only", async () => {
    expect((await patch({ tagline: "x" }, manager)).status).toBe(403);
    expect((await call(getStorefront, "/api/shop/storefront", { cookie: staff })).status).toBe(403);
  });
});

describe("hero slides", () => {
  async function upload(fields: Record<string, string>, cookie = owner.cookie, file: Blob = new File([PNG], "a.png")) {
    const form = new FormData();
    form.append("file", file);
    for (const [k, v] of Object.entries(fields)) form.append(k, v);
    const res = await postSlide(new Request("http://localhost:3000/api/shop/slides", { method: "POST", headers: { cookie }, body: form }), {
      params: Promise.resolve({}),
    });
    return { status: res.status, body: await res.json() };
  }

  it("adds, edits, reorders and deletes slides; the image goes with the slide", async () => {
    const first = await upload({ kicker: "NEW", title: "Autumn drop", body: "" });
    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({ kicker: "NEW", title: "Autumn drop", body: null, position: 0 });
    expect(first.body.imageUrl).toMatch(new RegExp(`^/uploads/${owner.shop.id}/`));
    const second = await upload({ title: "Gift sets" });
    expect(second.body.position).toBe(1);

    const moved = await call(
      patchSlide,
      `/api/shop/slides/${second.body.id}`,
      { method: "PATCH", cookie: owner.cookie, body: { position: 0, title: "Gift sets for Eid" } },
      { id: second.body.id },
    );
    expect(moved.status).toBe(200);
    expect(moved.body).toMatchObject({ title: "Gift sets for Eid", position: 0 });
    const list = await call(listSlides, "/api/shop/slides", { cookie: owner.cookie });
    expect(list.body.map((s: { id: string }) => s.id)).toEqual([second.body.id, first.body.id]);
    expect((await publicCatalogue()).body.shop.slides).toEqual([
      { id: second.body.id, imageUrl: second.body.imageUrl, kicker: null, title: "Gift sets for Eid", body: null },
      { id: first.body.id, imageUrl: first.body.imageUrl, kicker: "NEW", title: "Autumn drop", body: null },
    ]);

    const del = await call(deleteSlide, `/api/shop/slides/${first.body.id}`, { method: "DELETE", cookie: owner.cookie }, { id: first.body.id });
    expect(del.status).toBe(204);
    const files = await readdir(path.join(process.env.UPLOAD_DIR!, owner.shop.id));
    expect(files).toEqual([second.body.imageUrl.split("/").pop()]);
  });

  it("needs a title and a real image, and is owner only", async () => {
    expect((await upload({ title: "" })).status).toBe(400);
    expect((await upload({ title: "x".repeat(81) })).status).toBe(400);
    expect((await upload({ title: "Fake" }, owner.cookie, new File(["<html>"], "a.png"))).body.error.code).toBe("UNSUPPORTED_FILE");
    expect((await upload({ title: "Hi" }, manager)).status).toBe(403);
  });

  it("stops at 6 slides and leaves no stray file", async () => {
    const existing = await prisma.heroSlide.count({ where: { shopId: owner.shop.id } });
    for (let i = existing; i < 6; i += 1) expect((await upload({ title: `Slide ${i}` })).status).toBe(201);
    const before = (await readdir(path.join(process.env.UPLOAD_DIR!, owner.shop.id))).length;
    const seventh = await upload({ title: "One too many" });
    expect(seventh.status).toBe(422);
    expect(seventh.body.error.code).toBe("SLIDE_LIMIT");
    expect((await readdir(path.join(process.env.UPLOAD_DIR!, owner.shop.id))).length).toBe(before);
  });
});

describe("categories", () => {
  const create = (name: string, cookie = owner.cookie) =>
    call(createCategory, "/api/categories", { method: "POST", cookie, body: { name } });

  it("creates, renames, reorders and lists categories", async () => {
    const rings = await create(" Rings ");
    expect(rings.status).toBe(201);
    expect(rings.body).toMatchObject({ name: "Rings", position: 0 });
    const hoops = await create("Hoops", manager);
    expect(hoops.body.position).toBe(1);
    expect((await create("Rings")).body.error.code).toBe("DUPLICATE_CATEGORY");
    const renamed = await call(
      patchCategory,
      `/api/categories/${hoops.body.id}`,
      { method: "PATCH", cookie: manager, body: { name: "Earrings", position: 0 } },
      { id: hoops.body.id },
    );
    expect(renamed.body).toMatchObject({ name: "Earrings", position: 0 });
    const list = await call(listCategories, "/api/categories", { cookie: staff });
    expect(list.body.map((c: { name: string }) => c.name)).toEqual(["Earrings", "Rings"]);
    expect((await create("Bags", staff)).status).toBe(403);
  });

  it("files products under the shop's own categories only, and deleting one leaves them uncategorised", async () => {
    const mine = await create("Necklaces");
    const theirs = await call(createCategory, "/api/categories", { method: "POST", cookie: other.cookie, body: { name: "Secret" } });
    const variants = [{ size: "M", price: "10", stock: 1 }];
    const refused = await call(createProduct, "/api/products", {
      method: "POST",
      cookie: owner.cookie,
      body: { name: "Chain", variants, categoryId: theirs.body.id },
    });
    expect(refused.status).toBe(404);
    const product = await call(createProduct, "/api/products", {
      method: "POST",
      cookie: owner.cookie,
      body: {
        name: "Chain",
        variants,
        categoryId: mine.body.id,
        featured: true,
        specs: [{ label: "Metal", value: "Silver" }],
      },
    });
    expect(product.status).toBe(201);
    const moved = await call(
      patchProduct,
      `/api/products/${product.body.id}`,
      { method: "PATCH", cookie: owner.cookie, body: { categoryId: theirs.body.id } },
      { id: product.body.id },
    );
    expect(moved.status).toBe(404);

    const listed = (await publicCatalogue()).body;
    expect(listed.shop.categories).toContainEqual({ id: mine.body.id, name: "Necklaces", productCount: 1 });
    expect(listed.products[0]).toMatchObject({ categoryId: mine.body.id, featured: true, specs: [{ label: "Metal", value: "Silver" }], customization: null });

    const del = await call(deleteCategory, `/api/categories/${mine.body.id}`, { method: "DELETE", cookie: owner.cookie }, { id: mine.body.id });
    expect(del.status).toBe(204);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.body.id } })).categoryId).toBeNull();
  });
});

describe("testimonials", () => {
  const submit = (body: unknown, ip = "10.9.0.1", slug = owner.shop.slug) =>
    call(submitTestimonial, `/api/public/shops/${slug}/testimonials`, { method: "POST", body, headers: { "x-forwarded-for": ip } }, { slug });

  it("needs consent and a real message, then waits for approval", async () => {
    resetRateLimits();
    expect((await submit({ authorName: "Rana", message: "Lovely rings, fast delivery." })).status).toBe(400);
    expect((await submit({ authorName: "Rana", message: "Lovely rings, fast delivery.", consent: false })).status).toBe(400);
    expect((await submit({ authorName: "Rana", message: "Too short", consent: true })).status).toBe(400);
    // 10 UTF-16 units but 5 characters: a 400, not a database CHECK failure.
    expect((await submit({ authorName: "Rana", message: "😀😀😀😀😀", consent: true })).status).toBe(400);
    const ok = await submit({ authorName: "Rana", message: "Lovely rings, fast delivery.", consent: true });
    expect(ok.status).toBe(201);
    expect(ok.body).toEqual({ status: "PENDING" });
    await submit({ authorName: "Spam", message: "Buy followers cheap now!!", consent: true });
  });

  it("shows only approved ones on the storefront, and none when switched off", async () => {
    const pending = await call(listTestimonials, "/api/testimonials?status=PENDING", { cookie: staff });
    expect(pending.body).toHaveLength(2);
    const rana = pending.body.find((t: { authorName: string }) => t.authorName === "Rana");
    const spam = pending.body.find((t: { authorName: string }) => t.authorName === "Spam");
    const approve = (id: string, status: string, cookie = manager) =>
      call(moderate, `/api/testimonials/${id}`, { method: "PATCH", cookie, body: { status } }, { id });
    expect((await approve(rana.id, "APPROVED", staff)).status).toBe(403);
    const approved = await approve(rana.id, "APPROVED");
    expect(approved.body).toMatchObject({ status: "APPROVED" });
    expect(approved.body.moderatedAt).toBeTruthy();
    expect((await approve(spam.id, "REJECTED")).body.status).toBe("REJECTED");
    expect((await approve(spam.id, "PENDING")).status).toBe(400);

    await call(patchStorefront, "/api/shop/storefront", { method: "PATCH", cookie: owner.cookie, body: { showTestimonials: false } });
    expect((await publicCatalogue()).body.testimonials).toEqual([]);
    await call(patchStorefront, "/api/shop/storefront", { method: "PATCH", cookie: owner.cookie, body: { showTestimonials: true } });
    const shown = (await publicCatalogue()).body.testimonials;
    expect(shown).toEqual([{ id: rana.id, authorName: "Rana", message: "Lovely rings, fast delivery.", createdAt: expect.any(String) }]);
  });

  it("is rate limited per address", async () => {
    resetRateLimits();
    const body = { authorName: "Rana", message: "Lovely rings, fast delivery.", consent: true };
    for (let i = 0; i < 5; i += 1) expect((await submit(body, "10.9.0.2")).status).toBe(201);
    expect((await submit(body, "10.9.0.2")).status).toBe(429);
  });
});

describe("customization notes on orders", () => {
  let variantId: string;

  beforeAll(async () => {
    const { product, variant } = await seedVariant(owner.shop.id, { name: "Signet ring", available: 5 });
    await prisma.product.update({
      where: { id: product.id },
      data: { customLabel: "Engraving", customRequired: true, customMaxLength: 10 },
    });
    await prisma.productImage.create({ data: { shopId: owner.shop.id, productId: product.id, url: "/uploads/x/ring.png" } });
    variantId = variant.id;
  });

  it("refuses an order without the required note, or with one too long, and reserves nothing", async () => {
    const missing = await placeOrder(owner.shop.slug, orderBody([{ variantId }]));
    expect(missing.status).toBe(422);
    expect(missing.body.error.code).toBe("CUSTOMIZATION_REQUIRED");
    const long = await placeOrder(owner.shop.slug, { ...orderBody([]), items: [{ variantId, qty: 1, note: "x".repeat(11) }] });
    expect(long.status).toBe(422);
    expect((await prisma.variant.findUniqueOrThrow({ where: { id: variantId } })).reserved).toBe(0);
  });

  it("stores each line's note, reserves every line of the same variant, and shows the note to staff and the customer", async () => {
    const placed = await placeOrder(owner.shop.slug, {
      ...orderBody([]),
      items: [
        { variantId, qty: 1, note: " Maya " },
        { variantId, qty: 2, note: "Rami" },
      ],
    });
    expect(placed.status).toBe(201);
    expect(await prisma.variant.findUniqueOrThrow({ where: { id: variantId } })).toMatchObject({ available: 2, reserved: 3 });

    const order = await prisma.order.findFirstOrThrow({ where: { publicToken: placed.body.token } });
    const detail = await call(getOrder, `/api/orders/${order.id}`, { cookie: staff }, { id: order.id });
    expect(detail.body.items.map((i: { note: string }) => i.note).sort()).toEqual(["Maya", "Rami"]);
    const tracked = await call(tracking, `/api/public/orders/${placed.body.token}`, {}, { token: placed.body.token });
    expect(tracked.body.order.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ note: "Maya", qty: 1, imageUrl: "/uploads/x/ring.png" })]),
    );
  });

  it("drops a note sent for a product without customization, and rejects the same line twice", async () => {
    const { variant } = await seedVariant(owner.shop.id, { name: "Plain band" });
    const placed = await placeOrder(owner.shop.slug, { ...orderBody([]), items: [{ variantId: variant.id, qty: 1, note: "ignored" }] });
    expect(placed.status).toBe(201);
    const item = await prisma.orderItem.findFirstOrThrow({ where: { variantId: variant.id } });
    expect(item.note).toBeNull();
    const twice = await placeOrder(owner.shop.slug, {
      ...orderBody([]),
      items: [
        { variantId: variant.id, qty: 1 },
        { variantId: variant.id, qty: 1 },
      ],
    });
    expect(twice.status).toBe(400);
    // Different notes on a plain product must not lift the 20-per-variant cap.
    const split = await placeOrder(owner.shop.slug, {
      ...orderBody([]),
      items: [
        { variantId: variant.id, qty: 20, note: "a" },
        { variantId: variant.id, qty: 1, note: "b" },
      ],
    });
    expect(split.status).toBe(400);
  });

  it("accepts customization settings on products and publishes them", async () => {
    const product = await call(createProduct, "/api/products", {
      method: "POST",
      cookie: owner.cookie,
      body: { name: "Mug", variants: [{ price: "8", stock: 3 }], customLabel: "Name on mug", customPlaceholder: "e.g. Maya", customMaxLength: 501 },
    });
    expect(product.status).toBe(400);
    const ok = await call(createProduct, "/api/products", {
      method: "POST",
      cookie: owner.cookie,
      body: { name: "Mug", variants: [{ price: "8", stock: 3 }], customLabel: "Name on mug", customPlaceholder: "e.g. Maya" },
    });
    expect(ok.status).toBe(201);
    const mug = (await publicCatalogue()).body.products.find((p: { id: string }) => p.id === ok.body.id);
    expect(mug.customization).toEqual({ label: "Name on mug", placeholder: "e.g. Maya", required: false, maxLength: 240 });
  });
});

describe("catalogueService.browse", () => {
  let shop: Owner;

  beforeAll(async () => {
    shop = await signUpOwner();
    // A cheap variant that is sold out must not make the product match a low price range.
    const { product } = await seedVariant(shop.shop.id, { name: "Hoodie", size: "S", priceMinor: 1000n, available: 0 });
    await prisma.variant.create({ data: { shopId: shop.shop.id, productId: product.id, size: "L", priceMinor: 6000n, available: 3 } });
    const { variant: tee } = await seedVariant(shop.shop.id, { name: "Tee", priceMinor: 1500n, available: 4 });
    await seedOrder(shop.shop.id, { variantId: tee.id, qty: 2 });
    await seedOrder(shop.shop.id, { variantId: tee.id, qty: 5, status: "RETURNED" });
    const { variant: cancelled } = await seedVariant(shop.shop.id, { name: "Cap", priceMinor: 900n, available: 4 });
    await seedOrder(shop.shop.id, { variantId: cancelled.id, qty: 3, status: "CANCELLED" });
  });

  it("matches a price range on in-stock variants only", async () => {
    const cheap = await catalogueService.browse(shop.shop.slug, { min: 0n, max: 2000n });
    expect(cheap.items.map((p) => p.name).sort()).toEqual(["Cap", "Tee"]);
    const dear = await catalogueService.browse(shop.shop.slug, { min: 5000n });
    expect(dear.items.map((p) => [p.name, p.matchPriceMinor])).toEqual([["Hoodie", 6000n]]);
  });

  it("counts sales from orders that were not cancelled or returned", async () => {
    const best = await catalogueService.browse(shop.shop.slug, { sort: "bestsellers" });
    expect(best.items.map((p) => [p.name, p.soldCount])).toEqual([["Tee", 2]]);
    expect(best).toMatchObject({ total: 1, page: 1, pageCount: 1 });
  });

  it("pages results and 404s for an unknown shop", async () => {
    const page = await catalogueService.browse(shop.shop.slug, { pageSize: 2, page: 2 });
    expect(page).toMatchObject({ total: 3, page: 2, pageCount: 2 });
    expect(page.items).toHaveLength(1);
    await expect(catalogueService.browse("no-such-shop")).rejects.toMatchObject({ status: 404 });
  });
});
