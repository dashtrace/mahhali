import { mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { GET as catalogue } from "@/app/api/public/shops/[slug]/catalogue/route";
import { GET as getBranding, PATCH as patchBranding } from "@/app/api/shop/branding/route";
import { DELETE as deleteLogo, POST as postLogo } from "@/app/api/shop/logo/route";
import { GET as getSettings, PATCH as patchSettings } from "@/app/api/shop/settings/route";
import { POST as signup } from "@/app/api/signup/route";
import { GET as serveUpload } from "@/app/uploads/[...path]/route";
import { prisma } from "@/server/db";
import { DEFAULT_THEME, PALETTES } from "@/server/domain/theme";
import { addMember, call, cookieFrom, resetDb, signUpOwner } from "./helpers";

type Owner = Awaited<ReturnType<typeof signUpOwner>>;

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const SVG = '<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>';

/** A multipart logo upload, which helpers.call (JSON only) cannot send. */
async function uploadLogo(cookie: string, file: File) {
  const form = new FormData();
  form.append("file", file);
  const res = await postLogo(new Request("http://localhost:3000/api/shop/logo", { method: "POST", headers: { cookie }, body: form }), {
    params: Promise.resolve({}),
  });
  return { status: res.status, body: await res.json() };
}

const serve = (url: string) =>
  serveUpload(new Request(`http://localhost:3000${url}`), { params: Promise.resolve({ path: url.split("/").slice(2) }) });

let owner: Owner;
let other: Owner;
const cookies: Record<string, string> = {};

beforeAll(async () => {
  process.env.UPLOAD_DIR = await mkdtemp(path.join(tmpdir(), "mahhali-uploads-"));
  await resetDb();
  owner = await signUpOwner();
  other = await signUpOwner();
  for (const role of ["manager", "staff", "delivery"]) cookies[role] = (await addMember(owner.shop.id, role)).cookie;
});

const settings = (body: unknown, cookie = owner.cookie) => call(patchSettings, "/api/shop/settings", { method: "PATCH", cookie, body });
const branding = (body: unknown, cookie = owner.cookie) => call(patchBranding, "/api/shop/branding", { method: "PATCH", cookie, body });

describe("shop settings", () => {
  it("starts from the defaults", async () => {
    const res = await call(getSettings, "/api/shop/settings", { cookie: owner.cookie });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ currency: "USD", deliveryFeeMinor: 0, codToleranceMinor: 0, language: "en", autoCancelHours: null });
  });

  it("saves every setting, with money in minor units and the phone in E.164", async () => {
    const res = await settings({
      name: "Layla Boutique",
      usdLbpRate: "89500",
      deliveryFee: "3.50",
      codTolerance: "0.5",
      autoCancelHours: 48,
      whatsappPhone: "71 123 456",
      language: "ar",
      baselineOrdersPerDay: 12,
      baselineConfirmMinutes: 45,
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      name: "Layla Boutique",
      usdLbpRate: "89500",
      deliveryFeeMinor: 350,
      codToleranceMinor: 50,
      autoCancelHours: 48,
      whatsappPhone: "+96171123456",
      language: "ar",
      baselineOrdersPerDay: 12,
      baselineConfirmMinutes: 45,
    });
    const cleared = await settings({ autoCancelHours: null, whatsappPhone: null });
    expect(cleared.body).toMatchObject({ autoCancelHours: null, whatsappPhone: null, deliveryFeeMinor: 350 });
  });

  it("refuses a currency change and out-of-range values", async () => {
    for (const body of [
      { currency: "LBP" },
      { autoCancelHours: 0 },
      { autoCancelHours: 721 },
      { language: "fr" },
      { whatsappPhone: "123" },
      { deliveryFee: "-1" },
      { usdLbpRate: "0" },
      {},
    ]) {
      expect((await settings(body)).status, JSON.stringify(body)).toBe(400);
    }
    expect((await prisma.shop.findUniqueOrThrow({ where: { id: owner.shop.id } })).currency).toBe("USD");
  });

  it("takes fees in whole pounds for a shop that prices in pounds", async () => {
    const lbp = await signUpOwner({ currency: "LBP", usdLbpRate: "89500" });
    const cents = await settings({ deliveryFee: "50000.5" }, lbp.cookie);
    expect(cents.status).toBe(422);
    expect(cents.body.error.code).toBe("INVALID_AMOUNT");
    expect((await settings({ deliveryFee: "150000" }, lbp.cookie)).body.deliveryFeeMinor).toBe(150000);
  });

  it("is for the owner only", async () => {
    for (const role of ["manager", "staff", "delivery"]) {
      expect((await call(getSettings, "/api/shop/settings", { cookie: cookies[role] })).status).toBe(403);
      expect((await settings({ name: "hacked" }, cookies[role])).status).toBe(403);
    }
  });

  it("records the baseline numbers given at sign-up", async () => {
    const res = await call(signup, "/api/signup", {
      method: "POST",
      body: {
        name: "Rima",
        email: `rima.${Date.now()}@example.com`,
        password: "correct-horse-battery",
        shopName: "Rima Shoes",
        shopSlug: `rima-${Date.now() % 100000}`,
        baselineOrdersPerDay: 8,
        baselineConfirmMinutes: 90,
      },
    });
    expect(res.status).toBe(201);
    const mine = await call(getSettings, "/api/shop/settings", { cookie: cookieFrom(res.headers) });
    expect(mine.body).toMatchObject({ baselineOrdersPerDay: 8, baselineConfirmMinutes: 90 });
  });
});

