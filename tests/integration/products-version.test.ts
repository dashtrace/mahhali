import { beforeAll, describe, expect, it } from "vitest";
import { GET as versionRoute } from "@/app/api/products/version/route";
import { POST as createProduct } from "@/app/api/products/route";
import { prisma } from "@/server/db";
import { seedOrder, seedVariant } from "./fixtures";
import { addMember, call, resetDb, signUpOwner } from "./helpers";

// The products page polls this every 2 seconds and reloads only when it changes.

let owner: Awaited<ReturnType<typeof signUpOwner>>;
const version = async (cookie = owner.cookie) => {
  const res = await call(versionRoute, "/api/products/version", { cookie });
  expect(res.status).toBe(200);
  return res.body.version as string;
};

beforeAll(async () => {
  await resetDb();
  owner = await signUpOwner();
});

describe("product list version", () => {
  it("stays the same while nothing changes", async () => {
    expect(await version()).toBe(await version());
  });

  it("changes when a product is added", async () => {
    const before = await version();
    const res = await call(createProduct, "/api/products", {
      method: "POST",
      cookie: owner.cookie,
      body: { name: "Cedar hoodie", variants: [{ price: "35", stock: 4 }] },
    });
    expect(res.status).toBe(201);
    expect(await version()).not.toBe(before);
  });

  it("changes when a product is edited or archived", async () => {
    const { product } = await seedVariant(owner.shop.id, { name: "Cap", options: [], optionValues: [] });
    const before = await version();
    await prisma.product.update({ where: { id: product.id }, data: { status: "ARCHIVED" } });
    expect(await version()).not.toBe(before);
  });

  it("changes when an order moves stock", async () => {
    const { variant } = await seedVariant(owner.shop.id, { name: "Scarf", options: [], optionValues: [], available: 5 });
    const before = await version();
    await seedOrder(owner.shop.id, { variantId: variant.id });
    expect(await version()).not.toBe(before);
  });

  it("does not change when another shop's products do", async () => {
    const other = await signUpOwner();
    const before = await version();
    await seedVariant(other.shop.id, { name: "Their product", options: [], optionValues: [] });
    expect(await version()).toBe(before);
  });

  it("is readable by staff but not by delivery members or signed-out visitors", async () => {
    const staff = await addMember(owner.shop.id, "staff");
    expect(await version(staff.cookie)).toEqual(expect.any(String));
    const rider = await addMember(owner.shop.id, "delivery");
    expect((await call(versionRoute, "/api/products/version", { cookie: rider.cookie })).status).toBe(403);
    expect((await call(versionRoute, "/api/products/version")).status).toBe(401);
  });
});
