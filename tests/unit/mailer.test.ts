import { describe, expect, it } from "vitest";
import { parseSender } from "@/server/mail/mailer";

describe("parseSender", () => {
  it("splits a name and address", () => {
    expect(parseSender("StoreLift <shop@gmail.com>")).toEqual({ name: "StoreLift", email: "shop@gmail.com" });
  });

  it("accepts a bare address", () => {
    expect(parseSender(" shop@gmail.com ")).toEqual({ email: "shop@gmail.com" });
  });
});
