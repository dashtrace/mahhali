import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { can, type Action, type ShopRole } from "@/server/domain/policy";
import { AppError } from "@/server/http/errors";
import { currentUser, resolveActor, resolveAdmin } from "@/server/http/session";
import type { Actor } from "@/server/http/withRoute";

/** Where each role lands after signing in. */
export function homeFor(role: ShopRole): string {
  return role === "delivery" ? "/dashboard/deliveries" : "/dashboard";
}

/**
 * The signed-in member for a dashboard page. Not signed in -> /login; no shop
 * -> the no-shop page; a role without `action` -> that role's home screen.
 */
export async function pageActor(action: Action, next?: string): Promise<Actor> {
  const h = await headers();
  let actor: Actor;
  try {
    actor = await resolveActor(h, "order.readAssigned");
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
    if (error.status === 401) redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
    const user = await currentUser(h);
    redirect(user?.isAdmin ? "/admin" : "/no-shop");
  }
  if (!can(actor.role, action)) redirect(homeFor(actor.role));
  return actor;
}

export async function pageAdmin() {
  try {
    return await resolveAdmin(await headers());
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
    redirect(error.status === 401 ? "/login?next=/admin" : "/dashboard");
  }
}

export async function signedInUser() {
  return currentUser(await headers());
}

/** The visitor's address as Caddy forwards it, for services that rate-limit public pages. */
export async function requestIp(): Promise<string> {
  return (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}