describe("branding", () => {
  it("shows the default theme and the palettes, then applies a palette", async () => {
    const shop = await signUpOwner();
    const before = await call(getBranding, "/api/shop/branding", { cookie: shop.cookie });
    expect(before.body).toEqual({ theme: DEFAULT_THEME, logo: null, palettes: PALETTES });

    const res = await branding({ preset: "night" }, shop.cookie);
    expect(res.status).toBe(200);
    expect(res.body.theme).toEqual(PALETTES.night);
    const pub = await call(catalogue, "/catalogue", {}, { slug: shop.shop.slug });
    expect(pub.body.shop.theme).toEqual(PALETTES.night);
  });

  it("saves custom colours that pass AA", async () => {
    const res = await branding({ primary: "#1E3A8A", accent: "#9D174D", background: "#FFFFFF", radius: "full", font: "cairo" });
    expect(res.status).toBe(200);
    expect(res.body.theme).toEqual({ primary: "#1e3a8a", accent: "#9d174d", background: "#ffffff", radius: "full", font: "cairo" });
  });

  it("refuses colours that make text hard to read and says which pair failed", async () => {
    const before = (await prisma.shop.findUniqueOrThrow({ where: { id: owner.shop.id } })).theme;
    const res = await branding({ primary: "#ffff00", accent: "#1e3a8a", background: "#ffffff", radius: "md", font: "system" });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("LOW_CONTRAST");
    expect(res.body.error.details).toEqual([
      { pair: "text on primary", foreground: "#ffffff", background: "#ffff00", ratio: 1.07 },
    ]);
    expect((await prisma.shop.findUniqueOrThrow({ where: { id: owner.shop.id } })).theme).toEqual(before);
  });

  it("validates the theme shape", async () => {
    const ok = { primary: "#1e3a8a", accent: "#9d174d", background: "#ffffff", radius: "md", font: "system" };
    for (const body of [{ preset: "neon" }, { ...ok, primary: "blue" }, { ...ok, radius: "huge" }, { ...ok, font: "comic" }, {}]) {
      expect((await branding(body)).status, JSON.stringify(body)).toBe(400);
    }
  });

  it("is for the owner only", async () => {
    for (const role of ["manager", "staff", "delivery"]) {
      expect((await call(getBranding, "/api/shop/branding", { cookie: cookies[role] })).status).toBe(403);
      expect((await branding({ preset: "rose" }, cookies[role])).status).toBe(403);
      expect((await uploadLogo(cookies[role], new File([PNG], "logo.png"))).status).toBe(403);
    }
  });
});

