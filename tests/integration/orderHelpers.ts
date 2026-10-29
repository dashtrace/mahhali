import { POST as placeRoute } from "@/app/api/public/shops/[slug]/orders/route";
import { POST as transitionRoute } from "@/app/api/orders/[id]/transitions/route";
import { PATCH as patchOrderRoute } from "@/app/api/orders/[id]/route";
import { call } from "./helpers";

let ip = 0;

export function orderBody(lines: { variantId: string; qty?: number }[], overrides: Record<string, unknown> = {}) {
  return {
    items: lines.map((l) => ({ variantId: l.variantId, qty: l.qty ?? 1 })),
    customer: { name: "Maya Haddad", phone: "71 123 456", email: null },
    address: {
      governorate: "Beirut",
      district: "Beirut",
      area: "Mar Mikhael",
      addressLine: "Armenia St, Building 12, 3rd floor",
      landmark: "Next to the pharmacy",
    },
    ...overrides,
  };
}

/** Places a guest order from a fresh address so the per-IP limit never interferes. */
export function placeOrder(slug: string, body: unknown, opts: { key?: string; ip?: string } = {}) {
  ip += 1;
  const headers: Record<string, string> = { "x-forwarded-for": opts.ip ?? `10.${(ip >> 16) & 255}.${(ip >> 8) & 255}.${ip & 255}` };
  if (opts.key) headers["idempotency-key"] = opts.key;
  return call(placeRoute, `/api/public/shops/${slug}/orders`, { method: "POST", body, headers }, { slug });
}

export function moveOrder(cookie: string, id: string, body: Record<string, unknown>) {
  return call(transitionRoute, `/api/orders/${id}/transitions`, { method: "POST", cookie, body }, { id });
}

export function patchOrder(cookie: string, id: string, body: Record<string, unknown>) {
  return call(patchOrderRoute, `/api/orders/${id}`, { method: "PATCH", cookie, body }, { id });
}
