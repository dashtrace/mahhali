import { beforeAll, describe, expect, it } from "vitest";
import { POST as signup } from "@/app/api/signup/route";
import { GET as me } from "@/app/api/me/route";
import { prisma } from "@/server/db";
import { call, resetDb, signUpOwner } from "./helpers";

beforeAll(resetDb);

const valid = {
  name: "Layla",
  email: "layla@example.com",
  password: "correct-horse-battery",
  shopName: "Layla Boutique",
  shopSlug: "layla-boutique",
  currency: "USD",
};

describe("POST /api/signup", () => {
  it("creates the owner, the shop and an owner membership, and signs the owner in", async () => {
    const res = await call(signup, "/api/signup", { method: "POST", body: valid });
    expect(res.status).toBe(201);
    expect(res.body.shop).toMatchObject({ name: "Layla Boutique", slug: "layla-boutique", currency: "USD" });
    expect(res.body.role).toBe("owner");

    const membership = await prisma.membership.findFirst({ where: { shopId: res.body.shop.id } });
    expect(membership?.role).toBe("owner");

    const cookie = res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
    const who = await call(me, "/api/me", { cookie });
    expect(who.status).toBe(200);
    expect(who.body).toMatchObject({ shopId: res.body.shop.id, role: "owner" });
  });

  it("refuses a shop link that is taken", async () => {
    const res = await call(signup, "/api/signup", {
      method: "POST",
      body: { ...valid, email: "other@example.com" },
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("SLUG_TAKEN");
  });

  it("refuses an email that already has an account, without creating a shop", async () => {
    const res = await call(signup, "/api/signup", {
      method: "POST",
      body: { ...valid, shopSlug: "second-shop" },
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("EMAIL_TAKEN");
    expect(await prisma.shop.count({ where: { slug: "second-shop" } })).toBe(0);
  });

  it("validates the body", async () => {
    const res = await call(signup, "/api/signup", {
      method: "POST",
      body: { ...valid, email: "not-an-email", shopSlug: "Bad Slug", password: "short" },
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");
    const paths = res.body.error.details.map((d: { path: string }) => d.path);
    expect(paths).toEqual(expect.arrayContaining(["email", "shopSlug", "password"]));
  });

  it("rejects a body that is not JSON", async () => {
    const res = await call(signup, "/api/signup", { method: "POST", body: "{nope" });
    expect(res.status).toBe(400);
  });

  it("stores the shop currency and exchange rate", async () => {
    const { shop } = await signUpOwner({ currency: "LBP", usdLbpRate: "89500" });
    const stored = await prisma.shop.findUniqueOrThrow({ where: { id: shop.id } });
    expect(stored.currency).toBe("LBP");
    expect(stored.usdLbpRate?.toString()).toBe("89500");
  });
});
