import { Phone } from "./common";
import { z } from "./zod";

/** A link token from a customer URL: /t/{token} or /r/{token}. */
export const TokenParam = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{16,128}$/, "Not a valid link") });

export const TrackBody = z
  .object({
    number: z.number().int().min(1).max(2_147_483_647).openapi({ example: 1042 }),
    phone: Phone,
  })
  .openapi("TrackOrderBody");

export type TrackInput = z.infer<typeof TrackBody>;
