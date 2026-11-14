# Per-slide hero buttons

Each hero slide has an optional **Button text** and an in-shop **Button destination** in Storefront & settings -> Hero images. These fields are available when adding a slide and when editing one. The live preview uses the unsaved label and destination; Save publishes them.

The single destination dropdown offers All products plus every category, collection and section, grouped by category. Each nested option shows its full path. Selecting an option stores its category, collection and section together; selecting a parent or All products clears any lower selections. The existing storefront URL filters handle navigation. Owners choose from their own shop's taxonomy; no URL needs to be typed.

| Button text | Category | Collection | Section |
| --- | --- | --- | --- |
| Explore Musk | Sense Exclusive Products | Musk Collection | All products in this collection |
| Explore Body Mists | Sense Exclusive Products | Mist & Lotion | Body Mist |
| Discover AURA | Recreation Perfumes | AURA | All products in this collection |

Blank button text uses the translated default Shop now label. No destination means the full catalogue. Existing slides retain that behaviour after the additive migration `20261114200000_hero_slide_destinations`.

The currently active slide controls both the shared hero button's label and destination, including during autoplay and manual navigation. The fallback hero for shops without uploaded slides is unchanged.

The four nullable CTA columns hold the label and category/collection/section IDs. Like the existing home-category setting, destination IDs are checked by the service rather than linked with foreign keys. This lets a removed target fall back to its nearest surviving parent instead of breaking the banner link. The client resolver only uses the current shop's category tree. A category change clears omitted collection and section selections; a collection change clears an omitted section. Explicit mismatched or foreign targets are rejected.

Slide mutations remain owner-only (`shop.settings`). Target validation, per-shop locking and slide writes share a transaction. Ordinary text, image and order edits preserve the saved CTA. A deleted destination does not block ordinary copy edits.

Verification: lint, typecheck, unit tests (including SSR button and live-preview tests), integration tests `hero-destinations.test.ts` and `storefront.test.ts`, followed by a full integration run and manual desktop/mobile review. Integration tests require the separate disposable TEST_DATABASE_URL.
