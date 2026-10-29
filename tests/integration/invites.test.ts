import { beforeAll, describe, expect, it } from "vitest";
import { GET as me } from "@/app/api/me/route";
import { POST as switchShop } from "@/app/api/me/active-shop/route";
import { GET as myShops } from "@/app/api/me/shops/route";
import { GET as showInvite } from "@/app/api/public/invites/[token]/route";
import { POST as acceptInvite } from "@/app/api/public/invites/[token]/accept/route";
import { POST as createInvite } from "@/app/api/staff/invites/route";
import { DELETE as revokeInvite } from "@/app/api/staff/invites/[id]/route";
import { prisma } from "@/server/db";
import { outbox } from "@/server/mail/mailer";
import { seedCourier } from "./fixtures";
import { call, cookieFrom, resetDb, signUpOwner } from "./helpers";

beforeAll(resetDb);

const password = "correct-horse-battery";

/** Invites through the API and returns the token from the emailed link. */
async function invite(owner: { cookie: string }, body: Record<string, unknown>) {
  const res = await call(createInvite, "/api/staff/invites", { method: "POST", cookie: owner.cookie, body });
  if (res.status !== 201) throw new Error(`invite failed: ${res.status} ${JSON.stringify(res.body)}`);
  const token = res.body.link.split("/invite/")[1] as string;
  return { token, id: res.body.invitation.id as string };
}

const show = (token: string) => call(showInvite, `/api/public/invites/${token}`, {}, { token });
const accept = (token: string, body: Record<string, unknown>) =>
  call(acceptInvite, `/api/public/invites/${token}/accept`, { method: "POST", body }, { token });

