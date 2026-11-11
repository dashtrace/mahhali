import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { seedCourier, seedOrder, seedVariant } from "./fixtures";
import { addMember, resetDb, signUpOwner } from "./helpers";
import { callTool } from "./mcpHelpers";
import { connect } from "./oauthHelpers";

const DAY = 24 * 60 * 60 * 1000;
const today = new Date().toISOString().slice(0, 10);

let ownerToken: string;
let staffToken: string;
let driverToken: string;
let otherDriverToken: string;
let courierId: string;

beforeAll(async () => {
  await resetDb();
  const owner = await signUpOwner();
  const shopId = owner.shop.id;
  const { variant } = await seedVariant(shopId, { name: "Oud perfume", options: [], optionValues: [], priceMinor: 4500n, available: 50 });
  const courier = await seedCourier(shopId, { name: "Toters" });
  const other = await seedCourier(shopId, { name: "Rami" });
  courierId = courier.id;

  const fresh = await seedOrder(shopId, { variantId: variant.id, customerName: "Maya Haddad", customerPhone: "+96171123456" });
  await prisma.order.update({ where: { id: fresh.id }, data: { notes: "Call me on 71 123 456 or maya@example.com" } });
  await seedOrder(shopId, { variantId: variant.id, status: "OUT_FOR_DELIVERY", courierId: courier.id, customerName: "Karim Nassar", customerPhone: "+9613555777" });
  await seedOrder(shopId, { variantId: variant.id, status: "OUT_FOR_DELIVERY", courierId: other.id, customerName: "Lina Saad", customerPhone: "+96170111222" });
  await seedOrder(shopId, { variantId: variant.id, status: "DELIVERED", courierId: courier.id, createdAt: new Date(Date.now() - 3 * DAY) });

  // Another shop with the same order numbers and an item name that must never show up.
  const stranger = await signUpOwner();
  const { variant: secret } = await seedVariant(stranger.shop.id, { name: "Stranger secret item", options: [], optionValues: [] });
  await seedOrder(stranger.shop.id, { variantId: secret.id, customerName: "Other Customer", customerPhone: "+96176999888" });

  ownerToken = (await connect({ cookie: owner.cookie, scopes: ["orders:read"] })).access_token;
  const staff = await addMember(shopId, "staff");
  staffToken = (await connect({ cookie: staff.cookie, scopes: ["orders:read"] })).access_token;
  const driver = await addMember(shopId, "delivery", courier.id);
  driverToken = (await connect({ cookie: driver.cookie, scopes: ["orders:read"] })).access_token;
  const otherDriver = await addMember(shopId, "delivery", other.id);
  otherDriverToken = (await connect({ cookie: otherDriver.cookie, scopes: ["orders:read"] })).access_token;
});

async function data(token: string, tool: string, args: Record<string, unknown> = {}) {
  const res = await callTool(token, tool, args);
  if (!res.ok) throw new Error(`${tool} refused: ${res.error}`);
  return res.data;
}

