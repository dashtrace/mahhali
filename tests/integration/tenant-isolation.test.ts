import { beforeAll, describe, expect, it } from "vitest";
import { GET as listProducts, POST as createProduct } from "@/app/api/products/route";
import { GET as getProduct, PATCH as patchProduct } from "@/app/api/products/[id]/route";
import { GET as catalogue } from "@/app/api/public/shops/[slug]/catalogue/route";
import { prisma } from "@/server/db";
import { addMember, call, resetDb, signUpOwner } from "./helpers";

// One business must never read or change another business's data.
// Every role of shop A is tried against shop B's records.
describe("tenant isolation", () => {
  let shopA: Awaited<ReturnType<typeof signUpOwner>>;
  let shopB: Awaited<ReturnType<typeof signUpOwner>>;
  let productB: string;
  const actorsA: Record<string, string> = {};

  beforeAll(async () => {
    await resetDb();
    shopA = await signUpOwner();
    shopB = await signUpOwner();
    actorsA.owner = shopA.cookie;
    actorsA.manager = (await addMember(shopA.shop.id, "manager")).cookie;
    actorsA.staff = (await addMember(shopA.shop.id, "staff")).cookie;
    actorsA.delivery = (await addMember(shopA.shop.id, "delivery")).cookie;

    const created = await call(createProduct, "/api/products", {
      method: "POST",
      cookie: shopB.cookie,
      body: { name: "B's secret product", variants: [{ size: "M", price: "10", stock: 5 }] },
    });
    productB = created.body.id;
  });

  // Roles without the permission are stopped by the role check first (403);
  // everyone else gets 404, as if shop B's record did not exist.
  const canRead = ["owner", "manager", "staff"];
  const canWrite = ["owner", "manager"];

  for (const role of ["owner", "manager", "staff", "delivery"]) {
    it(`${role} of shop A cannot read shop B's product`, async () => {
      const res = await call(getProduct, `/api/products/${productB}`, { cookie: actorsA[role] }, { id: productB });
      expect(res.status).toBe(canRead.includes(role) ? 404 : 403);
      expect(JSON.stringify(res.body)).not.toContain("secret");
    });

    it(`${role} of shop A cannot change shop B's product`, async () => {
      const res = await call(
        patchProduct,
        `/api/products/${productB}`,
        { method: "PATCH", cookie: actorsA[role], body: { name: "hacked" } },
        { id: productB },
      );
      expect(res.status).toBe(canWrite.includes(role) ? 404 : 403);
    });
  }

  it("shop A's list never includes shop B's products", async () => {
    const res = await call(listProducts, "/api/products", { cookie: shopA.cookie });
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("shop B's product is unchanged", async () => {
    const product = await prisma.product.findUniqueOrThrow({ where: { id: productB } });
    expect(product.name).toBe("B's secret product");
  });

  it("shop A's public catalogue shows nothing from shop B", async () => {
    const res = await call(
      catalogue,
      `/api/public/shops/${shopA.shop.slug}/catalogue`,
      {},
      { slug: shopA.shop.slug },
    );
    expect(res.body.products).toEqual([]);
  });

  it("the owner of shop B can still read it", async () => {
    const res = await call(getProduct, `/api/products/${productB}`, { cookie: shopB.cookie }, { id: productB });
    expect(res.status).toBe(200);
  });
});
