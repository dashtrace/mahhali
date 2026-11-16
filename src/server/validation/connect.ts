import { z } from "./zod";

// Connecting an AI assistant: the shop the user picks on /connect/shop.
export const ChooseShopBody = z.strictObject({ shopId: z.string().min(1).max(64) }).openapi("ChooseShopBody");

export const RevokeConnectionBody = z
  .strictObject({
    clientId: z.string().min(1).max(128),
    /** Another member's connection (owner only); your own when left out. */
    userId: z.string().min(1).max(64).optional(),
  })
  .openapi("RevokeConnectionBody");

export type ChooseShopInput = z.infer<typeof ChooseShopBody>;
export type RevokeConnectionInput = z.infer<typeof RevokeConnectionBody>;
