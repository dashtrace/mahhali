import { createHmac } from "node:crypto";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { POST as checkout } from "@/app/api/billing/checkout/route";
import { GET as plans } from "@/app/api/billing/plans/route";
import { POST as webhook } from "@/app/api/billing/webhook/route";
import { prisma } from "@/server/db";
import { addMember, call, resetDb, signUpOwner } from "./helpers";

beforeAll(resetDb);
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const secret = "whsec_test_for_integration";

/** Signs a payload the way Stripe does: v1 = HMAC-SHA256("t.payload"). */
function send(event: unknown, opts: { key?: string; t?: number } = {}) {
  const payload = JSON.stringify(event);
  const t = opts.t ?? Math.floor(Date.now() / 1000);
  const v1 = createHmac("sha256", opts.key ?? secret).update(`${t}.${payload}`).digest("hex");
  return call(webhook, "/api/billing/webhook", { method: "POST", body: payload, headers: { "stripe-signature": `t=${t},v1=${v1}` } });
}

const completed = (shopId: string, subscription = "sub_123") => ({
  id: "evt_1",
  type: "checkout.session.completed",
  data: { object: { id: "cs_1", mode: "subscription", client_reference_id: shopId, customer: "cus_123", subscription } },
});
const deleted = (shopId: string, subscription = "sub_123") => ({
  id: "evt_2",
  type: "customer.subscription.deleted",
  data: { object: { id: subscription, customer: "cus_123", metadata: { shopId } } },
});

describe("billing", () => {
  it("publishes the plans", async () => {
    const res = await call(plans, "/api/billing/plans");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      expect.objectContaining({ id: "free", monthlyOrderLimit: 50 }),
      expect.objectContaining({ id: "pro", priceLabel: "$19/month", monthlyOrderLimit: null }),
    ]);
  });

  it("checkout answers 503 BILLING_NOT_CONFIGURED without Stripe keys", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    const owner = await signUpOwner();
    const res = await call(checkout, "/api/billing/checkout", { method: "POST", cookie: owner.cookie });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("BILLING_NOT_CONFIGURED");
  });

  it("checkout is for the owner only", async () => {
    const owner = await signUpOwner();
    const manager = await addMember(owner.shop.id, "manager");
    expect((await call(checkout, "/api/billing/checkout", { method: "POST", cookie: manager.cookie })).status).toBe(403);
  });

  it("creates a subscription Checkout Session for the shop and returns its URL", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_123");
    vi.stubEnv("STRIPE_PRICE_PRO", "price_pro");
    const stripe = vi.fn().mockResolvedValue(Response.json({ id: "cs_1", url: "https://checkout.stripe.com/c/pay/cs_1" }));
    vi.stubGlobal("fetch", stripe);
    const owner = await signUpOwner();

    const res = await call(checkout, "/api/billing/checkout", { method: "POST", cookie: owner.cookie });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ url: "https://checkout.stripe.com/c/pay/cs_1" });

    const [url, init] = stripe.mock.calls[0];
    expect(url).toBe("https://api.stripe.com/v1/checkout/sessions");
    expect(init.headers.authorization).toBe("Bearer sk_test_123");
    const form = new URLSearchParams(init.body.toString());
    expect(form.get("mode")).toBe("subscription");
    expect(form.get("line_items[0][price]")).toBe("price_pro");
    expect(form.get("client_reference_id")).toBe(owner.shop.id);
    expect(form.get("subscription_data[metadata][shopId]")).toBe(owner.shop.id);
    expect(form.get("success_url")).toContain("/dashboard/billing?");
  });

  describe("webhook", () => {
    it("refuses a bad or missing signature with 400 and changes nothing", async () => {
      vi.stubEnv("STRIPE_WEBHOOK_SECRET", secret);
      const owner = await signUpOwner();
      const forged = await send(completed(owner.shop.id), { key: "attacker" });
      expect(forged.status).toBe(400);
      expect(forged.body.error.code).toBe("INVALID_SIGNATURE");
      const unsigned = await call(webhook, "/api/billing/webhook", { method: "POST", body: JSON.stringify(completed(owner.shop.id)) });
      expect(unsigned.status).toBe(400);
      const stale = await send(completed(owner.shop.id), { t: Math.floor(Date.now() / 1000) - 600 });
      expect(stale.status).toBe(400);
      expect((await prisma.shop.findUniqueOrThrow({ where: { id: owner.shop.id } })).plan).toBe("free");
    });

    it("moves the shop to Pro on checkout.session.completed and back to Free when the subscription ends", async () => {
      vi.stubEnv("STRIPE_WEBHOOK_SECRET", secret);
      const owner = await signUpOwner();

      const done = await send(completed(owner.shop.id));
      expect(done.status).toBe(200);
      expect(done.body).toEqual({ received: true, handled: true });
      expect(await prisma.shop.findUniqueOrThrow({ where: { id: owner.shop.id } })).toMatchObject({
        plan: "pro",
        stripeCustomerId: "cus_123",
        stripeSubscriptionId: "sub_123",
      });

      // An older subscription ending does not downgrade the current one.
      expect((await send(deleted(owner.shop.id, "sub_old"))).body.handled).toBe(false);
      expect((await prisma.shop.findUniqueOrThrow({ where: { id: owner.shop.id } })).plan).toBe("pro");

      expect((await send(deleted(owner.shop.id))).body.handled).toBe(true);
      expect(await prisma.shop.findUniqueOrThrow({ where: { id: owner.shop.id } })).toMatchObject({
        plan: "free",
        stripeSubscriptionId: null,
      });
    });

    it("acknowledges events it does not use with 200", async () => {
      vi.stubEnv("STRIPE_WEBHOOK_SECRET", secret);
      const res = await send({ id: "evt_3", type: "invoice.paid", data: { object: { id: "in_1" } } });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ received: true, handled: false });
    });

    it("answers 503 when the webhook secret is not configured", async () => {
      vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
      expect((await send({ type: "invoice.paid", data: { object: {} } })).status).toBe(503);
    });
  });
});
