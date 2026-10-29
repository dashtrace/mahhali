import { beforeAll, describe, expect, it } from "vitest";
import { GET as auditLog } from "@/app/api/admin/audit-log/route";
import { GET as listShops } from "@/app/api/admin/shops/route";
import { GET as getShop } from "@/app/api/admin/shops/[id]/route";
import { GET as shopOrders } from "@/app/api/admin/shops/[id]/orders/route";
import { POST as suspend } from "@/app/api/admin/shops/[id]/suspend/route";
import { GET as me } from "@/app/api/me/route";
import { GET as catalogue } from "@/app/api/public/shops/[slug]/catalogue/route";
import { prisma } from "@/server/db";
import { seedAdmin, seedOrder, seedVariant } from "./fixtures";
import { addMember, call, resetDb, signUpOwner } from "./helpers";

describe("platform admin", () => {
  let admin: Awaited<ReturnType<typeof seedAdmin>>;
  let shopA: Awaited<ReturnType<typeof signUpOwner>>;
  let shopB: Awaited<ReturnType<typeof signUpOwner>>;
  const orderIds: string[] = [];

  beforeAll(async () => {
    await resetDb();
    admin = await seedAdmin();
    shopA = await signUpOwner({ shopSlug: "cedar-threads" });
    shopB = await signUpOwner({ shopSlug: "beirut-bags" });
    await addMember(shopA.shop.id, "staff");
    const { variant } = await seedVariant(shopA.shop.id, { available: 100 });
    for (let i = 0; i < 52; i += 1) {
      const order = await seedOrder(shopA.shop.id, { variantId: variant.id, createdAt: new Date(Date.UTC(2026, 9, 1, 0, i)) });
      orderIds.push(order.id);
    }
  });

  const asAdmin = () => ({ cookie: admin.cookie });

  it("is closed to shop owners (403) and to anonymous callers (401)", async () => {
    const id = shopA.shop.id;
    expect((await call(listShops, "/api/admin/shops", { cookie: shopA.cookie })).status).toBe(403);
    expect((await call(getShop, `/api/admin/shops/${id}`, { cookie: shopA.cookie }, { id })).status).toBe(403);
    expect((await call(shopOrders, `/api/admin/shops/${id}/orders`, { cookie: shopA.cookie }, { id })).status).toBe(403);
    expect(
      (await call(suspend, `/api/admin/shops/${id}/suspend`, { method: "POST", cookie: shopA.cookie, body: { suspended: true } }, { id })).status,
    ).toBe(403);
    expect((await call(auditLog, "/api/admin/audit-log", { cookie: shopA.cookie })).status).toBe(403);
    expect((await call(listShops, "/api/admin/shops")).status).toBe(401);
    expect(await prisma.shop.count({ where: { suspended: true } })).toBe(0);
  });

  it("lists every shop with counts, and searches by name or slug", async () => {
    const all = await call(listShops, "/api/admin/shops", asAdmin());
    expect(all.status).toBe(200);
    expect(all.body).toHaveLength(2);
    expect(all.body.find((s: { id: string }) => s.id === shopA.shop.id).counts).toEqual({ members: 2, products: 1, orders: 52 });

    const found = await call(listShops, "/api/admin/shops?q=BEIRUT", asAdmin());
    expect(found.body.map((s: { id: string }) => s.id)).toEqual([shopB.shop.id]);
  });

  it("shows one shop with its members, and 404 for an unknown id", async () => {
    const res = await call(getShop, `/api/admin/shops/${shopA.shop.id}`, asAdmin(), { id: shopA.shop.id });
    expect(res.status).toBe(200);
    expect(res.body.members.map((m: { role: string }) => m.role)).toEqual(["owner", "staff"]);
    expect(res.body.members[0].user.email).toBe(shopA.user.email);
    expect((await call(getShop, "/api/admin/shops/nope", asAdmin(), { id: "nope" })).status).toBe(404);
  });

  it("pages through a shop's orders newest first", async () => {
    const id = shopA.shop.id;
    const first = await call(shopOrders, `/api/admin/shops/${id}/orders`, asAdmin(), { id });
    expect(first.status).toBe(200);
    expect(first.body.items).toHaveLength(50);
    expect(first.body.items[0].id).toBe(orderIds[51]);
    expect(first.body.nextCursor).toBe(orderIds[2]);

    const next = await call(shopOrders, `/api/admin/shops/${id}/orders?cursor=${first.body.nextCursor}`, asAdmin(), { id });
    expect(next.body.items.map((o: { id: string }) => o.id)).toEqual([orderIds[1], orderIds[0]]);
    expect(next.body.nextCursor).toBeNull();

    expect((await call(shopOrders, "/api/admin/shops/nope/orders", asAdmin(), { id: "nope" })).status).toBe(404);
  });

  it("suspends a shop: catalogue 404, members 403; restoring brings it back", async () => {
    const id = shopB.shop.id;
    const slug = shopB.shop.slug;
    const off = await call(suspend, `/api/admin/shops/${id}/suspend`, { method: "POST", cookie: admin.cookie, body: { suspended: true } }, { id });
    expect(off.body).toEqual({ id, suspended: true });
    expect((await call(catalogue, `/api/public/shops/${slug}/catalogue`, {}, { slug })).status).toBe(404);
    expect((await call(me, "/api/me", { cookie: shopB.cookie })).status).toBe(403);

    await call(suspend, `/api/admin/shops/${id}/suspend`, { method: "POST", cookie: admin.cookie, body: { suspended: false } }, { id });
    expect((await call(catalogue, `/api/public/shops/${slug}/catalogue`, {}, { slug })).status).toBe(200);
    expect((await call(me, "/api/me", { cookie: shopB.cookie })).status).toBe(200);
  });

  it("writes an audit row for every admin request and lists them newest first", async () => {
    const res = await call(auditLog, "/api/admin/audit-log", asAdmin());
    expect(res.status).toBe(200);
    const actions = res.body.items.map((r: { action: string }) => r.action);
    expect(actions[0]).toBe("GET /api/admin/audit-log");
    expect(actions).toContain(`POST /api/admin/shops/${shopB.shop.id}/suspend`);
    expect(actions).toContain("GET /api/admin/shops");
    const suspendRow = res.body.items.find((r: { action: string }) => r.action.endsWith("/suspend"));
    expect(suspendRow).toMatchObject({ shopId: shopB.shop.id, admin: { id: admin.userId } });
    // Refused requests are not admin actions.
    expect(await prisma.adminAuditLog.count({ where: { adminUserId: { not: admin.userId } } })).toBe(0);
  });
});
