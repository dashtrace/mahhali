import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { seedOrder, seedVariant } from "./fixtures";
import { addMember, resetDb, signUpOwner } from "./helpers";
import { callTool } from "./mcpHelpers";
import { connect } from "./oauthHelpers";

let ownerToken: string;
let staffToken: string;
let driverToken: string;

beforeAll(async () => {
  await resetDb();
  const owner = await signUpOwner();
  const shopId = owner.shop.id;
  const perfumes = await prisma.category.create({ data: { shopId, name: "عطور", position: 0 } });

  const rose = await seedVariant(shopId, { name: "عِطْر الورد", options: [], optionValues: [], priceMinor: 3000n, available: 2 });
  await prisma.product.update({ where: { id: rose.product.id }, data: { categoryId: perfumes.id } });
  const bag = await seedVariant(shopId, { name: "حقيبة جلد", options: ["Colour"], optionValues: ["أسود"], priceMinor: 6500n, available: 10 });
  await prisma.variant.create({ data: { shopId, productId: bag.product.id, optionValues: ["بني"], priceMinor: 6500n, available: 0, sku: "BAG-BRN" } });
  await seedVariant(shopId, { name: "Linen shirt", options: ["Size"], optionValues: ["M"], priceMinor: 2500n, available: 8 });
  const old = await seedVariant(shopId, { name: "Old hoodie", options: [], optionValues: [], available: 0 });
  await prisma.product.update({ where: { id: old.product.id }, data: { status: "ARCHIVED" } });

  // Two delivered orders with reviews; one comment hides a phone number.
  for (const [rating, comment] of [[5, "رائع جدًا"], [1, "Late and broken, call me 03 123 456"]] as const) {
    const order = await seedOrder(shopId, { variantId: rose.variant.id, status: "DELIVERED" });
    const item = await prisma.orderItem.findFirstOrThrow({ where: { orderId: order.id } });
    await prisma.review.create({
      data: { shopId, productId: rose.product.id, orderItemId: item.id, rating, comment, authorName: "Maya Haddad" },
    });
  }

  const stranger = await signUpOwner();
  await seedVariant(stranger.shop.id, { name: "عطر الغريب", options: [], optionValues: [] });

  ownerToken = (await connect({ cookie: owner.cookie, scopes: ["catalogue:read"] })).access_token;
  const staff = await addMember(shopId, "staff");
  staffToken = (await connect({ cookie: staff.cookie, scopes: ["catalogue:read"] })).access_token;
  const driver = await addMember(shopId, "delivery");
  driverToken = (await connect({ cookie: driver.cookie, scopes: ["orders:read", "catalogue:read"] })).access_token;
});

async function data(token: string, tool: string, args: Record<string, unknown> = {}) {
  const res = await callTool(token, tool, args);
  if (!res.ok) throw new Error(`${tool} refused: ${res.error}`);
  return res.data;
}
const names = (d: { products: { name: string }[] }) => d.products.map((p) => p.name).sort();

describe("catalogue tools", () => {
  it("lists active products with variants, prices and stock", async () => {
    const d = await data(ownerToken, "list_products");
    expect(names(d)).toEqual(["Linen shirt", "حقيبة جلد", "عِطْر الورد"].sort());
    const bag = d.products.find((p: { name: string }) => p.name === "حقيبة جلد");
    expect(bag.options).toEqual(["Colour"]);
    expect(bag.variants).toEqual([
      { options: ["أسود"], sku: null, price: { minor: 6500, text: "$65.00" }, available: 10, reserved: 0 },
      { options: ["بني"], sku: "BAG-BRN", price: { minor: 6500, text: "$65.00" }, available: 0, reserved: 0 },
    ]);
  });

  it("finds Arabic names however they are typed", async () => {
    expect(names(await data(ownerToken, "list_products", { search: "عطر" }))).toEqual(["عِطْر الورد"]);
    expect(names(await data(ownerToken, "list_products", { search: "حقيبه" }))).toEqual(["حقيبة جلد"]);
    expect(names(await data(ownerToken, "list_products", { search: "جلد بني" }))).toEqual(["حقيبة جلد"]);
    expect(names(await data(ownerToken, "list_products", { search: "bag-brn" }))).toEqual(["حقيبة جلد"]);
    expect(names(await data(ownerToken, "list_products", { category: "عطور" }))).toEqual(["عِطْر الورد"]);
  });

  it("includes archived products only on request, and never another shop's", async () => {
    expect(names(await data(ownerToken, "list_products", { includeArchived: true }))).toContain("Old hoodie");
    expect(names(await data(ownerToken, "list_products", { search: "الغريب" }))).toEqual([]);
  });

  it("lists low stock, lowest first, from active products only", async () => {
    const d = await data(ownerToken, "stock_levels");
    expect(d.variants.map((v: { product: string; available: number }) => [v.product, v.available])).toEqual([
      ["حقيبة جلد", 0],
      ["عِطْر الورد", 0],
    ]);
    const wider = await data(ownerToken, "stock_levels", { threshold: 8 });
    expect(wider.total).toBe(3);
  });

  it("lists reviews with the author and contact details masked", async () => {
    const d = await data(ownerToken, "list_reviews");
    expect(d.total).toBe(2);
    expect(d.reviews.map((r: { author: string }) => r.author)).toEqual(["Maya H.", "Maya H."]);
    const unhappy = await data(ownerToken, "list_reviews", { maxRating: 2 });
    expect(unhappy.reviews).toHaveLength(1);
    expect(unhappy.reviews[0]).toMatchObject({ rating: 1, comment: "Late and broken, call me [phone hidden]", product: "عِطْر الورد" });
    expect(unhappy.reviews[0].orderNumber).toEqual(expect.any(Number));
  });

  it("lets staff read the catalogue", async () => {
    expect((await data(staffToken, "list_products")).total).toBe(3);
  });

  it("keeps the catalogue from delivery members, even with the scope", async () => {
    expect((await callTool(driverToken, "list_products")).ok).toBe(false);
    expect((await callTool(driverToken, "stock_levels")).ok).toBe(false);
    expect((await callTool(driverToken, "list_reviews")).ok).toBe(false);
  });
});
