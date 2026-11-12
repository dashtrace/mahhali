import { beforeAll, describe, expect, it } from "vitest";
import { POST as authPost } from "@/app/api/auth/[...all]/route";
import { GET as listRoute } from "@/app/api/connections/route";
import { POST as revokeAllRoute } from "@/app/api/connections/revoke-all/route";
import { POST as revokeRoute } from "@/app/api/connections/revoke/route";
import { DELETE as removeMember } from "@/app/api/staff/[id]/route";
import { prisma } from "@/server/db";
import { addMember, call, resetDb, signUpOwner } from "./helpers";
import { mcp } from "./mcpHelpers";
import { connect } from "./oauthHelpers";

beforeAll(resetDb);

const status = async (token: string) => (await mcp(token, "tools/list")).status;
const list = (cookie: string) => call(listRoute, "/api/connections", { cookie });
const revoke = (cookie: string, body: Record<string, unknown>) => call(revokeRoute, "/api/connections/revoke", { method: "POST", cookie, body });

async function shopWithConnections() {
  const owner = await signUpOwner();
  const staff = await addMember(owner.shop.id, "staff");
  const ownerConn = await connect({ cookie: owner.cookie, scopes: ["orders:read", "finance:read"] });
  const staffConn = await connect({ cookie: staff.cookie, scopes: ["orders:read"] });
  return { owner, staff, ownerConn, staffConn };
}

describe("connected apps", () => {
  it("shows the owner every connection and other members their own", async () => {
    const { owner, staff, ownerConn, staffConn } = await shopWithConnections();
    await mcp(staffConn.access_token, "tools/call", { name: "shop_info", arguments: {} });

    const all = await list(owner.cookie);
    expect(all.status).toBe(200);
    expect(all.body).toHaveLength(2);
    const staffRow = all.body.find((c: { member: { userId: string } }) => c.member.userId === staff.userId);
    expect(staffRow).toMatchObject({ clientId: staffConn.clientId, app: { name: "Claude" }, scopes: ["orders:read"], member: { isYou: false } });
    expect(staffRow.lastUsedAt).not.toBeNull();
    const ownerRow = all.body.find((c: { member: { isYou: boolean } }) => c.member.isYou);
    expect(ownerRow.clientId).toBe(ownerConn.clientId);
    expect(ownerRow.lastUsedAt).toBeNull();

    const own = await list(staff.cookie);
    expect(own.body.map((c: { member: { userId: string } }) => c.member.userId)).toEqual([staff.userId]);
  });

  it("lets a member disconnect their own app, which stops working at once", async () => {
    const { staff, staffConn } = await shopWithConnections();
    expect(await status(staffConn.access_token)).toBe(200);
    expect((await revoke(staff.cookie, { clientId: staffConn.clientId })).status).toBe(200);
    expect(await status(staffConn.access_token)).toBe(401);
    expect((await list(staff.cookie)).body).toEqual([]);
  });

  it("stops a revoked app from getting new tokens with its refresh token", async () => {
    const { staff, staffConn } = await shopWithConnections();
    await revoke(staff.cookie, { clientId: staffConn.clientId });
    const res = await authPost(
      new Request("http://localhost:3000/api/auth/oauth2/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", origin: "http://localhost:3000" },
        body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: staffConn.refresh_token!, client_id: staffConn.clientId }),
      }),
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("does not let a member disconnect someone else's app", async () => {
    const { owner, staff, ownerConn } = await shopWithConnections();
    const res = await revoke(staff.cookie, { clientId: ownerConn.clientId, userId: owner.user.id });
    expect(res.status).toBe(404);
    expect(await status(ownerConn.access_token)).toBe(200);
  });

  it("lets the owner disconnect a member's app", async () => {
    const { owner, staff, staffConn, ownerConn } = await shopWithConnections();
    expect((await revoke(owner.cookie, { clientId: staffConn.clientId, userId: staff.userId })).status).toBe(200);
    expect(await status(staffConn.access_token)).toBe(401);
    expect(await status(ownerConn.access_token)).toBe(200);
  });

  it("lets only the owner disconnect every app at once", async () => {
    const { owner, staff, staffConn, ownerConn } = await shopWithConnections();
    expect((await call(revokeAllRoute, "/api/connections/revoke-all", { method: "POST", cookie: staff.cookie })).status).toBe(403);
    const res = await call(revokeAllRoute, "/api/connections/revoke-all", { method: "POST", cookie: owner.cookie });
    expect(res.body).toEqual({ revoked: 2 });
    expect(await status(staffConn.access_token)).toBe(401);
    expect(await status(ownerConn.access_token)).toBe(401);
  });

  it("leaves the same app connected to another shop alone", async () => {
    const { owner, ownerConn } = await shopWithConnections();
    const other = await signUpOwner();
    await prisma.membership.create({ data: { id: crypto.randomUUID(), shopId: other.shop.id, userId: owner.user.id, role: "manager" } });
    const elsewhere = await connect({ cookie: owner.cookie, shopId: other.shop.id, clientId: ownerConn.clientId, scopes: ["orders:read"] });
    await call(revokeAllRoute, "/api/connections/revoke-all", { method: "POST", cookie: owner.cookie });
    expect(await status(ownerConn.access_token)).toBe(401);
    expect(await status(elsewhere.access_token)).toBe(200);
  });

  it("disconnects a member's apps when the owner removes them from the shop", async () => {
    const { owner, staff, staffConn } = await shopWithConnections();
    const membership = await prisma.membership.findFirstOrThrow({ where: { userId: staff.userId, shopId: owner.shop.id } });
    const res = await call(removeMember, `/api/staff/${membership.id}`, { method: "DELETE", cookie: owner.cookie }, { id: membership.id });
    expect(res.status).toBeLessThan(300);
    expect(await prisma.oauthConsent.count({ where: { userId: staff.userId } })).toBe(0);
    expect(await prisma.oauthAccessToken.count({ where: { userId: staff.userId, revoked: null } })).toBe(0);
    expect(await status(staffConn.access_token)).toBe(401);
  });

  it("says not found for an app that is not connected", async () => {
    const { staff } = await shopWithConnections();
    expect((await revoke(staff.cookie, { clientId: "no-such-client" })).status).toBe(404);
  });
});
