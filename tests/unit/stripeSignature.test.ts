import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyStripeSignature } from "@/server/domain/stripeSignature";

const secret = "whsec_test_secret";
const payload = JSON.stringify({ id: "evt_1", type: "checkout.session.completed" });
const now = 1_800_000_000;
const sign = (t: number, body = payload, key = secret) =>
  createHmac("sha256", key).update(`${t}.${body}`).digest("hex");

describe("verifyStripeSignature", () => {
  it("accepts a correct signature", () => {
    expect(verifyStripeSignature(payload, `t=${now},v1=${sign(now)}`, secret, now)).toBe(true);
  });

  it("accepts when any of several v1 signatures matches (secret rotation)", () => {
    const header = `t=${now},v1=${sign(now, payload, "old")},v1=${sign(now)},v0=abc`;
    expect(verifyStripeSignature(payload, header, secret, now)).toBe(true);
  });

  it("refuses a changed body", () => {
    expect(verifyStripeSignature(payload + " ", `t=${now},v1=${sign(now)}`, secret, now)).toBe(false);
  });

  it("refuses the wrong secret", () => {
    expect(verifyStripeSignature(payload, `t=${now},v1=${sign(now, payload, "other")}`, secret, now)).toBe(false);
  });

  it("refuses a timestamp outside the 5-minute tolerance", () => {
    const old = now - 301;
    expect(verifyStripeSignature(payload, `t=${old},v1=${sign(old)}`, secret, now)).toBe(false);
    const recent = now - 299;
    expect(verifyStripeSignature(payload, `t=${recent},v1=${sign(recent)}`, secret, now)).toBe(true);
  });

  it("refuses missing or malformed headers", () => {
    expect(verifyStripeSignature(payload, null, secret, now)).toBe(false);
    expect(verifyStripeSignature(payload, `v1=${sign(now)}`, secret, now)).toBe(false);
    expect(verifyStripeSignature(payload, `t=${now}`, secret, now)).toBe(false);
    expect(verifyStripeSignature(payload, `t=${now},v1=zz`, secret, now)).toBe(false);
  });
});
