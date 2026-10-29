import { beforeAll, describe, expect, it } from "vitest";
import { GET as listProducts, POST as createProduct } from "@/app/api/products/route";
import { GET as getProduct, PATCH as patchProduct } from "@/app/api/products/[id]/route";
import { GET as catalogue } from "@/app/api/public/shops/[slug]/catalogue/route";
import { GET as listOrders } from "@/app/api/orders/route";
import { GET as getOrder, PATCH as patchOrder } from "@/app/api/orders/[id]/route";
import { POST as transition } from "@/app/api/orders/[id]/transitions/route";
import { POST as delivered } from "@/app/api/delivery/orders/[id]/delivered/route";
import { GET as listCouriers } from "@/app/api/couriers/route";
import { PATCH as patchCourier } from "@/app/api/couriers/[id]/route";
import { GET as listRemittances, POST as createRemittance } from "@/app/api/remittances/route";
import { GET as reconciliation } from "@/app/api/reconciliation/route";
import { DELETE as deleteCategory, PATCH as patchCategory } from "@/app/api/categories/[id]/route";
import { GET as listCategories } from "@/app/api/categories/route";
import { DELETE as deleteSlide, PATCH as patchSlide } from "@/app/api/shop/slides/[id]/route";
import { GET as listSlides } from "@/app/api/shop/slides/route";
import { PATCH as moderateTestimonial } from "@/app/api/testimonials/[id]/route";
import { GET as listTestimonials } from "@/app/api/testimonials/route";
import { prisma } from "@/server/db";
import { seedCourier, seedOrder, seedVariant } from "./fixtures";
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

// Orders, couriers and remittances: read, list, edit and transition attempts
// by every role of shop A against shop B.
describe("tenant isolation: orders, couriers and cash", () => {
  let shopA: Awaited<ReturnType<typeof signUpOwner>>;
  let shopB: Awaited<ReturnType<typeof signUpOwner>>;
  let orderB: string;
  let courierB: string;
  let courierA: string;
  let unassignedA: string;
  const actorsA: Record<string, string> = {};
  const desk = ["owner", "manager", "staff"];
  const managers = ["owner", "manager"];

  beforeAll(async () => {
    shopA = await signUpOwner();
    shopB = await signUpOwner();
    courierA = (await seedCourier(shopA.shop.id, { name: "A's courier" })).id;
    courierB = (await seedCourier(shopB.shop.id, { name: "B's secret courier" })).id;
    actorsA.owner = shopA.cookie;
    actorsA.manager = (await addMember(shopA.shop.id, "manager")).cookie;
    actorsA.staff = (await addMember(shopA.shop.id, "staff")).cookie;
    actorsA.delivery = (await addMember(shopA.shop.id, "delivery", courierA)).cookie;

    const { variant: vB } = await seedVariant(shopB.shop.id);
    orderB = (await seedOrder(shopB.shop.id, { variantId: vB.id, status: "OUT_FOR_DELIVERY", courierId: courierB, customerName: "B's secret customer" })).id;
    const delivered = await seedOrder(shopB.shop.id, { variantId: vB.id, status: "DELIVERED", courierId: courierB });
    await prisma.remittance.create({
      data: {
        shopId: shopB.shop.id,
        courierId: courierB,
        amountUsdCents: 2500n,
        receivedAt: new Date(),
        reference: "B's secret remittance",
        lines: { create: { shopId: shopB.shop.id, orderId: delivered.id, collectedUsdCents: 2500n } },
      },
    });
    const { variant: vA } = await seedVariant(shopA.shop.id);
    unassignedA = (await seedOrder(shopA.shop.id, { variantId: vA.id, status: "OUT_FOR_DELIVERY" })).id;
  });

  for (const role of ["owner", "manager", "staff", "delivery"]) {
    it(`${role} of shop A cannot read, edit or move shop B's order`, async () => {
      const cookie = actorsA[role];
      const expected = desk.includes(role) ? 404 : 403;
      const read = await call(getOrder, `/api/orders/${orderB}`, { cookie }, { id: orderB });
      expect(read.status).toBe(expected);
      expect(JSON.stringify(read.body)).not.toContain("secret");
      expect((await call(patchOrder, `/api/orders/${orderB}`, { method: "PATCH", cookie, body: { notes: "x" } }, { id: orderB })).status).toBe(expected);
      expect((await call(transition, `/api/orders/${orderB}/transitions`, { method: "POST", cookie, body: { to: "RETURNED" } }, { id: orderB })).status).toBe(expected);
      // Every role may mark deliveries, so the record itself must be invisible.
      expect((await call(delivered, `/api/delivery/orders/${orderB}/delivered`, { method: "POST", cookie, body: {} }, { id: orderB })).status).toBe(404);
    });

    it(`${role} of shop A cannot change shop B's courier or settle shop B's orders`, async () => {
      const cookie = actorsA[role];
      const patch = await call(patchCourier, `/api/couriers/${courierB}`, { method: "PATCH", cookie, body: { name: "hacked" } }, { id: courierB });
      expect(patch.status).toBe(managers.includes(role) ? 404 : 403);
      const settle = await call(createRemittance, "/api/remittances", {
        method: "POST",
        cookie,
        body: { courierId: courierA, receivedAt: "2026-10-20", amountUsd: "25", lines: [{ orderId: orderB, collectedUsd: "25" }] },
      });
      expect(settle.status).toBe(managers.includes(role) ? 404 : 403);
      const recon = await call(reconciliation, `/api/reconciliation?courierId=${courierB}`, { cookie });
      expect(recon.status).toBe(managers.includes(role) ? 404 : 403);
    });
  }

  it("shop A's lists never include shop B's orders, couriers or remittances", async () => {
    const orders = await call(listOrders, "/api/orders", { cookie: shopA.cookie });
    expect(orders.body.orders.map((o: { id: string }) => o.id)).toEqual([unassignedA]);
    const couriers = await call(listCouriers, "/api/couriers", { cookie: shopA.cookie });
    expect(couriers.body.map((c: { id: string }) => c.id)).toEqual([courierA]);
    const remittances = await call(listRemittances, "/api/remittances", { cookie: shopA.cookie });
    expect(remittances.body.remittances).toEqual([]);
    expect(JSON.stringify([orders.body, couriers.body, remittances.body])).not.toContain("secret");
  });

  it("a delivery user gets 404 on their own shop's orders that are not assigned to them", async () => {
    const res = await call(delivered, `/api/delivery/orders/${unassignedA}/delivered`, { method: "POST", cookie: actorsA.delivery, body: {} }, { id: unassignedA });
    expect(res.status).toBe(404);
  });

  it("shop B's order, courier and cash are untouched", async () => {
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderB } });
    expect(order).toMatchObject({ status: "OUT_FOR_DELIVERY", notes: null });
    expect((await prisma.courier.findUniqueOrThrow({ where: { id: courierB } })).name).toBe("B's secret courier");
    expect(await prisma.remittanceLine.count({ where: { orderId: orderB } })).toBe(0);
  });
});

