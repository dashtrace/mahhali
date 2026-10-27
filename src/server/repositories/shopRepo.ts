import { Prisma } from "@prisma/client";
import { db, type Db } from "./tx";
import type { Currency } from "../domain/money";
import type { Theme } from "../domain/theme";

export const shopRepo = {
  findById(id: string, client: Db = db) {
    return client.shop.findUnique({ where: { id } });
  },

  findBySlug(slug: string, client: Db = db) {
    return client.shop.findUnique({ where: { slug } });
  },

  async slugTaken(slug: string, client: Db = db) {
    return (await client.shop.count({ where: { slug } })) > 0;
  },

  /** Creates the shop and makes userId its owner, in the caller's transaction. */
  async createWithOwner(
    tx: Db,
    input: {
      id: string;
      name: string;
      slug: string;
      currency: Currency;
      usdLbpRate?: string;
      baselineOrdersPerDay?: number;
      baselineConfirmMinutes?: number;
      userId: string;
    },
  ) {
    const shop = await tx.shop.create({
      data: {
        id: input.id,
        name: input.name,
        slug: input.slug,
        currency: input.currency,
        usdLbpRate: input.usdLbpRate ? new Prisma.Decimal(input.usdLbpRate) : null,
        baselineOrdersPerDay: input.baselineOrdersPerDay ?? null,
        baselineConfirmMinutes: input.baselineConfirmMinutes ?? null,
      },
    });
    await tx.membership.create({
      data: { id: crypto.randomUUID(), shopId: shop.id, userId: input.userId, role: "owner" },
    });
    return shop;
  },

  /** Settings, theme and logo. The shop row is the tenant itself, so shopId is its id. */
  update(shopId: string, data: ShopChanges, client: Db = db) {
    return client.shop.update({ where: { id: shopId }, data });
  },
};

export type ShopChanges = Partial<{
  name: string;
  usdLbpRate: string;
  deliveryFeeMinor: bigint;
  codToleranceMinor: bigint;
  autoCancelHours: number | null;
  whatsappPhone: string | null;
  language: "en" | "ar";
  baselineOrdersPerDay: number | null;
  baselineConfirmMinutes: number | null;
  theme: Theme;
  logo: string | null;
  tagline: string | null;
  about: string | null;
  shippingInfo: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  logoMode: string;
  homeSection: string;
  showTestimonials: boolean;
}>;
