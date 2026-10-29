import { describe, expect, it } from "vitest";
import { firstName, reviewAuthorName } from "@/server/domain/names";

describe("customer names on public pages", () => {
  it("keeps only the first name for tracking", () => {
    expect(firstName("  Maya   Haddad ")).toBe("Maya");
    expect(firstName("Maya")).toBe("Maya");
  });

  it("signs reviews with the first name and last initial", () => {
    expect(reviewAuthorName("Maya Haddad")).toBe("Maya H.");
    expect(reviewAuthorName("maya al haddad")).toBe("maya H.");
    expect(reviewAuthorName("Maya")).toBe("Maya");
    expect(reviewAuthorName("مايا حداد")).toBe("مايا ح.");
  });
});
