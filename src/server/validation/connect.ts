import { z } from "./zod";

// Connecting an AI assistant: the shop the user picks on /connect/shop.
export const ChooseShopBody = z.strictObject({ shopId: z.string().min(1).max(64) }).openapi("ChooseShopBody");

export type ChooseShopInput = z.infer<typeof ChooseShopBody>;
