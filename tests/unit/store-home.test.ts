import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StoreHome } from "@/app/s/[slug]/_components/StoreHome";
import type { StoreData } from "@/app/s/[slug]/_components/load";

// Vitest compiles JSX to React.createElement here; Next uses the automatic runtime.
Object.assign(globalThis, { React });

const product = (id: string, categoryId: string | null = null) =>
  ({
    id,
    name: `Product ${id}`,
    description: null,
    categoryId,
    categoryName: null,
    featured: false,
    soldCount: 0,
    createdAt: "2026-11-01T00:00:00.000Z",
    rating: { average: 0, count: 0 },
    images: [{ url: `/uploads/${id}.jpg`, optionValue: null }],
    variants: [{ id: `${id}-v`, priceMinor: 1000, inStock: true }],
  }) as unknown as StoreData["products"][number];

const testimonial = (id: string) => ({ id, authorName: `Author ${id}`, message: `Message from ${id}`, createdAt: "2026-11-01T00:00:00.000Z" }) as StoreData["testimonials"][number];

const empty = {
  name: "Corner",
  slug: "corner",
  logo: null,
  currency: "USD",
  theme: null,
  language: "en",
  locale: "en",
  whatsappPhone: null,
  deliveryFeeMinor: 0,
  tagline: null,
  about: null,
  shippingInfo: null,
  instagramUrl: null,
  facebookUrl: null,
  logoMode: "name-only",
  homeSection: "new",
  homeCategoryId: null,
  showTestimonials: true,
  slides: [],
  categories: [],
} as unknown as StoreData["shop"];

function render(shop: Partial<StoreData["shop"]> = {}, products: StoreData["products"] = [], testimonials: StoreData["testimonials"] = []) {
  return renderToStaticMarkup(createElement(StoreHome, { shop: { ...empty, ...shop }, products, testimonials }));
}

describe("StoreHome", () => {
  it("shows only the hero, the coming-soon state and the feedback form for an empty shop", () => {
    const html = render();
    expect(html).toContain("Products are coming soon");
    expect(html).toContain("We&#x27;d love to hear from you");
    for (const absent of ["home-categories", "home-highlight", "home-story", "home-shipping", "home-testimonials", "home-stay", "home-contact"]) {
      expect(html).not.toContain(absent);
    }
  });

  it("keeps the agreed section order", () => {
    const html = render(
      { about: "Our tale.", shippingInfo: "Two days.", whatsappPhone: "+96171123456", categories: [{ id: "c1", name: "Bags", productCount: 1 }] },
      [product("p1", "c1")],
      [testimonial("t1")],
    );
    const order = ["home-categories", "home-highlight", "home-story-title", "home-shipping", "home-testimonials-title", "home-feedback", "home-stay", "home-contact"].map((id) =>
      html.indexOf(`id="${id}"`),
    );
    expect(order.every((at) => at >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("hides the links to a section along with the section", () => {
    const withAll = render({ about: "Our tale." }, [product("p1")], [testimonial("t1")]);
    expect(withAll).toContain('href="#home-story"');
    expect(withAll).toContain('href="#home-testimonials"');

    const noAbout = render({}, [product("p1")], [testimonial("t1")]);
    expect(noAbout).not.toContain('href="#home-story"');

    const noneApproved = render({ about: "Our tale." }, [product("p1")]);
    expect(noneApproved).not.toContain('href="#home-testimonials"');

    const switchedOff = render({ about: "Our tale.", showTestimonials: false }, [product("p1")], [testimonial("t1")]);
    expect(switchedOff).not.toContain("home-testimonials");
  });

  it("uses a product photo for a category, or its initial without one", () => {
    const categories = [
      { id: "c1", name: "Bags", productCount: 1 },
      { id: "c2", name: "Shoes", productCount: 0 },
    ];
    const html = render({ categories }, [product("p1", "c1")]);
    expect(html).toContain('src="/uploads/p1.jpg" alt="" loading="lazy" class="size-full');
    expect(html).toMatch(/>S<\/span><span[^>]*>Shoes/);
  });

  it("shows the band for WhatsApp or Instagram, and the contact section for Facebook too", () => {
    const facebookOnly = render({ facebookUrl: "https://www.facebook.com/corner" });
    expect(facebookOnly).not.toContain("home-stay");
    expect(facebookOnly).toContain("home-contact");
    expect(facebookOnly).not.toContain("Not set up yet");

    const instagramOnly = render({ instagramUrl: "https://www.instagram.com/corner" });
    expect(instagramOnly).toContain("home-stay");

    const unsafe = render({ instagramUrl: "http://www.instagram.com/corner" });
    expect(unsafe).not.toContain("home-stay");
    expect(unsafe).not.toContain("home-contact");
  });

  it("has no email field in the stay-in-touch band", () => {
    expect(render({ whatsappPhone: "+96171123456" })).not.toMatch(/type="email"/);
  });

  it("repeats testimonials only for the marquee, with the copy hidden from assistive tech", () => {
    const few = render({}, [], ["a", "b", "c", "d"].map(testimonial));
    expect(few).not.toContain("sl-marquee");

    const many = render({}, [], ["a", "b", "c", "d", "e"].map(testimonial));
    expect(many).toContain("sl-marquee-track");
    expect(many).toMatch(/<ul aria-hidden="true"/);
    expect(many.match(/Message from a/g)).toHaveLength(2);
  });

  it("renders in Arabic", () => {
    const html = render({ locale: "ar", about: "قصة", whatsappPhone: "+96171123456" }, [product("p1")]);
    expect(html).toContain("قصتنا");
    expect(html).toContain("ابقَ على تواصل");
  });
});
