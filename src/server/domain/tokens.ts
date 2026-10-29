import { createHash, randomBytes } from "node:crypto";

/** An unguessable token for links sent to customers (tracking, reviews, invites). */
export function randomToken(bytes = 24): string {
  return randomBytes(bytes).toString("base64url");
}

/** Single-use tokens are stored only as this hash, like a password. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