describe("order tools", () => {
  it("lists the shop's orders, newest first, with counts per status", async () => {
    const d = await data(ownerToken, "list_orders");
    expect(d.orders.map((o: { number: number }) => o.number)).toEqual([1003, 1002, 1001, 1004]); // #1004 was created 3 days ago
    expect(d.countsByStatus).toEqual({ NEW: 1, OUT_FOR_DELIVERY: 2, DELIVERED: 1 });
    const first = d.orders.find((o: { number: number }) => o.number === 1001);
    expect(first.items).toEqual([{ name: "Oud perfume", qty: 1 }]);
    expect(first.total).toEqual({ minor: 4500, text: "$45.00" });
  });

  it("never shows another shop's orders", async () => {
    const d = await data(ownerToken, "list_orders", { search: "Stranger" });
    expect(d.orders).toEqual([]);
    const order = await data(ownerToken, "get_order", { number: 1001 });
    expect(JSON.stringify(order)).not.toContain("Stranger secret item");
  });

  it("masks the customer's name, phone, street and anything contact-like in notes", async () => {
    const d = await data(ownerToken, "list_orders", { status: "NEW" });
    const o = d.orders[0];
    expect(o.customer).toEqual({ name: "Maya H.", phone: "+961 7•••••56" });
    expect(o.deliverTo).toEqual({ governorate: "Beirut", district: "Beirut", area: "Mar Mikhael" });
    expect(o.notes).toBe("Call me on [phone hidden] or [email hidden]");
    const text = JSON.stringify(await data(ownerToken, "get_order", { number: 1001 }));
    for (const secret of ["71123456", "Haddad", "Armenia St", "pharmacy", "maya@example.com"]) expect(text).not.toContain(secret);
  });

  it("filters by status, search and date range", async () => {
    const byStatus = await data(ownerToken, "list_orders", { status: "OUT_FOR_DELIVERY" });
    expect(byStatus.orders.map((o: { number: number }) => o.number)).toEqual([1003, 1002]);
    const byNumber = await data(ownerToken, "list_orders", { search: "#1002" });
    expect(byNumber.orders.map((o: { number: number }) => o.number)).toEqual([1002]);
    const byPhone = await data(ownerToken, "list_orders", { search: "03 555 777" });
    expect(byPhone.orders.map((o: { number: number }) => o.number)).toEqual([1002]);
    const todayOnly = await data(ownerToken, "list_orders", { from: today, to: today });
    expect(todayOnly.orders.map((o: { number: number }) => o.number)).toEqual([1003, 1002, 1001]);
    const byCourier = await data(ownerToken, "list_orders", { courierId });
    expect(byCourier.orders.map((o: { number: number }) => o.number)).toEqual([1002, 1004]);
  });

  it("pages through results with nextCursor", async () => {
    const first = await data(ownerToken, "list_orders", { limit: 2 });
    expect(first.orders).toHaveLength(2);
    const second = await data(ownerToken, "list_orders", { limit: 2, cursor: first.nextCursor });
    expect(second.orders.map((o: { number: number }) => o.number)).toEqual([1001, 1004]);
    expect(second.nextCursor).toBeNull();
  });

  it("gives one order's prices, courier, history and next statuses", async () => {
    const o = await data(ownerToken, "get_order", { number: 1002 });
    expect(o.number).toBe(1002);
    expect(o.courier.name).toBe("Toters");
    expect(o.subtotal).toEqual({ minor: 4500, text: "$45.00" });
    expect(o.items[0].unitPrice).toEqual({ minor: 4500, text: "$45.00" });
    expect(o.nextStatuses).toEqual(expect.arrayContaining(["DELIVERED"]));
    expect(o).not.toHaveProperty("publicToken");
    expect(o).not.toHaveProperty("trackingUrl");
  });

  it("says an order number that does not exist is not found", async () => {
    const res = await callTool(ownerToken, "get_order", { number: 9999 });
    expect(res).toEqual({ ok: false, error: "Order not found." });
  });

  it("lets staff read orders", async () => {
    const d = await data(staffToken, "list_orders");
    expect(d.orders).toHaveLength(4);
  });

  it("shows a delivery member only the orders assigned to them", async () => {
    const mine = await data(driverToken, "my_deliveries");
    expect(mine.orders.map((o: { number: number }) => o.number)).toEqual([1002]);
    expect(mine.orders[0].cashToCollect).toEqual({ minor: 4500, text: "$45.00" });
    const theirs = await data(otherDriverToken, "my_deliveries");
    expect(theirs.orders.map((o: { number: number }) => o.number)).toEqual([1003]);
    const done = await data(driverToken, "my_deliveries", { view: "done" });
    expect(done.orders.map((o: { number: number }) => o.number)).toEqual([1004]);
  });

  it("keeps the full order list and order details from delivery members", async () => {
    expect((await callTool(driverToken, "list_orders")).ok).toBe(false);
    expect((await callTool(driverToken, "get_order", { number: 1003 })).ok).toBe(false);
  });

  it("refuses a shopId or any other unknown field", async () => {
    expect((await callTool(ownerToken, "list_orders", { shopId: "x" })).ok).toBe(false);
    expect((await callTool(ownerToken, "get_order", { number: 1001, includePhone: true })).ok).toBe(false);
  });
});