// Hero slides, categories and testimonials of shop B, tried by every role of shop A.
describe("tenant isolation: storefront", () => {
  let shopA: Awaited<ReturnType<typeof signUpOwner>>;
  let shopB: Awaited<ReturnType<typeof signUpOwner>>;
  let slideB: string;
  let categoryB: string;
  let testimonialB: string;
  const actorsA: Record<string, string> = {};
  const roles = ["owner", "manager", "staff", "delivery"];
  // Who passes the role check for each action; everyone else gets 403 first.
  const settings = ["owner"];
  const managers = ["owner", "manager"];

  beforeAll(async () => {
    shopA = await signUpOwner();
    shopB = await signUpOwner();
    actorsA.owner = shopA.cookie;
    for (const role of roles.slice(1)) actorsA[role] = (await addMember(shopA.shop.id, role)).cookie;
    const b = shopB.shop.id;
    slideB = (await prisma.heroSlide.create({ data: { shopId: b, imageUrl: `/uploads/${b}/x.png`, title: "B's secret slide", position: 0 } })).id;
    categoryB = (await prisma.category.create({ data: { shopId: b, name: "B's secret category", position: 0 } })).id;
    testimonialB = (await prisma.testimonial.create({ data: { shopId: b, authorName: "B's secret fan", message: "A secret message for B" } })).id;
  });

  for (const role of roles) {
    it(`${role} of shop A cannot change or delete shop B's slide, category or testimonial`, async () => {
      const cookie = actorsA[role];
      const expected = (allowed: string[]) => (allowed.includes(role) ? 404 : 403);
      const patch = (route: typeof patchSlide, url: string, id: string, body: unknown) =>
        call(route, url, { method: "PATCH", cookie, body }, { id });
      const remove = (route: typeof deleteSlide, url: string, id: string) => call(route, url, { method: "DELETE", cookie }, { id });
      expect((await patch(patchSlide, `/api/shop/slides/${slideB}`, slideB, { title: "hacked" })).status).toBe(expected(settings));
      expect((await remove(deleteSlide, `/api/shop/slides/${slideB}`, slideB)).status).toBe(expected(settings));
      expect((await patch(patchCategory, `/api/categories/${categoryB}`, categoryB, { name: "hacked" })).status).toBe(expected(managers));
      expect((await remove(deleteCategory, `/api/categories/${categoryB}`, categoryB)).status).toBe(expected(managers));
      expect((await patch(moderateTestimonial, `/api/testimonials/${testimonialB}`, testimonialB, { status: "APPROVED" })).status).toBe(
        expected(managers),
      );
    });
  }

  it("shop A's lists never include shop B's storefront records", async () => {
    const lists = await Promise.all([
      call(listSlides, "/api/shop/slides", { cookie: shopA.cookie }),
      call(listCategories, "/api/categories", { cookie: shopA.cookie }),
      call(listTestimonials, "/api/testimonials", { cookie: shopA.cookie }),
      call(catalogue, `/api/public/shops/${shopA.shop.slug}/catalogue`, {}, { slug: shopA.shop.slug }),
    ]);
    for (const res of lists.slice(0, 3)) expect(res.body).toEqual([]);
    expect(JSON.stringify(lists.map((r) => r.body))).not.toContain("secret");
  });

  it("shop B's storefront records are untouched", async () => {
    expect((await prisma.heroSlide.findUniqueOrThrow({ where: { id: slideB } })).title).toBe("B's secret slide");
    expect((await prisma.category.findUniqueOrThrow({ where: { id: categoryB } })).name).toBe("B's secret category");
    expect((await prisma.testimonial.findUniqueOrThrow({ where: { id: testimonialB } })).status).toBe("PENDING");
  });
});
