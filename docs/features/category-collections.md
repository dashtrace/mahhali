# Optional category collections and sections

A shop can use Category -> Collection -> Section, with a maximum of 30 collections per category and 30 sections per collection. Both new levels are optional. Names are owner-defined; there are no perfume-specific values in the application.

## Owner workflow

1. Products -> Categories: create or keep a category.
2. Choose **Manage collections** beside the category. Add, rename, reorder or remove its collections.
3. Expand **Section** under a collection to manage its sections.
4. Add/edit a product -> **Display**. Choose its category, optional collection and optional section, then save.

Example configuration:

| Category | Collection | Sections |
| --- | --- | --- |
| Sense Exclusive Products | Signature Perfumes | For Him, For Her |
| Sense Exclusive Products | Musk Collection | Optional owner-defined sections |
| Sense Exclusive Products | Mist & Lotion | Body Mist, Body Lotion |
| Recreation Perfumes | AURA | Men, Women, Unisex |

A product has one category, at most one collection and at most one section. To use the same section names in several collections, create them under each collection. Clearing/changing a parent clears omitted descendants; an explicit invalid combination is rejected. Ordinary product edits preserve existing assignments.

## Storefront

The circular home category shortcuts and existing shop filter row are retained. Selecting a category with collections displays a collection pill row. Selecting a collection with sections displays a section pill row. All collections/All sections clears that level and lower levels. Category listings include products assigned anywhere within that category, including products without collections.

URLs use `cat`, `collection`, `section`, plus the existing search, price, sort and pagination parameters. Search/price/sort preserve the hierarchy; changing a parent clears lower filters and resets pagination. Unknown or mismatched URL IDs are ignored by the listing page. Product counts and pagination use the intersection of the active filters.

## Compatibility and persistence

Migration `20261114190000_category_collections_sections` adds two tables and two nullable product foreign keys. It does not move, rename or delete existing categories/products. Existing import calls continue creating category-only products. Removing a section clears only that assignment; removing a collection clears its section assignments too; products retain their category. Removing a category leaves its products uncategorised, as before.

New mutations use existing `product.write` access (owner/manager); category reads use `product.read`. Repository lookups are scoped by shopId, and service checks verify every parent-child assignment. Per-shop locking serializes hierarchy writes, category deletion and product assignment changes. OpenAPI and ERD outputs include the additions.

## Validation

Run Prisma generation and the standard lint, typecheck, unit and integration checks. Integration tests require a separate disposable `TEST_DATABASE_URL`; the project's test setup truncates that database. Then manually check category management, product assignments, circular shortcuts, all three filter levels, search/price/pagination, an existing category-only shop, and a narrow mobile viewport.
