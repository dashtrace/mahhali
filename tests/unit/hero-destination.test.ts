import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HeroCarousel } from "@/app/s/[slug]/_components/HeroCarousel";
import { heroDestination, type HeroCategory } from "@/app/s/[slug]/_components/heroDestination";
import { applyDraft, NEW_SLIDE } from "@/app/preview/storefront/draft";

Object.assign(globalThis, { React });
const categories: HeroCategory[] = [{ id: "sense", name: "Sense", collections: [
  { id: "mist", name: "Mist & Lotion", sections: [{ id: "body", name: "Body Mist" }] },
  { id: "musk", name: "Musk", sections: [] },
] }];
const target = { ctaCategoryId: "sense", ctaCollectionId: "mist", ctaSectionId: "body" };
const slide: React.ComponentProps<typeof HeroCarousel>["slides"][number] = { id: "one", imageUrl: "/one.png", kicker: null, title: "Discover", body: null };
const href = "/s/demo/shop";

describe("hero slide destinations", () => {
  it("keeps legacy slides linked to the full catalogue", () => {
    expect(heroDestination(href, {}, categories)).toBe(href);
    const html = renderToStaticMarkup(React.createElement(HeroCarousel, { slides: [slide], shopHref: href, shopName: "Demo", locale: "en" }));
    expect(html).toContain(`href="${href}"`);
    expect(html).toContain("Shop now");
  });
  it("builds category, collection and section links with the existing listing filters", () => {
    expect(heroDestination(href, { ctaCategoryId: "sense" }, categories)).toBe(href + "?cat=sense");
    expect(heroDestination(href, { ...target, ctaSectionId: null }, categories)).toBe(href + "?cat=sense&collection=mist");
    expect(heroDestination(href, target, categories)).toBe(href + "?cat=sense&collection=mist&section=body");
  });
  it("falls back to the closest surviving parent for deleted or mismatched targets", () => {
    expect(heroDestination(href, { ...target, ctaSectionId: "deleted" }, categories)).toBe(href + "?cat=sense&collection=mist");
    expect(heroDestination(href, { ...target, ctaCollectionId: "deleted" }, categories)).toBe(href + "?cat=sense");
    expect(heroDestination(href, { ...target, ctaCategoryId: "foreign" }, categories)).toBe(href);
    expect(heroDestination(href, { ...target, ctaCollectionId: "musk" }, categories)).toBe(href + "?cat=sense&collection=musk");
    expect(heroDestination(href, target, [])).toBe(href);
  });
  it("shows the slide's own label and destination on the single active button", () => {
    const html = renderToStaticMarkup(React.createElement(HeroCarousel, { slides: [{ ...slide, ...target, ctaLabel: "Explore Body Mists" }], categories, shopHref: href, shopName: "Demo", locale: "en" }));
    expect(html).toContain("Explore Body Mists");
    expect(html).toContain("?cat=sense&amp;collection=mist&amp;section=body");
    expect(html.match(/class="sl-hero-cta"/g)).toHaveLength(1);
  });
  it("provides the mobile picture source at the same 700px breakpoint as the mobile layout", () => {
    const html = renderToStaticMarkup(React.createElement(HeroCarousel, { slides: [{ ...slide, mobileImageUrl: "/phone.png" }], shopHref: href, shopName: "Demo", locale: "en" }));
    expect(html).toContain('<source media="(max-width: 700px)" srcSet="/phone.png"');
    expect(html).toContain('src="/one.png"');
    expect(html).toContain('class="sl-fade sl-hero-photo"');
  });
  it("keeps one desktop fallback image for existing slides and removes only the CTA arrow", () => {
    for (const slides of [[slide], []]) {
      const html = renderToStaticMarkup(React.createElement(HeroCarousel, { slides, shopHref: href, shopName: "Demo", locale: "en" }));
      expect(html).not.toContain("<source");
      const button = html.match(/<a[^>]*class="sl-hero-cta"[^>]*>(.*?)<\/a>/)?.[1];
      expect(button).toContain("Shop now");
      expect(button).not.toContain("<svg");
    }
  });
  it("carries a portrait image through both existing-slide and new-slide previews", () => {
    const shop = { slides: [slide], locale: "en" as const };
    const draft = applyDraft(shop, { slides: { one: { mobileImageUrl: "blob:phone" }, [NEW_SLIDE]: { imageUrl: "blob:wide", mobileImageUrl: "blob:new-phone" } } });
    expect(draft.slides[0].mobileImageUrl).toBe("blob:phone");
    expect(draft.slides[1].mobileImageUrl).toBe("blob:new-phone");
    expect(applyDraft(draft, { slides: { one: { mobileImageUrl: null } } }).slides[0].mobileImageUrl).toBeNull();
  });
  it("uses the storefront language when a custom label is blank", () => {
    const html = renderToStaticMarkup(React.createElement(HeroCarousel, { slides: [{ ...slide, ctaLabel: "  " }], shopHref: href, shopName: "Demo", locale: "ar" }));
    expect(html).toContain("تسوّق الآن");
  });
  it("carries unsaved CTA edits and a new slide through the live-preview draft", () => {
    const shop = { slides: [slide], locale: "en" as const };
    const out = applyDraft(shop, { slides: { one: { ...target, ctaLabel: "Explore" }, [NEW_SLIDE]: { imageUrl: "blob:preview", title: "New", ...target, ctaLabel: "Mists" } } });
    expect(out.slides[0]).toMatchObject({ ...target, ctaLabel: "Explore" });
    expect(heroDestination(href, out.slides[0], categories)).toBe(href + "?cat=sense&collection=mist&section=body");
    expect(out.slides[1]).toMatchObject({ id: NEW_SLIDE, ctaLabel: "Mists" });
    expect(shop.slides).toEqual([slide]);
  });
});
