import { timingSafeEqual } from "node:crypto";
import type { ZodType } from "zod";
import type { Action, ShopRole } from "../domain/policy";
import { adminRepo } from "../repositories/adminRepo";
import { AppError, badRequest, unauthorized } from "./errors";
import { json } from "./json";
import { resolveActor, resolveAdmin } from "./session";

export type Actor = {
  userId: string;
  shopId: string;
  role: ShopRole;
  courierId: string | null;
};

/** A platform admin (Better Auth admin role). Not tied to any shop. */
export type AdminActor = { userId: string };

type Access =
  | { kind: "public" }
  | { kind: "shop"; action: Action }
  // Platform admins only; every request is written to the audit log.
  | { kind: "admin" }
  // Host cron jobs, authenticated by the CRON_SECRET header.
  | { kind: "cron" };

type Config<B, Q, P> = {
  access: Access;
  body?: ZodType<B>;
  query?: ZodType<Q>;
  params?: ZodType<P>;
};

type Ctx<B, Q, P, A> = { req: Request; body: B; query: Q; params: P; actor: A };

type Handler<B, Q, P, A> = (ctx: Ctx<B, Q, P, A>) => Promise<Response | unknown>;

type RouteContext = { params: Promise<Record<string, string | string[]>> };

type RouteFn = (req: Request, ctx: RouteContext) => Promise<Response>;

/**
 * The only way to write a route handler. In order: resolve the session and the
 * shop membership, check the role against the policy, validate params, query
 * and body with Zod, run the handler, and map every error to one JSON shape.
 */
export function withRoute<B = undefined, Q = undefined, P = undefined>(
  config: Config<B, Q, P> & { access: { kind: "shop"; action: Action } },
  handler: Handler<B, Q, P, Actor>,
): RouteFn;
export function withRoute<B = undefined, Q = undefined, P = undefined>(
  config: Config<B, Q, P> & { access: { kind: "admin" } },
  handler: Handler<B, Q, P, AdminActor>,
): RouteFn;
export function withRoute<B = undefined, Q = undefined, P = undefined>(
  config: Config<B, Q, P> & { access: { kind: "public" } | { kind: "cron" } },
  handler: Handler<B, Q, P, null>,
): RouteFn;
export function withRoute<B, Q, P>(
  config: Config<B, Q, P>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- narrowed by the overloads above
  handler: Handler<B, Q, P, any>,
) {
  return async (req: Request, routeCtx: RouteContext): Promise<Response> => {
    try {
      const actor = await resolveAccess(req, config.access);
      const params = parse(config.params, (await routeCtx?.params) ?? {}, "Invalid path") as P;
      const query = parse(
        config.query,
        Object.fromEntries(new URL(req.url).searchParams),
        "Invalid query",
      ) as Q;
      const body = config.body ? (parse(config.body, await readJson(req), "Invalid body") as B) : (undefined as B);

      if (config.access.kind === "admin") {
        const shopId = (params as { id?: unknown } | undefined)?.id;
        await adminRepo.audit((actor as AdminActor).userId, `${req.method} ${new URL(req.url).pathname}`,
          typeof shopId === "string" ? shopId : null);
      }

      const result = await handler({ req, body, query, params, actor });
      return result instanceof Response ? result : json(result);
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}

async function resolveAccess(req: Request, access: Access): Promise<Actor | AdminActor | null> {
  switch (access.kind) {
    case "public":
      return null;
    case "shop":
      return resolveActor(req.headers, access.action);
    case "admin":
      return resolveAdmin(req.headers);
    case "cron": {
      const secret = process.env.CRON_SECRET;
      if (!secret || !safeEqual(req.headers.get("x-cron-secret") ?? "", secret)) throw unauthorized();
      return null;
    }
  }
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function parse<T>(schema: ZodType<T> | undefined, input: unknown, message: string): T | undefined {
  if (!schema) return undefined;
  const result = schema.safeParse(input);
  if (!result.success) {
    throw badRequest(
      message,
      result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    );
  }
  return result.data;
}

async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw badRequest("Body must be valid JSON");
  }
}

function toErrorResponse(error: unknown): Response {
  if (error instanceof AppError) {
    const headers = error.status === 429 && typeof error.details === "object" && error.details && "retryAfter" in error.details
      ? { "retry-after": String((error.details as { retryAfter: number }).retryAfter) }
      : undefined;
    return json({ error: { code: error.code, message: error.message, details: error.details } }, error.status, headers);
  }
  console.error(error);
  return json({ error: { code: "INTERNAL", message: "Something went wrong." } }, 500);
}
