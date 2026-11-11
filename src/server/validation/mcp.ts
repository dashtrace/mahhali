import { z } from "./zod";

// Inputs of the tools AI assistants call on /api/mcp. Strict: an unknown field
// (a shopId, a role) is refused rather than ignored, since the shop and role
// come only from the access token.

export const ShopInfoInput = z.strictObject({});