describe("logo", () => {
  it("uploads a PNG, replaces it with an SVG that cannot run script, and removes it", async () => {
    const shop = await signUpOwner();
    const first = await uploadLogo(shop.cookie, new File([PNG], "logo.png", { type: "image/png" }));
    expect(first.status).toBe(200);
    expect(first.body.logo).toMatch(new RegExp(`^/uploads/${shop.shop.id}/[\\w-]+\\.png$`));
    expect((await call(catalogue, "/catalogue", {}, { slug: shop.shop.slug })).body.shop.logo).toBe(first.body.logo);

    const second = await uploadLogo(shop.cookie, new File([SVG], "logo.svg", { type: "image/svg+xml" }));
    expect(second.body.logo).toMatch(/\.svg$/);
    const served = await serve(second.body.logo);
    expect(served.headers.get("content-type")).toBe("image/svg+xml");
    expect(served.headers.get("content-security-policy")).toBe("default-src 'none'; style-src 'unsafe-inline'; sandbox");
    expect(served.headers.get("x-content-type-options")).toBe("nosniff");
    // The replaced file is gone.
    expect((await serve(first.body.logo)).status).toBe(404);

    const removed = await deleteLogo(new Request("http://localhost:3000/api/shop/logo", { method: "DELETE", headers: { cookie: shop.cookie } }), {
      params: Promise.resolve({}),
    });
    expect(removed.status).toBe(204);
    expect((await prisma.shop.findUniqueOrThrow({ where: { id: shop.shop.id } })).logo).toBeNull();
    expect(await readdir(path.join(process.env.UPLOAD_DIR!, shop.shop.id))).toEqual([]);
  });

  it("refuses spoofed, unsupported and oversized files", async () => {
    const spoofed = await uploadLogo(owner.cookie, new File(["GIF89a not really"], "logo.png", { type: "image/png" }));
    expect(spoofed.status).toBe(422);
    expect(spoofed.body.error.code).toBe("UNSUPPORTED_FILE");
    const big = new Uint8Array(1024 * 1024 + 1);
    big.set(PNG);
    const tooBig = await uploadLogo(owner.cookie, new File([big], "logo.png", { type: "image/png" }));
    expect(tooBig.status).toBe(422);
    expect(tooBig.body.error.code).toBe("FILE_TOO_LARGE");
    expect((await prisma.shop.findUniqueOrThrow({ where: { id: owner.shop.id } })).logo).toBeNull();
  });
});

describe("settings tenant isolation", () => {
  it("only ever changes the signed-in owner's own shop", async () => {
    const before = await prisma.shop.findUniqueOrThrow({ where: { id: owner.shop.id } });
    await uploadLogo(owner.cookie, new File([PNG], "logo.png"));
    const ownerLogo = (await prisma.shop.findUniqueOrThrow({ where: { id: owner.shop.id } })).logo!;

    expect((await settings({ name: "Other renamed", deliveryFee: "9" }, other.cookie)).status).toBe(200);
    expect((await branding({ preset: "cedar" }, other.cookie)).status).toBe(200);
    await uploadLogo(other.cookie, new File([PNG], "logo.png"));
    await deleteLogo(new Request("http://localhost:3000/api/shop/logo", { method: "DELETE", headers: { cookie: other.cookie } }), {
      params: Promise.resolve({}),
    });

    const after = await prisma.shop.findUniqueOrThrow({ where: { id: owner.shop.id } });
    expect(after).toMatchObject({ name: before.name, deliveryFeeMinor: before.deliveryFeeMinor, theme: before.theme, logo: ownerLogo });
    expect((await serve(ownerLogo)).status).toBe(200);
    const mine = await call(getSettings, "/api/shop/settings", { cookie: other.cookie });
    expect(mine.body.name).toBe("Other renamed");
  });
});
