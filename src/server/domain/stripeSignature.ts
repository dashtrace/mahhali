import { createHmac, timingSafeEqual } from "node:crypto";

const TOLERANCE_SECONDS = 5 * 60;

/**
 * Checks a Stripe-Signature header ("t=1700000000,v1=hex,v1=hex") against the
 * raw request body: v1 is HMAC-SHA256 of "t.body" with the endpoint secret.
 * Old timestamps are refused so a captured request cannot be replayed later.
 */
export function verifyStripeSignature(
  payload: string,
  header: string | null,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  if (!header) return false;
  let timestamp = "";
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const [key, value = ""] = part.trim().split("=", 2);
    if (key === "t") timestamp = value;
    if (key === "v1") signatures.push(value);
  }
  if (!/^\d+$/.test(timestamp) || Math.abs(nowSeconds - Number(timestamp)) > TOLERANCE_SECONDS) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest();
  return signatures.some((sig) => {
    const given = Buffer.from(sig, "hex");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}
