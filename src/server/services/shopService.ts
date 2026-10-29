import { notFound, unprocessable } from "../http/errors";
import type { Actor } from "../http/withRoute";
import { toMinor, type Currency } from "../domain/money";
import { DEFAULT_THEME, PALETTES, validateTheme, type Theme } from "../domain/theme";
import { shopRepo } from "../repositories/shopRepo";
import { deleteUpload, saveUpload } from "../storage/uploads";
import type { BrandingInput, ShopSettingsInput } from "../validation/shop";

type Shop = NonNullable<Awaited<ReturnType<typeof shopRepo.findById>>>;

async function load(actor: Actor) {
  const shop = await shopRepo.findById(actor.shopId);
  if (!shop) throw notFound("Shop");
  return shop;
}

function amountMinor(amount: string, currency: Currency) {
  try {
    return toMinor(amount, currency);
  } catch {
    throw unprocessable("INVALID_AMOUNT", `Amounts in ${currency} must be whole ${currency === "LBP" ? "pounds" : "cents"}.`);
  }
}

function settingsOf(shop: Shop) {
  return {
    name: shop.name,
    slug: shop.slug,
    currency: shop.currency,
    usdLbpRate: shop.usdLbpRate,
    deliveryFeeMinor: shop.deliveryFeeMinor,
    codToleranceMinor: shop.codToleranceMinor,
    autoCancelHours: shop.autoCancelHours,
    whatsappPhone: shop.whatsappPhone,
    language: shop.language,
    baselineOrdersPerDay: shop.baselineOrdersPerDay,
    baselineConfirmMinutes: shop.baselineConfirmMinutes,
  };
}

function brandingOf(shop: Shop) {
  return { theme: (shop.theme as Theme | null) ?? DEFAULT_THEME, logo: shop.logo, palettes: PALETTES };
}

// Shop settings, theme and logo: owner only (shop.settings).
export const shopService = {
  async settings(actor: Actor) {
    return settingsOf(await load(actor));
  },

  async updateSettings(actor: Actor, input: ShopSettingsInput) {
    const { currency } = await load(actor);
    const { deliveryFee, codTolerance, ...rest } = input;
    const shop = await shopRepo.update(actor.shopId, {
      ...rest,
      ...(deliveryFee === undefined ? {} : { deliveryFeeMinor: amountMinor(deliveryFee, currency) }),
      ...(codTolerance === undefined ? {} : { codToleranceMinor: amountMinor(codTolerance, currency) }),
    });
    return settingsOf(shop);
  },

  async branding(actor: Actor) {
    return brandingOf(await load(actor));
  },

  /** A ready-made palette or custom colours; refused when text would fall below WCAG AA. */
  async updateBranding(actor: Actor, input: BrandingInput) {
    const theme: Theme = "preset" in input ? PALETTES[input.preset] : input;
    const failing = validateTheme(theme);
    if (failing.length > 0) {
      throw unprocessable("LOW_CONTRAST", "Some text would be hard to read with these colours.", failing);
    }
    return brandingOf(await shopRepo.update(actor.shopId, { theme }));
  },

  async setLogo(actor: Actor, form: FormData) {
    const old = (await load(actor)).logo;
    const logo = await saveUpload(actor.shopId, form.get("file"), "logo");
    try {
      await shopRepo.update(actor.shopId, { logo });
    } catch (error) {
      await deleteUpload(actor.shopId, logo);
      throw error;
    }
    await deleteUpload(actor.shopId, old);
    return { logo };
  },

  async removeLogo(actor: Actor) {
    const old = (await load(actor)).logo;
    await shopRepo.update(actor.shopId, { logo: null });
    await deleteUpload(actor.shopId, old);
  },
};
