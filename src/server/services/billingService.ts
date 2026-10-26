import { PLANS } from "../domain/plans";
import { verifyStripeSignature } from "../domain/stripeSignature";
import { AppError, badRequest, conflict, notFound } from "../http/errors";
import type { Actor } from "../http/withRoute";
import { appUrl } from "../mail/mailer";
import { billingRepo } from "../repositories/billingRepo";
import { shopRepo } from "../repositories/shopRepo";
import { CheckoutCompleted, StripeEvent, SubscriptionDeleted } from "../validation/team";

const notConfigured = () => new AppError(503, "BILLING_NOT_CONFIGURED", "Billing is not set up yet.");

// Stripe in test mode, called with fetch so there is no SDK dependency.
export const billingService = {
  plans() {
    return Object.values(PLANS);
  },

  /** Starts a Stripe Checkout Session for the Pro subscription; returns its URL. */
  async checkout(actor: Actor) {
    const key = process.env.STRIPE_SECRET_KEY;
    const price = process.env.STRIPE_PRICE_PRO;
    if (!key || !price) throw notConfigured();
    const shop = await shopRepo.findById(actor.shopId);
    if (!shop) throw notFound("Shop");
    if (shop.plan === "pro") throw conflict("ALREADY_SUBSCRIBED", "This shop is already on Pro.");

    const form = new URLSearchParams({
      mode: "subscription",
      "line_items[0][price]": price,
      "line_items[0][quantity]": "1",
      client_reference_id: shop.id,
      // Read back from customer.subscription.deleted, which has no client_reference_id.
      "subscription_data[metadata][shopId]": shop.id,
      success_url: appUrl("/dashboard/billing?checkout=success"),
      cancel_url: appUrl("/dashboard/billing?checkout=cancelled"),
    });
    if (shop.stripeCustomerId) form.set("customer", shop.stripeCustomerId);

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/x-www-form-urlencoded" },
      body: form,
    });
    const session = (await res.json().catch(() => null)) as { url?: string } | null;
    if (!res.ok || !session?.url) {
      console.error("stripe checkout failed", res.status, session);
      throw new AppError(502, "PAYMENT_PROVIDER_ERROR", "Could not start checkout. Try again in a moment.");
    }
    return { url: session.url };
  },

  /**
   * Stripe webhook. The raw body is verified before anything is read from it.
   * Events we do not use, or that are not about a Shop Link checkout, get 200
   * so Stripe stops retrying them.
   */
  async webhook(payload: string, signature: string | null) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) throw notConfigured();
    if (!verifyStripeSignature(payload, signature, secret)) {
      throw new AppError(400, "INVALID_SIGNATURE", "Stripe signature did not verify.");
    }
    let event;
    try {
      event = StripeEvent.parse(JSON.parse(payload));
    } catch {
      throw badRequest("Not a Stripe event");
    }

    if (event.type === "checkout.session.completed") {
      const s = CheckoutCompleted.safeParse(event.data.object);
      if (s.success) {
        const updated = await billingRepo.upgrade(s.data.client_reference_id, {
          customerId: s.data.customer,
          subscriptionId: s.data.subscription,
        });
        return { received: true, handled: updated };
      }
    }
    if (event.type === "customer.subscription.deleted") {
      const s = SubscriptionDeleted.safeParse(event.data.object);
      if (s.success) return { received: true, handled: await billingRepo.downgrade(s.data.metadata.shopId, s.data.id) };
    }
    return { received: true, handled: false };
  },
};
