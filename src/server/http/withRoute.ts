import type { ZodType } from "zod";
import { auth } from "../auth/auth";
import { can, isShopRole, type Action, type ShopRole } from "../domain/policy";
import { membershipRepo } from "../repositories/membershipRepo";
import { AppError, badRequest, forbidden, unauthorized } from "./errors";
import { json } from "./json";

export type Actor = {
  userId: string;
  shopId: string;
  role: ShopRole;
  courierId: string | null;
};

type Access =
  | { kind: "public" }
  | { kind: "shop"; action: Action };

type Config<B, Q, P> = {
  access: Access;
  body?: ZodType<B>;
  query?: ZodType<Q>;
  params?: ZodType<P>;
};

type Ctx<B, Q, P, A> = { req: Request; body: B; query: Q; params: P; actor: A };

type Handler<B, Q, P, A> = (ctx: Ctx<B, Q, P, A>) => Promise<Response | unknown>;

type RouteContext = { params: Promise<Record<string, string | string[]>> };

/**
 * The only way to write a route handler. In order: resolve the session and the
 * shop membership, check the role against the policy, validate params, query
 * and body with Zod, run the handler, and map every error to one JSON shape.
 */
export function withRoute<B = undefined, Q = undefined, P = undefined>(
  config: Config<B, Q, P> & { access: { kind: "shop"; action: Action } },
  handler: Handler<B, Q, P, Actor>,
): (req: Request, ctx: RouteContext) => Promise<Response>;
export function withRoute<B = undefined, Q = undefined, P = undefined>(
  config: Config<B, Q, P> & { access: { kind: "public" } },
  handler: Handler<B, Q, P, null>,
): (req: Request, ctx: RouteContext) => Promise<Response>;
export function withRoute<B, Q, P>(
  config: Config<B, Q, P>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- narrowed by the overloads above
  handler: Handler<B, Q, P, any>,
) {
  return async (req: Request, routeCtx: RouteContext): Promise<Response> => {
    try {
      const actor = config.access.kind === "shop" ? await resolveActor(req, config.access.action) : null;
      const params = parse(config.params, (await routeCtx?.params) ?? {}, "Invalid path") as P;
      const query = parse(
        config.query,
        Object.fromEntries(new URL(req.url).searchParams),
        "Invalid query",
      ) as Q;
      const body = config.body ? (parse(config.body, await readJson(req), "Invalid body") as B) : (undefined as B);

      const result = await handler({ req, body, query, params, actor });
      return result instanceof Response ? result : json(result);
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}

async function resolveActor(req: Request, action: Action): Promise<Actor> {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) throw unauthorized();
  const membership = await membershipRepo.findActive(session.user.id, session.session.activeOrganizationId);
  if (!membership || !isShopRole(membership.role)) throw forbidden("You are not a member of a shop.");
  if (membership.shop.suspended) throw forbidden("This shop is suspended.");
  if (!can(membership.role, action)) throw forbidden();
  return {
    userId: session.user.id,
    shopId: membership.shopId,
    role: membership.role,
    courierId: membership.courierId,
  };
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
    return json({ error: { code: error.code, message: error.message, details: error.details } }, error.status);
  }
  console.error(error);
  return json({ error: { code: "INTERNAL", message: "Something went wrong." } }, 500);
}
