import { describe, expect, it } from "vitest";
import { ApiError, errorMessage } from "@/lib/api";

const invalid = (message: string) => new ApiError(422, "VALIDATION", "Invalid body", [{ path: "phone", message }]);

describe("errorMessage", () => {
  it("shows a schema's own message without the technical prefix", () => {
    expect(errorMessage(invalid("Not a valid phone number"), "Failed")).toBe("Not a valid phone number");
  });

  it("replaces Zod's built-in wording with the fallback", () => {
    expect(errorMessage(invalid("Too small: expected string to have >=1 characters"), "Failed")).toBe("Failed");
    expect(errorMessage(invalid("Invalid input: expected string, received undefined"), "Failed")).toBe("Failed");
  });

  it("shows a service's message when there are no field errors", () => {
    expect(errorMessage(new ApiError(422, "DUPLICATE_CATEGORY", "A category with this name already exists."), "Failed")).toBe("A category with this name already exists.");
  });

  it("uses the fallback for anything else", () => {
    expect(errorMessage(new Error("network"), "Failed")).toBe("Failed");
  });
});
