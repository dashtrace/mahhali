import { beforeAll, describe, expect, it } from "vitest";
import { GET as shopsRoute } from "@/app/api/connect/shop/route";
import { prisma } from "@/server/db";
import { hashOAuthToken } from "@/server/auth/oauth";
import { addMember, call, resetDb, signUpOwner } from "./helpers";
import {
  MCP_RESOURCE,
  authorize,
  chooseShop,
  connect,
  consent,
  oauthQueryOf,
  pkce,
  registerClient,
} from "./oauthHelpers";

beforeAll(resetDb);

const token = (accessToken: string) =>
  prisma.oauthAccessToken.findUniqueOrThrow({ where: { token: hashOAuthToken(accessToken) } });

/** An owner who also belongs to a second shop, as staff. */
async function ownerOfTwoShops() {
  const a = await signUpOwner();
  const b = await signUpOwner();
  await prisma.membership.create({ data: { id: crypto.randomUUID(), shopId: b.shop.id, userId: a.user.id, role: "staff" } });
  return { cookie: a.cookie, userId: a.user.id, shopA: a.shop.id, shopB: b.shop.id };
}

describe("connecting an AI assistant to one shop", () => {
  it("connects a single-shop owner straight to consent, and the token is for that shop", async () => {
    const owner = await signUpOwner();
    const clientId = await registerClient();
    const url = await authorize({ clientId, cookie: owner.cookie, challenge: pkce().challenge, scope: "offline_access orders:read" });
    expect(url.pathname).toBe("/connect/consent");

    const tokens = await connect({ cookie: owner.cookie, scopes: ["orders:read", "finance:read", "catalogue:write"] });
    expect(tokens.access_token).toEqual(expect.any(String));
    expect(tokens.refresh_token).toEqual(expect.any(String));
    expect(tokens.expires_in).toBe(3600);

    const row = await token(tokens.access_token);
    expect(row.referenceId).toBe(owner.shop.id);
    expect(row.userId).toBe(owner.user.id);
    expect(row.resources).toEqual([MCP_RESOURCE]);
    expect([...row.scopes].sort()).toEqual(["catalogue:write", "finance:read", "offline_access", "orders:read"]);
  });

  it("stores tokens hashed, never as issued", async () => {
    const owner = await signUpOwner();
    const tokens = await connect({ cookie: owner.cookie, scopes: ["orders:read"] });
    expect(await prisma.oauthAccessToken.count({ where: { token: tokens.access_token } })).toBe(0);
    expect(await prisma.oauthRefreshToken.count({ where: { token: tokens.refresh_token } })).toBe(0);
  });

  it("makes a member of several shops pick one, and binds the token to the shop picked", async () => {
    const u = await ownerOfTwoShops();
    const clientId = await registerClient();
    const url = await authorize({ clientId, cookie: u.cookie, challenge: pkce().challenge, scope: "orders:read" });
    expect(url.pathname).toBe("/connect/shop");

    const shops = await call(shopsRoute, "/api/connect/shop", { cookie: u.cookie });
    expect(shops.body.map((s: { shopId: string; role: string }) => [s.shopId, s.role])).toEqual([
      [u.shopA, "owner"],
      [u.shopB, "staff"],
    ]);

    const tokens = await connect({ cookie: u.cookie, shopId: u.shopB, scopes: ["orders:read"] });
    expect((await token(tokens.access_token)).referenceId).toBe(u.shopB);
  });

  it("shows the picker again on the next connection, even with an active shop", async () => {
    const u = await ownerOfTwoShops();
    await connect({ cookie: u.cookie, shopId: u.shopA, scopes: ["orders:read"] });
    const url = await authorize({ clientId: await registerClient(), cookie: u.cookie, challenge: pkce().challenge, scope: "orders:read" });
    expect(url.pathname).toBe("/connect/shop");
  });

  it("refuses a shop the user is not a member of", async () => {
    const u = await ownerOfTwoShops();
    const stranger = await signUpOwner();
    const url = await authorize({ clientId: await registerClient(), cookie: u.cookie, challenge: pkce().challenge, scope: "orders:read" });
    const res = await chooseShop(u.cookie, stranger.shop.id, oauthQueryOf(url));
    expect(res.status).toBe(404);
  });

  it("leaves suspended shops out of the picker and refuses them", async () => {
    const u = await ownerOfTwoShops();
    await prisma.shop.update({ where: { id: u.shopB }, data: { suspended: true } });
    const shops = await call(shopsRoute, "/api/connect/shop", { cookie: u.cookie });
    expect(shops.body.map((s: { shopId: string }) => s.shopId)).toEqual([u.shopA]);
    // With one connectable shop left, the picker is skipped and the token is for shop A.
    const tokens = await connect({ cookie: u.cookie, scopes: ["orders:read"] });
    expect((await token(tokens.access_token)).referenceId).toBe(u.shopA);
  });

  it("never grants staff more than their role allows, whatever the request asks for", async () => {
    const owner = await signUpOwner();
    const staff = await addMember(owner.shop.id, "staff");
    const tokens = await connect({
      cookie: staff.cookie,
      scopes: ["orders:read", "catalogue:read", "finance:read", "catalogue:write"],
    });
    const row = await token(tokens.access_token);
    expect([...row.scopes].sort()).toEqual(["catalogue:read", "offline_access", "orders:read"]);
  });

  it("narrows a consent that names no scopes to what the role allows", async () => {
    const owner = await signUpOwner();
    const staff = await addMember(owner.shop.id, "staff");
    const clientId = await registerClient();
    const url = await authorize({ clientId, cookie: staff.cookie, challenge: pkce().challenge, scope: "orders:read finance:read catalogue:write" });
    const res = await consent(staff.cookie, { accept: true, oauthQuery: oauthQueryOf(url) });
    expect(res.status).toBe(200);
    const consentRow = await prisma.oauthConsent.findFirstOrThrow({ where: { clientId } });
    expect(consentRow.scopes).toEqual(["orders:read"]);
  });

  it("gives a delivery member orders:read only", async () => {
    const owner = await signUpOwner();
    const courier = await prisma.courier.create({ data: { shopId: owner.shop.id, name: "Rami", type: "INDIVIDUAL" } });
    const driver = await addMember(owner.shop.id, "delivery", courier.id);
    const tokens = await connect({ cookie: driver.cookie, scopes: ["orders:read", "catalogue:read", "finance:read"] });
    expect([...(await token(tokens.access_token)).scopes].sort()).toEqual(["offline_access", "orders:read"]);
  });

  it("grants only scopes the assistant asked for, even if the user ticks more", async () => {
    const owner = await signUpOwner();
    const clientId = await registerClient();
    const url = await authorize({ clientId, cookie: owner.cookie, challenge: pkce().challenge, scope: "orders:read" });
    const res = await consent(owner.cookie, {
      accept: true,
      scopes: ["orders:read", "finance:read"],
      oauthQuery: oauthQueryOf(url),
    });
    expect(res.status).toBe(200);
    const consentRow = await prisma.oauthConsent.findFirstOrThrow({ where: { clientId } });
    expect(consentRow.scopes).toEqual(["orders:read"]);
    expect(consentRow.referenceId).toBe(owner.shop.id);
  });

  it("refuses an approval with no permissions left", async () => {
    const owner = await signUpOwner();
    const staff = await addMember(owner.shop.id, "staff");
    const url = await authorize({ clientId: await registerClient(), cookie: staff.cookie, challenge: pkce().challenge, scope: "finance:read" });
    const res = await consent(staff.cookie, { accept: true, scopes: ["finance:read"], oauthQuery: oauthQueryOf(url) });
    expect(res.status).toBe(400);
  });

  it("sends the assistant an access_denied error when the user says no", async () => {
    const owner = await signUpOwner();
    const url = await authorize({ clientId: await registerClient(), cookie: owner.cookie, challenge: pkce().challenge, scope: "orders:read" });
    const res = await consent(owner.cookie, { accept: false, oauthQuery: oauthQueryOf(url) });
    expect(res.status).toBe(200);
    const back = new URL(res.body.url);
    expect(back.origin + back.pathname).toBe("https://claude.ai/api/mcp/auth_callback");
    expect(back.searchParams.get("error")).toBe("access_denied");
    expect(back.searchParams.get("code")).toBeNull();
  });

  it("rejects a tampered connection link", async () => {
    const owner = await signUpOwner();
    const url = await authorize({ clientId: await registerClient(), cookie: owner.cookie, challenge: pkce().challenge, scope: "orders:read" });
    const tampered = oauthQueryOf(url).replace("scope=orders%3Aread", "scope=finance%3Aread");
    const res = await consent(owner.cookie, { accept: true, scopes: ["finance:read"], oauthQuery: tampered });
    expect(res.status).toBe(400);
  });

  it("requires a signed-in user for the connect routes", async () => {
    const res = await call(shopsRoute, "/api/connect/shop");
    expect(res.status).toBe(401);
  });

  it("refuses a token exchange without the PKCE verifier", async () => {
    const owner = await signUpOwner();
    const clientId = await registerClient();
    const { challenge } = pkce();
    const url = await authorize({ clientId, cookie: owner.cookie, challenge, scope: "orders:read" });
    const res = await consent(owner.cookie, { accept: true, scopes: ["orders:read"], oauthQuery: oauthQueryOf(url) });
    const code = new URL(res.body.url).searchParams.get("code")!;
    const { exchangeCode } = await import("./oauthHelpers");
    const wrong = await exchangeCode(clientId, code, pkce().verifier);
    expect(wrong.status).toBe(400);
  });
});
