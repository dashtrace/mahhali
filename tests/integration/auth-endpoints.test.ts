import { beforeAll, describe, expect, it } from "vitest";
import { GET as authGet, POST as authPost } from "@/app/api/auth/[...all]/route";
import { prisma } from "@/server/db";
import { addMember, resetDb, signUpOwner } from "./helpers";

beforeAll(resetDb);

async function hit(method: "GET" | "POST", path: string, cookie?: string, body?: unknown) {
  const headers = new Headers({ origin: "http://localhost:3000" });
  if (cookie) headers.set("cookie", cookie);
  if (body !== undefined) headers.set("content-type", "application/json");
  const req = new Request(`http://localhost:3000/api/auth${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return (method === "GET" ? authGet : authPost)(req);
}

// Better Auth's plugins expose endpoints that would skip our policy (role
// changes, invitations, shop deletion, admin tools). Browsers only get sign-in,
// sign-out and the session.
describe("Better Auth endpoints", () => {
  it("lets a member sign in, read the session and sign out", async () => {
    const owner = await signUpOwner();
    const email = (await prisma.user.findUniqueOrThrow({ where: { id: owner.user.id } })).email;
    const signIn = await hit("POST", "/sign-in/email", undefined, { email, password: "correct-horse-battery" });
    expect(signIn.status).toBe(200);
    const session = await hit("GET", "/get-session", owner.cookie);
    expect(session.status).toBe(200);
    expect((await session.json()).user.id).toBe(owner.user.id);
  });

  it("refuses sign-up outside our own sign-up flow", async () => {
    const res = await hit("POST", "/sign-up/email", undefined, { name: "x", email: "sneaky@example.com", password: "correct-horse-battery" });
    expect(res.status).toBe(404);
    expect(await prisma.user.count({ where: { email: "sneaky@example.com" } })).toBe(0);
  });

  it("refuses the organization plugin's role, invitation and delete endpoints, even for the owner", async () => {
    const owner = await signUpOwner();
    const staff = await addMember(owner.shop.id, "staff");
    const membership = await prisma.membership.findFirstOrThrow({ where: { userId: staff.userId } });

    const promote = await hit("POST", "/organization/update-member-role", owner.cookie, {
      memberId: membership.id,
      role: "owner",
      organizationId: owner.shop.id,
    });
    expect(promote.status).toBe(404);
    const invite = await hit("POST", "/organization/invite-member", owner.cookie, { email: "x@example.com", role: "owner" });
    expect(invite.status).toBe(404);
    const destroy = await hit("POST", "/organization/delete", owner.cookie, { organizationId: owner.shop.id });
    expect(destroy.status).toBe(404);

    expect((await prisma.membership.findUniqueOrThrow({ where: { id: membership.id } })).role).toBe("staff");
    expect(await prisma.shop.count({ where: { id: owner.shop.id } })).toBe(1);
  });

  it("refuses the admin plugin's endpoints", async () => {
    const owner = await signUpOwner();
    const res = await hit("POST", "/admin/set-role", owner.cookie, { userId: owner.user.id, role: "admin" });
    expect(res.status).toBe(404);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: owner.user.id } })).role).not.toBe("admin");
  });
});
