import { prisma } from "@/server/db";
import { auth } from "@/server/auth/auth";
import { POST as signupRoute } from "@/app/api/signup/route";

const BASE = "http://localhost:3000";

/** Empties every table between test files. */
export async function resetDb() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  const list = tables.map((t) => `"public"."${t.tablename}"`).join(", ");
  if (list) await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} CASCADE`);
}

type Init = { method?: string; body?: unknown; cookie?: string; headers?: Record<string, string> };

/** Calls a route handler the way Next.js would. */
export async function call(
  handler: (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>,
  path: string,
  init: Init = {},
  params: Record<string, string> = {},
) {
  const headers = new Headers(init.headers);
  if (init.cookie) headers.set("cookie", init.cookie);
  if (init.body !== undefined) headers.set("content-type", "application/json");
  const req = new Request(`${BASE}${path}`, {
    method: init.method ?? "GET",
    headers,
    body: init.body === undefined ? undefined : typeof init.body === "string" ? init.body : JSON.stringify(init.body),
  });
  const res = await handler(req, { params: Promise.resolve(params) });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null, headers: res.headers };
}

function cookieFrom(headers: Headers): string {
  return headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
}

let counter = 0;

/** Signs up a new business through the real endpoint; returns the owner's cookie. */
export async function signUpOwner(overrides: Partial<Record<string, string>> = {}) {
  counter += 1;
  const slug = overrides.shopSlug ?? `shop-${counter}-${Date.now() % 100000}`;
  const res = await call(signupRoute, "/api/signup", {
    method: "POST",
    body: {
      name: `Owner ${counter}`,
      email: overrides.email ?? `owner${counter}.${Date.now()}@example.com`,
      password: "correct-horse-battery",
      shopName: `Shop ${counter}`,
      shopSlug: slug,
      currency: overrides.currency ?? "USD",
      ...(overrides.usdLbpRate ? { usdLbpRate: overrides.usdLbpRate } : {}),
    },
  });
  if (res.status !== 201) throw new Error(`signup failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { cookie: cookieFrom(res.headers), shop: res.body.shop, user: res.body.user };
}

/** Creates a user with a given role in an existing shop; returns their cookie. */
export async function addMember(shopId: string, role: string, courierId?: string) {
  counter += 1;
  const email = `${role}${counter}.${Date.now()}@example.com`;
  const signUp = await auth.api.signUpEmail({
    body: { name: `${role} ${counter}`, email, password: "correct-horse-battery" },
  });
  await prisma.membership.create({
    data: { id: crypto.randomUUID(), shopId, userId: signUp.user.id, role, courierId: courierId ?? null },
  });
  const signIn = await auth.api.signInEmail({
    body: { email, password: "correct-horse-battery" },
    asResponse: true,
  });
  return { cookie: cookieFrom(signIn.headers), userId: signUp.user.id };
}
