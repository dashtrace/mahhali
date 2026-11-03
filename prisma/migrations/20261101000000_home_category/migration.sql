-- The home page highlight can show one of the shop's own categories, and new
-- shops start on their first category. Existing shops keep their choice.
ALTER TABLE "shop" DROP CONSTRAINT "shop_home_section_known";
ALTER TABLE "shop" ADD CONSTRAINT "shop_home_section_known" CHECK ("homeSection" IN ('bestsellers', 'new', 'featured', 'category', 'hidden'));

ALTER TABLE "shop" ADD COLUMN "homeCategoryId" TEXT,
ALTER COLUMN "homeSection" SET DEFAULT 'category';
