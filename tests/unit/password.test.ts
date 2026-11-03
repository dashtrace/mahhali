import { describe, expect, it } from "vitest";
import { passwordProblem } from "@/server/domain/password";

describe("passwordProblem", () => {
  it("explains each kind of weak password", () => {
    expect(passwordProblem("short1")).toBe("Short");
    expect(passwordProblem("12345678")).toBe("Common");
    expect(passwordProblem("Password")).toBe("Common");
    expect(passwordProblem("13572468")).toBe("NoLetter");
    expect(passwordProblem("abcdefgh")).toBe("NoDigitOrSymbol");
  });

  it("accepts a letter with a digit, a symbol or a space, in any script", () => {
    expect(passwordProblem("correct-horse-battery")).toBeNull();
    expect(passwordProblem("demo-pass-2026")).toBeNull();
    expect(passwordProblem("two words here")).toBeNull();
    expect(passwordProblem("كلمةسر2026")).toBeNull();
  });
});
