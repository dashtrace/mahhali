import { beforeAll, describe, expect, it } from "vitest";
import { GET as metricsRoute } from "@/app/api/metrics/route";
import { GET as reconciliationRoute } from "@/app/api/reconciliation/route";
import { POST as createRemittance } from "@/app/api/remittances/route";
import { seedCourier, seedOrder, seedVariant } from "./fixtures";
import { addMember, call, resetDb, signUpOwner } from "./helpers";
import { callTool } from "./mcpHelpers";
import { connect } from "./oauthHelpers";

const today = new Date().toISOString().slice(0, 10);

let owner: Awaited<ReturnType<typeof signUpOwner>>;
let ownerToken: string;
let managerToken: string;
let staffToken: string;
let tootersId: string;
let paidOrderNumber: number;

beforeAll(async () => {
  await resetDb();
  owner = await signUpOwner();
  const shopId = owner.shop.id;
  const { variant: oud } = await seedVariant(shopId, { name: "Oud perfume", options: [], optionValues: [], priceMinor: 4500n, available: 50 });
  const { variant: shirt } = await seedVariant(shopId, { name: "Linen shirt", options: [], optionValues: [], priceMinor: 2000n, available: 50 });
  const toters = await seedCourier(shopId, { name: "Toters" });
  const rami = await seedCourier(shopId, { name: "Rami", type: "INDIVIDUAL" });
  tootersId = toters.id;

  // The courier reported collecting $85 at the door for this $90 order, then handed over the $85.
  const paid = await seedOrder(shopId, { variantId: oud.id, qty: 2, status: "DELIVERED", courierId: toters.id, reportedUsdCents: 8500n });
  paidOrderNumber = paid.number;
  await seedOrder(shopId, { variantId: oud.id, status: "DELIVERED", courierId: toters.id, reportedUsdCents: 4500n });
  await seedOrder(shopId, { variantId: shirt.id, status: "DELIVERED", courierId: rami.id });
  await seedOrder(shopId, { variantId: shirt.id });

  // Toters hands over the $85 it reported: $5 short of the $90 due.
  const remit = await call(createRemittance, "/api/remittances", {
    method: "POST",
    cookie: owner.cookie,
    body: { courierId: toters.id, receivedAt: today, amountUsd: "85", lines: [{ orderId: paid.id, collectedUsd: "85" }] },
  });
  if (remit.status !== 201) throw new Error(`remittance failed: ${remit.status} ${JSON.stringify(remit.body)}`);

  ownerToken = (await connect({ cookie: owner.cookie, scopes: ["finance:read"] })).access_token;
  const manager = await addMember(shopId, "manager");
  managerToken = (await connect({ cookie: manager.cookie, scopes: ["finance:read"] })).access_token;
  const staff = await addMember(shopId, "staff");
  staffToken = (await connect({ cookie: staff.cookie, scopes: ["orders:read", "finance:read"] })).access_token;
});

async function data(token: string, tool: string, args: Record<string, unknown> = {}) {
  const res = await callTool(token, tool, args);
  if (!res.ok) throw new Error(`${tool} refused: ${res.error}`);
  return res.data;
}

describe("finance tools", () => {
  it("reports sales: orders, delivered revenue and best sellers", async () => {
    const d = await data(ownerToken, "sales_metrics");
    expect(d.ordersCreated).toBe(4);
    expect(d.ordersByStatus).toMatchObject({ DELIVERED: 3, NEW: 1 });
    expect(d.delivered).toEqual({ orders: 3, revenue: { minor: 15500, text: "$155.00" } });
    expect(d.topItems).toEqual([
      { name: "Oud perfume", qty: 3 },
      { name: "Linen shirt", qty: 1 },
    ]);
  });

  it("matches the dashboard's own metrics", async () => {
    const dashboard = await call(metricsRoute, "/api/metrics", { cookie: owner.cookie });
    const d = await data(ownerToken, "sales_metrics");
    expect(d.ordersCreated).toBe(dashboard.body.ordersCreated);
    expect(d.ordersByStatus).toEqual(dashboard.body.ordersByStatus);
    expect(d.codGaps.count).toBe(dashboard.body.codGaps.count);
  });

  it("reconciles cash per courier the way the dashboard does", async () => {
    const dashboard = await call(reconciliationRoute, "/api/reconciliation", { cookie: owner.cookie });
    const d = await data(ownerToken, "cod_reconciliation");
    expect(d.totals.due.minor).toBe(dashboard.body.totals.expectedMinor);
    expect(d.totals.receivedInShopCurrency.minor).toBe(dashboard.body.totals.receivedMinor);
    expect(d.totals.gaps.count).toBe(dashboard.body.totals.gaps.count);

    const toters = d.couriers.find((c: { courier: { name: string } }) => c.courier.name === "Toters");
    expect(toters.received.usd).toEqual({ minor: 8500, text: "$85.00" });
    expect(toters.shortOrOver).toEqual([
      { order: paidOrderNumber, due: { minor: 9000, text: "$90.00" }, paid: { minor: 8500, text: "$85.00" }, difference: { minor: -500, text: "-$5.00" } },
    ]);
    expect(toters.unpaid).toHaveLength(1);
  });

  it("filters reconciliation by courier", async () => {
    const d = await data(ownerToken, "cod_reconciliation", { courierId: tootersId });
    expect(d.couriers.map((c: { courier: { name: string } }) => c.courier.name)).toEqual(["Toters"]);
  });

  it("lists the cash each courier still owes", async () => {
    const d = await data(ownerToken, "unsettled_cash");
    const owing = Object.fromEntries(d.couriers.map((c: { courier: { name: string }; orderCount: number; due: unknown }) => [c.courier.name, [c.orderCount, c.due]]));
    expect(owing).toEqual({
      Toters: [1, [{ minor: 4500, text: "$45.00" }]],
      Rami: [1, [{ minor: 2000, text: "$20.00" }]],
    });
    const toters = d.couriers.find((c: { courier: { name: string } }) => c.courier.name === "Toters");
    expect(toters.orders[0].reportedAtDoor.usd).toEqual({ minor: 4500, text: "$45.00" });
    expect(JSON.stringify(d)).not.toContain("Maya");
  });

  it("says a courier from another shop is not found", async () => {
    const stranger = await signUpOwner();
    const theirs = await seedCourier(stranger.shop.id, { name: "Their courier" });
    expect(await callTool(ownerToken, "unsettled_cash", { courierId: theirs.id })).toEqual({ ok: false, error: "Courier not found." });
    expect((await callTool(ownerToken, "cod_reconciliation", { courierId: theirs.id })).ok).toBe(false);
  });

  it("gives managers the same view", async () => {
    expect((await data(managerToken, "sales_metrics")).ordersCreated).toBe(4);
  });

  it("keeps finance from staff, even if they asked for the scope", async () => {
    for (const tool of ["sales_metrics", "cod_reconciliation", "unsettled_cash"]) {
      expect((await callTool(staffToken, tool)).ok, tool).toBe(false);
    }
  });

  it("refuses a date range that ends before it starts", async () => {
    expect((await callTool(ownerToken, "sales_metrics", { from: "2026-11-10", to: "2026-11-01" })).ok).toBe(false);
  });
});
