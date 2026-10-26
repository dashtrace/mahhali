import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { seedVariant } from "./fixtures";
import { resetDb, signUpOwner } from "./helpers";
import { orderBody, placeOrder } from "./orderHelpers";

beforeAll(resetDb);

// Real PostgreSQL, real transactions, requests fired at the same moment.
describe("concurrent orders", () => {
  it("sells the last item exactly once when twenty buyers race for it", async () => {
    const owner = await signUpOwner();
    const { variant } = await seedVariant(owner.shop.id, { available: 1 });

    const results = await Promise.all(
      Array.from({ length: 20 }, () => placeOrder(owner.shop.slug, orderBody([{ variantId: variant.id }]))),
    );

    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(19);
    expect(results.filter((r) => r.status === 409).every((r) => r.body.error.code === "OUT_OF_STOCK")).toBe(true);
    const v = await prisma.variant.findUniqueOrThrow({ where: { id: variant.id } });
    expect([v.available, v.reserved]).toEqual([0, 1]);
    expect(await prisma.order.count({ where: { shopId: owner.shop.id } })).toBe(1);
  });

  it("gives fifty simultaneous orders fifty distinct, consecutive numbers", async () => {
    const owner = await signUpOwner();
    const { variant } = await seedVariant(owner.shop.id, { available: 100 });

    const results = await Promise.all(
      Array.from({ length: 50 }, () => placeOrder(owner.shop.slug, orderBody([{ variantId: variant.id }]))),
    );

    expect(results.every((r) => r.status === 201)).toBe(true);
    const numbers = results.map((r) => r.body.number as number).sort((a, b) => a - b);
    expect(numbers).toEqual(Array.from({ length: 50 }, (_, i) => 1001 + i));
    const v = await prisma.variant.findUniqueOrThrow({ where: { id: variant.id } });
    expect([v.available, v.reserved]).toEqual([50, 50]);
  });

  it("does not deadlock when two orders lock the same variants in opposite order", async () => {
    const owner = await signUpOwner();
    const { variant: a } = await seedVariant(owner.shop.id, { name: "A", available: 40 });
    const { variant: b } = await seedVariant(owner.shop.id, { name: "B", available: 40 });

    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        placeOrder(
          owner.shop.slug,
          orderBody(i % 2 ? [{ variantId: a.id }, { variantId: b.id }] : [{ variantId: b.id }, { variantId: a.id }]),
        ),
      ),
    );

    expect(results.map((r) => r.status)).toEqual(Array(20).fill(201));
    const counters = await prisma.variant.findMany({ where: { id: { in: [a.id, b.id] } } });
    expect(counters.map((v) => [v.available, v.reserved])).toEqual([[20, 20], [20, 20]]);
  });

  it("creates one order when a double tap sends the same idempotency key twice at once", async () => {
    const owner = await signUpOwner();
    const { variant } = await seedVariant(owner.shop.id, { available: 1 });
    const body = orderBody([{ variantId: variant.id }]);

    const results = await Promise.all(
      Array.from({ length: 5 }, () => placeOrder(owner.shop.slug, body, { key: "double-tap-key-1" })),
    );

    expect(results.every((r) => r.status === 201 || r.status === 200)).toBe(true);
    expect(new Set(results.map((r) => r.body.number))).toEqual(new Set([1001]));
    expect(await prisma.order.count({ where: { shopId: owner.shop.id } })).toBe(1);
  });

  it("keeps two shops' numbers independent", async () => {
    const one = await signUpOwner();
    const two = await signUpOwner();
    const { variant: v1 } = await seedVariant(one.shop.id);
    const { variant: v2 } = await seedVariant(two.shop.id);
    const [a, b] = await Promise.all([
      placeOrder(one.shop.slug, orderBody([{ variantId: v1.id }])),
      placeOrder(two.shop.slug, orderBody([{ variantId: v2.id }])),
    ]);
    expect([a.body.number, b.body.number]).toEqual([1001, 1001]);
  });
});
