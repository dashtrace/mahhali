import { describe, expect, it } from "vitest";
import { emailTypo } from "@/server/domain/email";

describe("emailTypo", () => {
  it("fixes any ending of single-domain providers", () => {
    expect(emailTypo("fatima@gmail.cam")).toBe("fatima@gmail.com");
    expect(emailTypo("Fatima@GMAIL.co")).toBe("Fatima@gmail.com");
    expect(emailTypo("a@icloud.con")).toBe("a@icloud.com");
  });

  it("fixes misspelt provider names, keeping a real country ending", () => {
    expect(emailTypo("a@gmial.com")).toBe("a@gmail.com");
    expect(emailTypo("a@hotmial.fr")).toBe("a@hotmail.fr");
    expect(emailTypo("a@yaho.cam")).toBe("a@yahoo.com");
  });

  it("fixes only slips of .com for providers with country domains", () => {
    expect(emailTypo("a@hotmail.con")).toBe("a@hotmail.com");
    expect(emailTypo("a@outlook.cam")).toBe("a@outlook.com");
    expect(emailTypo("a@hotmail.fr")).toBeNull();
    expect(emailTypo("a@yahoo.co.uk")).toBeNull();
  });

  it("leaves correct and unknown domains alone", () => {
    expect(emailTypo("fatima@gmail.com")).toBeNull();
    expect(emailTypo("a@mail.com")).toBeNull();
    expect(emailTypo("a@email.com")).toBeNull();
    expect(emailTypo("a@ymail.com")).toBeNull();
    expect(emailTypo("a@shop.cam")).toBeNull();
    expect(emailTypo("not-an-email")).toBeNull();
  });
});