describe("accepting an invite", () => {
  it("creates the account, adds the member with the invited role and signs them in to that shop", async () => {
    const owner = await signUpOwner();
    const email = `new.${Date.now()}@example.com`;
    const { token, id } = await invite(owner, { email, role: "manager" });

    expect(outbox.at(-1)?.text).toContain(`/invite/${token}`);
    // Only the hash of the token is stored, so listing invitations never reveals a usable link.
    expect(id).not.toBe(token);
    expect(await prisma.invitation.count({ where: { id: token } })).toBe(0);

    const preview = await show(token);
    expect(preview.status).toBe(200);
    expect(preview.body).toMatchObject({ shopName: owner.shop.name, email, role: "manager", status: "pending", hasAccount: false });

    const res = await accept(token, { name: "Rana Khoury", password });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ role: "manager", shop: { id: owner.shop.id }, user: { email, name: "Rana Khoury" } });

    const who = await call(me, "/api/me", { cookie: cookieFrom(res.headers) });
    expect(who.status).toBe(200);
    expect(who.body).toMatchObject({ shopId: owner.shop.id, role: "manager" });
    expect(await prisma.invitation.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: "accepted" });
  });

  it("works once: a second use and the preview both answer 410 INVITE_USED", async () => {
    const owner = await signUpOwner();
    const { token } = await invite(owner, { email: `once.${Date.now()}@example.com`, role: "staff" });
    expect((await accept(token, { name: "Once", password })).status).toBe(200);

    const again = await accept(token, { name: "Twice", password });
    expect(again.status).toBe(410);
    expect(again.body.error.code).toBe("INVITE_USED");
    expect((await show(token)).body.error.code).toBe("INVITE_USED");
  });

  it("refuses an expired invite with 410 INVITE_EXPIRED", async () => {
    const owner = await signUpOwner();
    const { token, id } = await invite(owner, { email: `late.${Date.now()}@example.com`, role: "staff" });
    await prisma.invitation.update({ where: { id }, data: { expiresAt: new Date(Date.now() - 1000) } });

    expect((await show(token)).body.error.code).toBe("INVITE_EXPIRED");
    const res = await accept(token, { name: "Late", password });
    expect(res.status).toBe(410);
    expect(res.body.error.code).toBe("INVITE_EXPIRED");
    expect(await prisma.membership.count({ where: { shopId: owner.shop.id } })).toBe(1);
  });

  it("answers 404 for an unknown or revoked link and 400 for a malformed one", async () => {
    const owner = await signUpOwner();
    expect((await show("x".repeat(32))).status).toBe(404);
    expect((await show("not a token")).status).toBe(400);

    const { token, id } = await invite(owner, { email: `gone.${Date.now()}@example.com`, role: "staff" });
    const revoked = await call(revokeInvite, `/api/staff/invites/${id}`, { method: "DELETE", cookie: owner.cookie }, { id });
    expect(revoked.status).toBe(204);
    expect((await accept(token, { name: "Gone", password })).status).toBe(404);
  });

  it("a stored invitation id is not a usable link", async () => {
    const owner = await signUpOwner();
    await invite(owner, { email: `boss.${Date.now()}@example.com`, role: "manager" });

    // Better Auth's /organization/list-invitations shows these rows to every member, staff included.
    const [stored] = await prisma.invitation.findMany({ where: { shopId: owner.shop.id } });
    expect((await accept(stored.id, { name: "Imposter", password })).status).toBe(404);
    expect(await prisma.membership.count({ where: { shopId: owner.shop.id } })).toBe(1);
  });

  it("links a delivery user to the invited courier", async () => {
    const owner = await signUpOwner();
    const courier = await seedCourier(owner.shop.id, { name: "Wakilni" });
    const email = `rider.${Date.now()}@example.com`;
    const { token } = await invite(owner, { email, role: "delivery", courierId: courier.id });
    const res = await accept(token, { name: "Rider", password });
    expect(res.status).toBe(200);

    const who = await call(me, "/api/me", { cookie: cookieFrom(res.headers) });
    expect(who.body).toMatchObject({ role: "delivery", courierId: courier.id });
  });

  describe("by someone who already has an account", () => {
    let shopA: Awaited<ReturnType<typeof signUpOwner>>;
    let shopB: Awaited<ReturnType<typeof signUpOwner>>;
    let token: string;

    beforeAll(async () => {
      shopA = await signUpOwner();
      shopB = await signUpOwner();
      // Shop B's owner is invited to help at shop A.
      ({ token } = await invite(shopA, { email: shopB.user.email, role: "staff" }));
    });

    it("tells the page the account exists", async () => {
      expect((await show(token)).body.hasAccount).toBe(true);
    });

    it("refuses the wrong password with 401 and adds nobody", async () => {
      const res = await accept(token, { name: "ignored", password: "not-the-password" });
      expect(res.status).toBe(401);
      expect(await prisma.membership.count({ where: { shopId: shopA.shop.id, userId: shopB.user.id } })).toBe(0);
    });

    it("joins with the existing password; two racing accepts create one membership", async () => {
      const [first, second] = await Promise.all([
        accept(token, { name: "ignored", password }),
        accept(token, { name: "ignored", password }),
      ]);
      expect([first.status, second.status].sort()).toEqual([200, 410]);
      expect(await prisma.membership.count({ where: { shopId: shopA.shop.id, userId: shopB.user.id } })).toBe(1);

      const winner = first.status === 200 ? first : second;
      const who = await call(me, "/api/me", { cookie: cookieFrom(winner.headers) });
      expect(who.body).toMatchObject({ shopId: shopA.shop.id, role: "staff" });
      // The name of an existing account is not changed by the invite.
      expect(winner.body.user.name).toBe(shopB.user.name);
    });

    it("lists both shops and switches between them", async () => {
      // The owner's original session still acts in shop B.
      const shops = await call(myShops, "/api/me/shops", { cookie: shopB.cookie });
      expect(shops.status).toBe(200);
      expect(shops.body).toEqual([
        expect.objectContaining({ shopId: shopB.shop.id, role: "owner", active: true }),
        expect.objectContaining({ shopId: shopA.shop.id, role: "staff", active: false }),
      ]);

      const switched = await call(switchShop, "/api/me/active-shop", {
        method: "POST",
        cookie: shopB.cookie,
        body: { shopId: shopA.shop.id },
      });
      expect(switched.status).toBe(200);
      expect(switched.body).toEqual({ shopId: shopA.shop.id, role: "staff" });
      expect((await call(me, "/api/me", { cookie: shopB.cookie })).body).toMatchObject({ shopId: shopA.shop.id, role: "staff" });

      await call(switchShop, "/api/me/active-shop", { method: "POST", cookie: shopB.cookie, body: { shopId: shopB.shop.id } });
      expect((await call(me, "/api/me", { cookie: shopB.cookie })).body).toMatchObject({ shopId: shopB.shop.id, role: "owner" });
    });

    it("cannot switch to a shop the user does not belong to (404)", async () => {
      const other = await signUpOwner();
      const res = await call(switchShop, "/api/me/active-shop", {
        method: "POST",
        cookie: shopB.cookie,
        body: { shopId: other.shop.id },
      });
      expect(res.status).toBe(404);
      expect((await call(me, "/api/me", { cookie: shopB.cookie })).body.shopId).toBe(shopB.shop.id);
    });
  });
});
