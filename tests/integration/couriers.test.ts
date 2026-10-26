import { beforeAll, describe, expect, it } from "vitest";
import { GET as listCouriers, POST as createCourier } from "@/app/api/couriers/route";
import { PATCH as patchCourier } from "@/app/api/couriers/[id]/route";
import { prisma } from "@/server/db";
import { seedCourier } from "./fixtures";
import { addMember, call, resetDb, signUpOwner } from "./helpers";

type Owner = Awaited<ReturnType<typeof signUpOwner>>;

let owner: Owner;
let other: Owner;
const cookies: Record<string, string> = {};

beforeAll(async () => {
  await resetDb();
  owner = await signUpOwner();
  other = await signUpOwner();
  for (const role of ["manager", "staff", "delivery"]) cookies[role] = (await addMember(owner.shop.id, role)).cookie;
});

const create = (body: unknown, cookie = owner.cookie) => call(createCourier, "/api/couriers", { method: "POST", cookie, body });
const patch = (id: string, body: unknown, cookie = owner.cookie) =>
  call(patchCourier, `/api/couriers/${id}`, { method: "PATCH", cookie, body }, { id });

describe("couriers", () => {
  it("adds a delivery company with its phone in international format", async () => {
    const res = await create({ name: "Toters", type: "COMPANY", phone: "03 123 456" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: "Toters", type: "COMPANY", phone: "+9613123456", active: true, shopId: owner.shop.id });
    expect((await create({ name: "Ali", type: "INDIVIDUAL" }, cookies.manager)).body.phone).toBeNull();
  });

  it("validates the name, type and phone", async () => {
    expect((await create({ name: "", type: "COMPANY" })).status).toBe(400);
    expect((await create({ name: "X", type: "BIKE" })).status).toBe(400);
    expect((await create({ name: "X", type: "COMPANY", phone: "12" })).status).toBe(400);
  });

  it("edits and deactivates a courier, and filters the list by active", async () => {
    const courier = (await create({ name: "Wakilni", type: "COMPANY", phone: "71123456" })).body;
    const res = await patch(courier.id, { name: "Wakilni Express", phone: null, active: false });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: "Wakilni Express", phone: null, active: false, type: "COMPANY" });
    expect((await patch(courier.id, {})).status).toBe(400);

    const names = async (query: string) =>
      (await call(listCouriers, `/api/couriers${query}`, { cookie: cookies.staff })).body.map((c: { name: string }) => c.name);
    expect(await names("")).toContain("Wakilni Express");
    expect(await names("?active=true")).not.toContain("Wakilni Express");
    expect(await names("?active=false")).toEqual(["Wakilni Express"]);
    expect((await call(listCouriers, "/api/couriers?active=yes", { cookie: owner.cookie })).status).toBe(400);
  });

  it("lets staff read couriers but not change them, and keeps delivery users out", async () => {
    const courier = await seedCourier(owner.shop.id);
    expect((await create({ name: "Y", type: "COMPANY" }, cookies.staff)).status).toBe(403);
    expect((await patch(courier.id, { active: false }, cookies.staff)).status).toBe(403);
    expect((await call(listCouriers, "/api/couriers", { cookie: cookies.delivery })).status).toBe(403);
    expect((await patch(courier.id, { active: false }, cookies.delivery)).status).toBe(403);
  });
});

describe("courier tenant isolation", () => {
  it("never shows or changes another shop's courier", async () => {
    const courier = await seedCourier(owner.shop.id, { name: "A's courier" });
    const otherManager = (await addMember(other.shop.id, "manager")).cookie;
    expect((await patch(courier.id, { name: "hacked" }, other.cookie)).status).toBe(404);
    expect((await patch(courier.id, { active: false }, otherManager)).status).toBe(404);

    const list = await call(listCouriers, "/api/couriers", { cookie: other.cookie });
    expect(list.status).toBe(200);
    expect(list.body).toEqual([]);
    expect(await prisma.courier.findUniqueOrThrow({ where: { id: courier.id } })).toMatchObject({ name: "A's courier", active: true });
  });
});
