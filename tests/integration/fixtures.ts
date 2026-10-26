import type { OrderStatus } from "@prisma/client";
import { auth } from "@/server/auth/auth";
import { prisma } from "@/server/db";
import { randomToken } from "@/server/domain/tokens";
import { cookieFrom } from "./helpers";

// Rows written straight to the database, for tests that need data in a given
// state (a delivered order, a courier) without walking it through the API.

export async function seedVariant(
  shopId: string,
  opts: { name?: string; size?: string | null; colour?: string | null; priceMinor?: bigint; available?: number } = {},
) {
  const product = await prisma.product.create({
    data: {
      shopId,
      name: opts.name ?? "Linen shirt",
      variants: {
        create: {
          shopId,
          size: opts.size === undefined ? "M" : opts.size,
          colour: opts.colour === undefined ? "Sand" : opts.colour,
          priceMinor: opts.priceMinor ?? 2500n,
          available: opts.available ?? 5,
        },
      },
    },
    include: { variants: true },
  });
  return { product, variant: product.variants[0] };
}

export function seedCourier(shopId: string, opts: { name?: string; type?: "COMPANY" | "INDIVIDUAL" } = {}) {
  return prisma.courier.create({ data: { shopId, name: opts.name ?? "Toters", type: opts.type ?? "COMPANY" } });
}

type SeedOrder = {
  variantId: string;
  qty?: number;
  status?: OrderStatus;
  courierId?: string | null;
  currency?: "USD" | "LBP";
  usdLbpRate?: string | null;
  deliveryFeeMinor?: bigint;
  customerPhone?: string;
  customerName?: string;
  customerEmail?: string | null;
  reportedUsdCents?: bigint | null;
  reportedLbp?: bigint | null;
  deliveredAt?: Date | null;
  deliveredByUserId?: string | null;
  createdAt?: Date;
  confirmedAt?: Date | null;
};

/**
 * An order in any status with one line. Takes the next order number and moves
 * stock the way the real flow would have, so counters stay consistent.
 */
export async function seedOrder(shopId: string, o: SeedOrder) {
  return prisma.$transaction(async (tx) => {
    const variant = await tx.variant.findUniqueOrThrow({ where: { id: o.variantId }, include: { product: true } });
    const qty = o.qty ?? 1;
    const status = o.status ?? "NEW";
    const shop = await tx.shop.update({ where: { id: shopId }, data: { nextOrderSeq: { increment: 1 } } });
    const phone = o.customerPhone ?? "+96171123456";
    const name = o.customerName ?? "Maya Haddad";
    const customer = await tx.customer.upsert({
      where: { shopId_phone: { shopId, phone } },
      create: { shopId, phone, name, email: o.customerEmail ?? null },
      update: {},
    });
    const subtotal = variant.priceMinor * BigInt(qty);
    const fee = o.deliveryFeeMinor ?? 0n;
    const shipped = ["OUT_FOR_DELIVERY", "DELIVERED", "RETURNED"].includes(status);
    const released = status === "CANCELLED";
    await tx.variant.update({
      where: { id: variant.id },
      data: {
        available: { decrement: released || status === "RETURNED" ? 0 : qty },
        reserved: { increment: shipped || released ? 0 : qty },
      },
    });
    return tx.order.create({
      data: {
        shopId,
        number: shop.nextOrderSeq - 1,
        publicToken: randomToken(),
        status,
        customerId: customer.id,
        customerName: name,
        customerPhone: phone,
        customerEmail: o.customerEmail ?? null,
        governorate: "Beirut",
        district: "Beirut",
        area: "Mar Mikhael",
        addressLine: "Armenia St, Building 12, 3rd floor",
        landmark: "Next to the pharmacy",
        courierId: o.courierId ?? null,
        currency: o.currency ?? shop.currency,
        usdLbpRate: o.usdLbpRate ?? (shop.usdLbpRate ? shop.usdLbpRate.toString() : null),
        subtotalMinor: subtotal,
        deliveryFeeMinor: fee,
        totalMinor: subtotal + fee,
        codMinor: subtotal + fee,
        reportedUsdCents: o.reportedUsdCents ?? null,
        reportedLbp: o.reportedLbp ?? null,
        deliveredAt: o.deliveredAt ?? (status === "DELIVERED" ? new Date() : null),
        deliveredByUserId: o.deliveredByUserId ?? null,
        confirmedAt: o.confirmedAt ?? (status === "NEW" || status === "CANCELLED" ? null : new Date()),
        ...(o.createdAt ? { createdAt: o.createdAt, firstContactAt: o.createdAt } : {}),
        items: {
          create: {
            shopId,
            variantId: variant.id,
            nameSnapshot: [variant.product.name, variant.size, variant.colour].filter(Boolean).join(" / "),
            unitPriceMinor: variant.priceMinor,
            qty,
          },
        },
      },
      include: { items: true },
    });
  });
}

let admins = 0;

/** A platform admin (Better Auth admin role); returns their cookie. */
export async function seedAdmin() {
  admins += 1;
  const email = `admin${admins}.${Date.now()}@example.com`;
  const signUp = await auth.api.signUpEmail({ body: { name: `Admin ${admins}`, email, password: "correct-horse-battery" } });
  await prisma.user.update({ where: { id: signUp.user.id }, data: { role: "admin" } });
  const signIn = await auth.api.signInEmail({ body: { email, password: "correct-horse-battery" }, asResponse: true });
  return { cookie: cookieFrom(signIn.headers), userId: signUp.user.id };
}
