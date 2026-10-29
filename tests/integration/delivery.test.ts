import { beforeAll, describe, expect, it } from "vitest";
import { GET as deliveryList } from "@/app/api/delivery/orders/route";
import { POST as delivered } from "@/app/api/delivery/orders/[id]/delivered/route";
import { POST as failed } from "@/app/api/delivery/orders/[id]/failed/route";
import { GET as getOrder } from "@/app/api/orders/[id]/route";
import { prisma } from "@/server/db";
import { seedCourier, seedOrder, seedVariant } from "./fixtures";
import { addMember, call, resetDb, signUpOwner } from "./helpers";
import { moveOrder } from "./orderHelpers";

beforeAll(resetDb);

const markDelivered = (cookie: string, id: string, body: Record<string, string> = {}) =>
  call(delivered, `/api/delivery/orders/${id}/delivered`, { method: "POST", cookie, body }, { id });
const markFailed = (cookie: string, id: string, reason: string) =>
  call(failed, `/api/delivery/orders/${id}/failed`, { method: "POST", cookie, body: { reason } }, { id });

describe("delivery users", () => {
  async function setup() {
    const owner = await signUpOwner({ currency: "USD", usdLbpRate: "89500" });
    const toters = await seedCourier(owner.shop.id, { name: "Toters" });
    const sami = await seedCourier(owner.shop.id, { name: "Sami", type: "INDIVIDUAL" });
    const driver = await addMember(owner.shop.id, "delivery", toters.id);
    const { variant } = await seedVariant(owner.shop.id, { available: 20 });
    const mine = await seedOrder(owner.shop.id, { variantId: variant.id, status: "OUT_FOR_DELIVERY", courierId: toters.id });
    const packed = await seedOrder(owner.shop.id, { variantId: variant.id, status: "PACKED", courierId: toters.id });
    const theirs = await seedOrder(owner.shop.id, { variantId: variant.id, status: "OUT_FOR_DELIVERY", courierId: sami.id });
    return { owner, toters, sami, driver, variant, mine, packed, theirs };
  }

  it("see only their courier's run, with the address, phone and cash to collect", async () => {
    const { driver, mine, packed } = await setup();
    const res = await call(deliveryList, "/api/delivery/orders", { cookie: driver.cookie });
    expect(res.status).toBe(200);
    expect(res.body.map((o: { id: string }) => o.id).sort()).toEqual([mine.id, packed.id].sort());
    const out = res.body.find((o: { id: string }) => o.id === mine.id);
    expect(out).toMatchObject({
      customerPhone: "+96171123456",
      landmark: "Next to the pharmacy",
      codMinor: 2500,
      usdLbpRate: "89500",
      canComplete: true,
    });
    expect(res.body.find((o: { id: string }) => o.id === packed.id).canComplete).toBe(false);
  });

  it("mark their own order delivered with dollars and pounds, and it shows who delivered it", async () => {
    const { owner, driver, mine } = await setup();
    const res = await markDelivered(driver.cookie, mine.id, { collectedUsd: "20", collectedLbp: "447500" });
    expect(res.status).toBe(200);
    const order = await prisma.order.findUniqueOrThrow({ where: { id: mine.id } });
    expect(order).toMatchObject({ status: "DELIVERED", deliveredByUserId: driver.userId, reportedUsdCents: 2000n, reportedLbp: 447500n });

    const detail = await call(getOrder, `/api/orders/${mine.id}`, { cookie: owner.cookie }, { id: mine.id });
    expect(detail.body.deliveredBy.id).toBe(driver.userId);

    const done = await call(deliveryList, "/api/delivery/orders?view=done", { cookie: driver.cookie });
    expect(done.body.map((o: { id: string }) => o.id)).toEqual([mine.id]);
  });

  it("cannot record pounds on a dollar order when no exchange rate is known", async () => {
    const owner = await signUpOwner({ currency: "USD" });
    const courier = await seedCourier(owner.shop.id);
    const { variant } = await seedVariant(owner.shop.id);
    const order = await seedOrder(owner.shop.id, { variantId: variant.id, status: "OUT_FOR_DELIVERY", courierId: courier.id });
    const refused = await markDelivered(owner.cookie, order.id, { collectedLbp: "100000" });
    expect(refused.status).toBe(422);
    expect(refused.body.error.code).toBe("RATE_MISSING");
    expect((await markDelivered(owner.cookie, order.id, { collectedUsd: "25" })).status).toBe(200);
  });

  it("mark a failed delivery with a reason; the order is returned and restocked", async () => {
    const { driver, mine, variant } = await setup();
    const before = await prisma.variant.findUniqueOrThrow({ where: { id: variant.id } });
    const res = await markFailed(driver.cookie, mine.id, "Customer not answering");
    expect(res.status).toBe(200);
    const order = await prisma.order.findUniqueOrThrow({ where: { id: mine.id } });
    expect(order).toMatchObject({ status: "RETURNED", failureReason: "Customer not answering" });
    expect((await prisma.variant.findUniqueOrThrow({ where: { id: variant.id } })).available).toBe(before.available + 1);
  });

  it("get 404 on orders assigned to another courier, and 422 on orders not yet out", async () => {
    const { driver, theirs, packed } = await setup();
    expect((await markDelivered(driver.cookie, theirs.id)).status).toBe(404);
    expect((await markFailed(driver.cookie, theirs.id, "x")).status).toBe(404);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: theirs.id } })).status).toBe("OUT_FOR_DELIVERY");
    expect((await markDelivered(driver.cookie, packed.id)).status).toBe(422);
  });

  it("cannot open the board, read order details or move orders", async () => {
    const { driver, mine } = await setup();
    expect((await call(getOrder, `/api/orders/${mine.id}`, { cookie: driver.cookie }, { id: mine.id })).status).toBe(403);
    expect((await moveOrder(driver.cookie, mine.id, { to: "DELIVERED" })).status).toBe(403);
  });

  it("without a linked courier see nothing and can mark nothing", async () => {
    const { owner, mine } = await setup();
    const unlinked = await addMember(owner.shop.id, "delivery");
    expect((await call(deliveryList, "/api/delivery/orders", { cookie: unlinked.cookie })).body).toEqual([]);
    expect((await markDelivered(unlinked.cookie, mine.id)).status).toBe(404);
  });

  it("desk roles can mark any of the shop's orders and filter the run by courier", async () => {
    const { owner, sami, theirs } = await setup();
    const staff = await addMember(owner.shop.id, "staff");
    const run = await call(deliveryList, `/api/delivery/orders?courierId=${sami.id}`, { cookie: staff.cookie });
    expect(run.body.map((o: { id: string }) => o.id)).toEqual([theirs.id]);
    expect((await markDelivered(staff.cookie, theirs.id, { collectedUsd: "25" })).status).toBe(200);
  });

  it("never reach another shop's orders", async () => {
    const { mine } = await setup();
    const other = await signUpOwner();
    const otherCourier = await seedCourier(other.shop.id);
    const outsider = await addMember(other.shop.id, "delivery", otherCourier.id);
    expect((await markDelivered(outsider.cookie, mine.id)).status).toBe(404);
    expect((await markDelivered(other.cookie, mine.id)).status).toBe(404);
    expect((await call(deliveryList, "/api/delivery/orders", { cookie: outsider.cookie })).body).toEqual([]);
  });
});
