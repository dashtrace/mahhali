import { beforeAll, describe, expect, it } from "vitest";
import { POST as expireRoute } from "@/app/api/cron/expire-reservations/route";
import { prisma } from "@/server/db";
import { call, resetDb, signUpOwner } from "./helpers";

const HOUR = 60 * 60 * 1000;

beforeAll(async () => {
  await resetDb();
  process.env.CRON_SECRET = "test-cron-secret";
});

describe("cleaning up import previews", () => {
  it("deletes previews nobody confirmed, an hour after they expired, and keeps the rest", async () => {
    const owner = await signUpOwner();
    const base = { shopId: owner.shop.id, userId: owner.user.id, source: "MCP" as const, rows: [], report: {}, productCount: 1, variantCount: 1 };
    const old = (h: number) => new Date(Date.now() - h * HOUR);
    const stale = await prisma.productImport.create({ data: { ...base, expiresAt: old(2) } });
    const replaced = await prisma.productImport.create({ data: { ...base, status: "SUPERSEDED", expiresAt: old(2) } });
    const recent = await prisma.productImport.create({ data: { ...base, expiresAt: old(0.5) } });
    const waiting = await prisma.productImport.create({ data: { ...base, expiresAt: new Date(Date.now() + HOUR) } });
    const confirmed = await prisma.productImport.create({ data: { ...base, status: "CONFIRMED", confirmedAt: old(3), expiresAt: old(3) } });

    const res = await call(expireRoute, "/api/cron/expire-reservations", {
      method: "POST",
      headers: { "x-cron-secret": "test-cron-secret" },
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ expiredPreviews: 2 });
    const left = await prisma.productImport.findMany({ select: { id: true } });
    expect(left.map((i) => i.id).sort()).toEqual([recent.id, waiting.id, confirmed.id].sort());
    expect(left.map((i) => i.id)).not.toContain(stale.id);
    expect(left.map((i) => i.id)).not.toContain(replaced.id);
  });
});
