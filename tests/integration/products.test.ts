import { beforeAll, describe, expect, it } from "vitest";
import { GET as listProducts, POST as createProduct } from "@/app/api/products/route";
import { GET as catalogue } from "@/app/api/public/shops/[slug]/catalogue/route";
import { prisma } from "@/server/db";
import { addMember, call, resetDb, signUpOwner } from "./helpers";

beforeAll(resetDb);

const tshirt = {
  name: "Linen shirt",
  description: "Hand-dyed",
  variants: [
    { size: "S", colour: "Sand", price: "24.50", stock: 3 },
    { size: "M", colour: "Sand", price: "24.50", stock: 0 },
  ],
};

describe("products", () => {
  it("lets an owner create a product with variants, prices in cents and stock logged", async () => {
    const owner = await signUpOwner();
    const res = await call(createProduct, "/api/products", { method: "POST", cookie: owner.cookie, body: tshirt });
    expect(res.status).toBe(201);
    expect(res.body.variants).toHaveLength(2);
    expect(res.body.variants.map((v: { priceMinor: number }) => v.priceMinor)).toEqual([2450, 2450]);

    const movements = await prisma.stockMovement.findMany({ where: { shopId: owner.shop.id } });
    expect(movements).toHaveLength(1);
    expect(movements[0]).toMatchObject({ delta: 3, reason: "ADJUST" });
  });

  it("refuses cents for a shop that prices in pounds", async () => {
    const owner = await signUpOwner({ currency: "LBP", usdLbpRate: "89500" });
    const res = await call(createProduct, "/api/products", {
      method: "POST",
      cookie: owner.cookie,
      body: { name: "Scarf", variants: [{ colour: "Red", price: "450000.50", stock: 1 }] },
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("INVALID_PRICE");
  });

  it("refuses the same size and colour twice", async () => {
    const owner = await signUpOwner();
    const res = await call(createProduct, "/api/products", {
      method: "POST",
      cookie: owner.cookie,
      body: { name: "Ring", variants: [{ size: "7", price: "10" }, { size: "7", price: "12" }] },
    });
    expect(res.status).toBe(400);
  });

  it("lets staff read products but not create them", async () => {
    const owner = await signUpOwner();
    const staff = await addMember(owner.shop.id, "staff");
    expect((await call(listProducts, "/api/products", { cookie: staff.cookie })).status).toBe(200);
    const res = await call(createProduct, "/api/products", { method: "POST", cookie: staff.cookie, body: tshirt });
    expect(res.status).toBe(403);
  });

  it("keeps delivery users out of the product list", async () => {
    const owner = await signUpOwner();
    const delivery = await addMember(owner.shop.id, "delivery");
    expect((await call(listProducts, "/api/products", { cookie: delivery.cookie })).status).toBe(403);
  });

  it("requires sign-in", async () => {
    expect((await call(listProducts, "/api/products")).status).toBe(401);
  });

  it("shows the public catalogue without stock counts", async () => {
    const owner = await signUpOwner();
    await call(createProduct, "/api/products", { method: "POST", cookie: owner.cookie, body: tshirt });
    const res = await call(catalogue, `/api/public/shops/${owner.shop.slug}/catalogue`, {}, { slug: owner.shop.slug });
    expect(res.status).toBe(200);
    expect(res.body.products[0].variants).toEqual([
      expect.objectContaining({ size: "M", inStock: false }),
      expect.objectContaining({ size: "S", inStock: true }),
    ]);
    expect(JSON.stringify(res.body)).not.toContain("available");
  });

  it("returns 404 for a shop that does not exist", async () => {
    const res = await call(catalogue, "/api/public/shops/no-such-shop/catalogue", {}, { slug: "no-such-shop" });
    expect(res.status).toBe(404);
  });
});
