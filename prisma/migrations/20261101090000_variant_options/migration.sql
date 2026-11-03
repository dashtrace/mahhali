-- Variant options per product: up to three names (e.g. "Size", "SPF"). Each variant holds
-- one value per option, by position, "" when blank. NOT NULL keeps two blank variants
-- duplicates under the unique index, as NULLS NOT DISTINCT did.
ALTER TABLE "product" ADD COLUMN "options" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "variant" ADD COLUMN "optionValues" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Size and Colour become options of products whose variants (hidden ones too) use them,
-- in that order so item labels read as before, named in the shop's customer language.
WITH used AS (
  SELECT "productId", bool_or("size" IS NOT NULL) AS size_used, bool_or("colour" IS NOT NULL) AS colour_used
  FROM "variant" GROUP BY "productId"
)
UPDATE "product" p
SET "options" = array_remove(ARRAY[
  CASE WHEN u.size_used THEN CASE WHEN s."language" = 'ar' THEN 'المقاس' ELSE 'Size' END END,
  CASE WHEN u.colour_used THEN CASE WHEN s."language" = 'ar' THEN 'اللون' ELSE 'Colour' END END
], NULL)
FROM used u, "shop" s
WHERE u."productId" = p.id AND s.id = p."shopId";

WITH used AS (
  SELECT "productId", bool_or("size" IS NOT NULL) AS size_used, bool_or("colour" IS NOT NULL) AS colour_used
  FROM "variant" GROUP BY "productId"
)
UPDATE "variant" v
SET "optionValues" = array_remove(ARRAY[
  CASE WHEN u.size_used THEN COALESCE(v."size", '') END,
  CASE WHEN u.colour_used THEN COALESCE(v."colour", '') END
], NULL)
FROM used u
WHERE u."productId" = v."productId";

DROP INDEX "variant_productId_size_colour_key";
ALTER TABLE "variant" DROP COLUMN "size", DROP COLUMN "colour";
CREATE UNIQUE INDEX "variant_productId_optionValues_key" ON "variant"("productId", "optionValues");

-- A photo can name any option value it shows, not only a colour.
ALTER TABLE "product_image" RENAME COLUMN "colour" TO "optionValue";

ALTER TABLE "product" ADD CONSTRAINT "product_options_max" CHECK (cardinality("options") <= 3);
