# Desktop and mobile hero artwork

Storefront & settings -> Hero images has a required Desktop image and an optional Mobile image on each slide. Existing slides keep their desktop image as a fallback on every screen.

The storefront uses an HTML picture element: a mobile source at viewport widths up to and including 700px, matching the existing mobile layout breakpoint, and the desktop image above that width. Browser image selection updates automatically when the viewport changes. The shared hero button retains its per-slide text and destination, with the decorative diagonal arrow removed. Carousel navigation arrows remain.

Use wide artwork such as 1920 x 900 for desktop and portrait artwork such as 1080 x 1920 for mobile. PNG, JPEG and WebP are supported, up to 3MB per image. These dimensions are guidance rather than validation requirements. Both variants use the existing cover behaviour and text overlay, so leave room for the headline and button in each artwork.

New-slide creation accepts optional multipart `mobileFile` alongside required `file`. A saved slide can replace either image independently. Removing its mobile image restores desktop fallback. The phone preview uses the saved or unsaved mobile image automatically.

Migration `20261114210000_hero_mobile_images` adds nullable `HeroSlide.mobileImageUrl`. Existing upload and replacement requests still work. POST and DELETE `/api/shop/slides/{id}/mobile-image` require the existing owner-only `shop.settings` permission. Replacement and deletion serialize through the shop lock, preserve unrelated slide fields, and remove replaced files after successful database changes. Creating a slide rolls back both uploads if validation or the slide limit rejects it; deleting a slide removes both uploaded files.

Run lint, typecheck, unit tests, and integration tests. The new integration file `hero-mobile-images.test.ts` covers creation, replacement, removal, cleanup, file validation, limits, role restrictions and tenant isolation. Manually verify saved and new-slide previews, both sides of the 700px breakpoint, desktop fallback, custom button destinations and carousel rotation.
