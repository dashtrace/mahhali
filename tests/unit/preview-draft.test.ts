import { describe, expect, it } from "vitest";
import { themeVars } from "@/app/_server/theme";
import { NEW_SLIDE, applyDraft } from "@/app/preview/storefront/draft";

const slide = { id: "a", imageUrl: "/a.png", kicker: "K", title: "T", body: null };
const shop = { name: "Shop", theme: { primary: "#1e3a8a" }, slides: [slide], locale: "en" as const };

describe("applyDraft", () => {
  it("leaves the shop as saved without a draft", () => {
    expect(applyDraft(shop, {})).toEqual(shop);
  });

  it("lays text and theme over the saved shop, and the theme reaches the same CSS variables", () => {
    const out = applyDraft(shop, { name: "New", theme: { primary: "#874258" } });
    expect(out.name).toBe("New");
    expect(themeVars(out.theme)).toMatchObject({ "--sl-accent": "#874258" });
  });

  it("switches language only to a known locale", () => {
    expect(applyDraft(shop, { language: "ar" }).locale).toBe("ar");
    expect(applyDraft(shop, { language: "xx" }).locale).toBe("en");
  });

  it("edits a slide, ignores one that is gone, and appends the one being added", () => {
    const out = applyDraft(shop, { slides: { a: { title: "Edited" }, gone: { title: "x" }, [NEW_SLIDE]: { imageUrl: "blob:x", title: "Added" } } });
    expect(out.slides.map((s) => s.title)).toEqual(["Edited", "Added"]);
    expect(out.slides[1].id).toBe(NEW_SLIDE);
    expect(applyDraft(shop, { slides: { [NEW_SLIDE]: null } }).slides).toEqual([slide]);
  });
});
