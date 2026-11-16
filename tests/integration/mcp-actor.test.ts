import { beforeAll, describe, expect, it } from "vitest";
import { POST as authPost } from "@/app/api/auth/[...all]/route";
import { hashOAuthToken } from "@/server/auth/oauth";
import { prisma } from "@/server/db";
import { AppError } from "@/server/http/errors";
import { resolveMcpActor } from "@/server/http/session";
import { addMember, resetDb, signUpOwner } from "./helpers";
import { connect } from "./oauthHelpers";

beforeAll(resetDb);

const bearer = (token: string) => new Headers({ authorization: `Bearer ${token}` });

async function refusal(token: string): Promise<{ status: number; code: string }> {
  try {
    await resolveMcpActor(bearer(token));
  } catch (error) {
    if (error instanceof AppError) return { status: error.status, code: error.code };
    throw error;
  }
  throw new Error("expected the token to be refused");
}

const row = (token: string) => ({ token: hashOAuthToken(token) });

describe("who an AI assistant acts as on /api/mcp", () => {
  it("resolves a valid token to the member, shop, role and granted scopes", async () => {
    const owner = await signUpOwner();
    const t = await connect({ cookie: owner.cookie, scopes: ["orders:read", "finance:read"] });
    const actor = await resolveMcpActor(bearer(t.access_token));
    expect(actor).toMatchObject({ userId: owner.user.id, shopId: owner.shop.id, role: "owner", courierId: null });
    expect([...actor.scopes].sort()).toEqual(["finance:read", "offline_access", "orders:read"]);
    expect(actor.clientId).toBe(t.clientId);
  });

  it("carries a delivery member's courier", async () => {
    const owner = await signUpOwner();
    const courier = await prisma.courier.create({ data: { shopId: owner.shop.id, name: "Rami", type: "INDIVIDUAL" } });
    const driver = await addMember(owner.shop.id, "delivery", courier.id);
    const t = await connect({ cookie: driver.cookie, scopes: ["orders:read"] });
    expect(await resolveMcpActor(bearer(t.access_token))).toMatchObject({ role: "delivery", courierId: courier.id });
  });

  it("asks for a token when there is none or it is unknown", async () => {
    await expect(resolveMcpActor(new Headers())).rejects.toMatchObject({ status: 401, code: "INVALID_TOKEN" });
    await expect(resolveMcpActor(new Headers({ authorization: "Basic abc" }))).rejects.toMatchObject({ status: 401 });
    expect(await refusal("not-a-real-token")).toEqual({ status: 401, code: "INVALID_TOKEN" });
  });

  it("refuses an expired token", async () => {
    const owner = await signUpOwner();
    const t = await connect({ cookie: owner.cookie, scopes: ["orders:read"] });
    await prisma.oauthAccessToken.update({ where: row(t.access_token), data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await refusal(t.access_token)).toEqual({ status: 401, code: "INVALID_TOKEN" });
  });

  it("refuses a token the assistant revoked through the revocation endpoint", async () => {
    const owner = await signUpOwner();
    const t = await connect({ cookie: owner.cookie, scopes: ["orders:read"] });
    const res = await authPost(
      new Request("http://localhost:3000/api/auth/oauth2/revoke", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", origin: "http://localhost:3000" },
        body: new URLSearchParams({ token: t.access_token, token_type_hint: "access_token", client_id: t.clientId }),
      }),
    );
    expect(res.status).toBe(200);
    expect(await refusal(t.access_token)).toEqual({ status: 401, code: "INVALID_TOKEN" });
  });

  it("refuses a token issued for another resource", async () => {
    const owner = await signUpOwner();
    const t = await connect({ cookie: owner.cookie, scopes: ["orders:read"] });
    await prisma.oauthAccessToken.update({ where: row(t.access_token), data: { resources: ["https://elsewhere.example/api"] } });
    expect(await refusal(t.access_token)).toEqual({ status: 401, code: "INVALID_TOKEN" });
  });

  it("refuses a token whose app was disabled", async () => {
    const owner = await signUpOwner();
    const t = await connect({ cookie: owner.cookie, scopes: ["orders:read"] });
    await prisma.oauthClient.update({ where: { clientId: t.clientId }, data: { disabled: true } });
    expect(await refusal(t.access_token)).toEqual({ status: 401, code: "INVALID_TOKEN" });
  });

  it("refuses a banned user's token", async () => {
    const owner = await signUpOwner();
    const t = await connect({ cookie: owner.cookie, scopes: ["orders:read"] });
    await prisma.user.update({ where: { id: owner.user.id }, data: { banned: true } });
    expect(await refusal(t.access_token)).toEqual({ status: 401, code: "INVALID_TOKEN" });
  });

  it("stops working as soon as the member is removed from the shop", async () => {
    const owner = await signUpOwner();
    const staff = await addMember(owner.shop.id, "staff");
    const t = await connect({ cookie: staff.cookie, scopes: ["orders:read"] });
    await prisma.membership.deleteMany({ where: { userId: staff.userId, shopId: owner.shop.id } });
    expect(await refusal(t.access_token)).toEqual({ status: 403, code: "FORBIDDEN" });
  });

  it("is not fooled by the same user's membership in another shop", async () => {
    const owner = await signUpOwner();
    const other = await signUpOwner();
    const staff = await addMember(owner.shop.id, "staff");
    await prisma.membership.create({ data: { id: crypto.randomUUID(), shopId: other.shop.id, userId: staff.userId, role: "manager" } });
    const t = await connect({ cookie: staff.cookie, shopId: owner.shop.id, scopes: ["orders:read"] });
    await prisma.membership.deleteMany({ where: { userId: staff.userId, shopId: owner.shop.id } });
    expect(await refusal(t.access_token)).toEqual({ status: 403, code: "FORBIDDEN" });
  });

  it("stops working while the shop is suspended", async () => {
    const owner = await signUpOwner();
    const t = await connect({ cookie: owner.cookie, scopes: ["orders:read"] });
    await prisma.shop.update({ where: { id: owner.shop.id }, data: { suspended: true } });
    expect(await refusal(t.access_token)).toEqual({ status: 403, code: "FORBIDDEN" });
  });

  it("applies a role change on the next call", async () => {
    const owner = await signUpOwner();
    const manager = await addMember(owner.shop.id, "manager");
    const t = await connect({ cookie: manager.cookie, scopes: ["orders:read", "finance:read"] });
    expect((await resolveMcpActor(bearer(t.access_token))).role).toBe("manager");
    await prisma.membership.updateMany({ where: { userId: manager.userId }, data: { role: "staff" } });
    expect((await resolveMcpActor(bearer(t.access_token))).role).toBe("staff");
  });
});
