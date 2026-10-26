-- AlterTable
ALTER TABLE "stock_movement" ADD COLUMN     "note" TEXT;

-- Two variants with an empty size (or colour) are duplicates too. Postgres treats
-- NULLs as distinct by default, so rebuild the unique index without that.
DROP INDEX "variant_productId_size_colour_key";
CREATE UNIQUE INDEX "variant_productId_size_colour_key" ON "variant"("productId", "size", "colour") NULLS NOT DISTINCT;
