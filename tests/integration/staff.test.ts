import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { GET as me } from "@/app/api/me/route";
import { GET as listStaff } from "@/app/api/staff/route";
import { DELETE as removeMember, PATCH as patchMember } from "@/app/api/staff/[id]/route";
import { POST as createInvite } from "@/app/api/staff/invites/route";
import { DELETE as revokeInvite } from "@/app/api/staff/invites/[id]/route";
import { prisma } from "@/server/db";
import { seedCourier } from "./fixtures";
import { addMember, call, resetDb, signUpOwner } from "./helpers";

beforeAll(resetDb);
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

type Owner = Awaited<ReturnType<typeof signUpOwner>>;

const inviteAs = (cookie: string, body: Record<string, unknown>) =>
  call(createInvite, "/api/staff/invites", { method: "POST", cookie, body });
const patchAs = (cookie: string, id: string, body: Record<string, unknown>) =>
  call(patchMember, `/api/staff/${id}`, { method: "PATCH", cookie, body }, { id });
const removeAs = (cookie: string, id: string) => call(removeMember, `/api/staff/${id}`, { method: "DELETE", cookie }, { id });
const membershipOf = (shopId: string, userId: string) =>
  prisma.membership.findFirstOrThrow({ where: { shopId, userId } });

describe("staff management", () => {
  it("lists members with their courier and pending invitations", async () => {
    const owner = await signUpOwner();
    const courier = await seedCourier(owner.shop.id);
    await addMember(owner.shop.id, "delivery", courier.id);
    await inviteAs(owner.cookie, { email: "Pending.Person@Example.com", role: "staff" });

    const res = await call(listStaff, "/api/staff", { cookie: owner.cookie });
    expect(res.status).toBe(200);
    expect(res.body.members.map((m: { role: string }) => m.role)).toEqual(["owner", "delivery"]);
    expect(res.body.members[1].courier).toEqual({ id: courier.id, name: courier.name });
    expect(res.body.invitations).toEqual([expect.objectContaining({ email: "pending.person@example.com", role: "staff" })]);
  });

  it("re-inviting the same email replaces the pending invite", async () => {
    const owner = await signUpOwner();
    const first = await inviteAs(owner.cookie, { email: "twice@example.com", role: "staff" });
    const second = await inviteAs(owner.cookie, { email: "twice@example.com", role: "manager" });
    expect(second.status).toBe(201);
    expect(second.body.emailSent).toBe(true);
    const pending = await prisma.invitation.findMany({ where: { shopId: owner.shop.id } });
    expect(pending).toEqual([expect.objectContaining({ id: second.body.invitation.id, role: "manager" })]);
    expect(pending[0].id).not.toBe(first.body.invitation.id);
  });

  it("refuses to invite an existing member (409 ALREADY_MEMBER)", async () => {
    const owner = await signUpOwner();
    const res = await inviteAs(owner.cookie, { email: owner.user.email, role: "staff" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("ALREADY_MEMBER");
  });

  it("needs one of the shop's own couriers for a delivery invite", async () => {
    const owner = await signUpOwner();
    const other = await signUpOwner();
    const foreign = await seedCourier(other.shop.id);
    const missing = await inviteAs(owner.cookie, { email: "rider@example.com", role: "delivery" });
    expect(missing.status).toBe(422);
    expect(missing.body.error.code).toBe("COURIER_REQUIRED");
    expect((await inviteAs(owner.cookie, { email: "rider@example.com", role: "delivery", courierId: foreign.id })).status).toBe(404);
  });

  it("never grants the owner role (400)", async () => {
    const owner = await signUpOwner();
    expect((await inviteAs(owner.cookie, { email: "boss@example.com", role: "owner" })).status).toBe(400);
  });

  it("still creates the invite when the email fails, and says so", async () => {
    const owner = await signUpOwner();
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await inviteAs(owner.cookie, { email: "offline@example.com", role: "staff" });
    expect(res.status).toBe(201);
    expect(res.body.emailSent).toBe(false);
    expect(res.body.link).toContain("/invite/");
    expect(await prisma.invitation.count({ where: { shopId: owner.shop.id } })).toBe(1);
  });

  it("revokes a pending invite", async () => {
    const owner = await signUpOwner();
    const { body } = await inviteAs(owner.cookie, { email: "revoke@example.com", role: "staff" });
    const id = body.invitation.id;
    expect((await call(revokeInvite, `/api/staff/invites/${id}`, { method: "DELETE", cookie: owner.cookie }, { id })).status).toBe(204);
    expect((await call(revokeInvite, `/api/staff/invites/${id}`, { method: "DELETE", cookie: owner.cookie }, { id })).status).toBe(404);
  });

  it("changes a member's role and courier link", async () => {
    const owner = await signUpOwner();
    const courier = await seedCourier(owner.shop.id);
    const staff = await addMember(owner.shop.id, "staff");
    const member = await membershipOf(owner.shop.id, staff.userId);

    const promoted = await patchAs(owner.cookie, member.id, { role: "manager" });
    expect(promoted.status).toBe(200);
    expect(promoted.body).toMatchObject({ role: "manager", courier: null });
    expect((await call(me, "/api/me", { cookie: staff.cookie })).body.role).toBe("manager");

    const noCourier = await patchAs(owner.cookie, member.id, { role: "delivery" });
    expect(noCourier.status).toBe(422);
    expect(noCourier.body.error.code).toBe("COURIER_REQUIRED");

    const rider = await patchAs(owner.cookie, member.id, { role: "delivery", courierId: courier.id });
    expect(rider.body).toMatchObject({ role: "delivery", courier: { id: courier.id } });

    // Back to staff drops the courier link.
    const back = await patchAs(owner.cookie, member.id, { role: "staff" });
    expect(back.body).toMatchObject({ role: "staff", courier: null });
  });

  it("protects the owner: no role change, no removal, no owner role granted", async () => {
    const owner = await signUpOwner();
    const ownerMembership = await membershipOf(owner.shop.id, owner.user.id);
    const staff = await addMember(owner.shop.id, "staff");
    const staffMembership = await membershipOf(owner.shop.id, staff.userId);

    const demote = await patchAs(owner.cookie, ownerMembership.id, { role: "manager" });
    expect(demote.status).toBe(422);
    expect(demote.body.error.code).toBe("OWNER_PROTECTED");
    expect((await removeAs(owner.cookie, ownerMembership.id)).status).toBe(422);
    expect((await patchAs(owner.cookie, staffMembership.id, { role: "owner" })).status).toBe(400);
    expect((await membershipOf(owner.shop.id, owner.user.id)).role).toBe("owner");
  });

  it("removing a member ends their access to the shop", async () => {
    const owner = await signUpOwner();
    const staff = await addMember(owner.shop.id, "staff");
    const member = await membershipOf(owner.shop.id, staff.userId);
    expect((await call(me, "/api/me", { cookie: staff.cookie })).status).toBe(200);

    expect((await removeAs(owner.cookie, member.id)).status).toBe(204);
    expect((await call(me, "/api/me", { cookie: staff.cookie })).status).toBe(403);
    expect((await removeAs(owner.cookie, member.id)).status).toBe(404);
  });

  for (const role of ["manager", "staff", "delivery"]) {
    it(`${role} gets 403 on every staff route`, async () => {
      const owner = await signUpOwner();
      const courier = await seedCourier(owner.shop.id);
      const actor = await addMember(owner.shop.id, role, role === "delivery" ? courier.id : undefined);
      const target = await membershipOf(owner.shop.id, owner.user.id);

      expect((await call(listStaff, "/api/staff", { cookie: actor.cookie })).status).toBe(403);
      expect((await inviteAs(actor.cookie, { email: "x@example.com", role: "staff" })).status).toBe(403);
      expect((await patchAs(actor.cookie, target.id, { role: "staff" })).status).toBe(403);
      expect((await removeAs(actor.cookie, target.id)).status).toBe(403);
      expect((await call(revokeInvite, "/api/staff/invites/abc", { method: "DELETE", cookie: actor.cookie }, { id: "abc" })).status).toBe(403);
    });
  }
});

describe("staff tenant isolation", () => {
  let shopA: Owner;
  let shopB: Owner;
  let memberB: string;
  let inviteB: string;

  beforeAll(async () => {
    shopA = await signUpOwner();
    shopB = await signUpOwner();
    const staffB = await addMember(shopB.shop.id, "staff");
    memberB = (await membershipOf(shopB.shop.id, staffB.userId)).id;
    inviteB = (await inviteAs(shopB.cookie, { email: "secret.hire@example.com", role: "manager" })).body.invitation.id;
  });

  it("shop A's owner does not see shop B's members or invites", async () => {
    const res = await call(listStaff, "/api/staff", { cookie: shopA.cookie });
    expect(res.body.members).toHaveLength(1);
    expect(res.body.invitations).toEqual([]);
    expect(JSON.stringify(res.body)).not.toContain("secret.hire");
  });

  it("shop A's owner gets 404 changing or removing shop B's member", async () => {
    expect((await patchAs(shopA.cookie, memberB, { role: "manager" })).status).toBe(404);
    expect((await removeAs(shopA.cookie, memberB)).status).toBe(404);
    expect((await prisma.membership.findUniqueOrThrow({ where: { id: memberB } })).role).toBe("staff");
  });

  it("shop A's owner gets 404 revoking shop B's invite", async () => {
    const res = await call(revokeInvite, `/api/staff/invites/${inviteB}`, { method: "DELETE", cookie: shopA.cookie }, { id: inviteB });
    expect(res.status).toBe(404);
    expect(await prisma.invitation.count({ where: { id: inviteB } })).toBe(1);
  });

  it("shop A's courier cannot be given to shop B's delivery user", async () => {
    const courierA = await seedCourier(shopA.shop.id);
    expect((await patchAs(shopB.cookie, memberB, { role: "delivery", courierId: courierA.id })).status).toBe(404);
  });
});
