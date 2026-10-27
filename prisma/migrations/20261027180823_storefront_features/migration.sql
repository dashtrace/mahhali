-- CreateEnum
CREATE TYPE "TestimonialStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "order_item" ADD COLUMN     "note" TEXT;

-- AlterTable
ALTER TABLE "product" ADD COLUMN     "categoryId" TEXT,
ADD COLUMN     "customLabel" TEXT,
ADD COLUMN     "customMaxLength" INTEGER NOT NULL DEFAULT 240,
ADD COLUMN     "customPlaceholder" TEXT,
ADD COLUMN     "customRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "featured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "specs" JSONB;

-- AlterTable
ALTER TABLE "shop" ADD COLUMN     "about" TEXT,
ADD COLUMN     "facebookUrl" TEXT,
ADD COLUMN     "homeSection" TEXT NOT NULL DEFAULT 'bestsellers',
ADD COLUMN     "instagramUrl" TEXT,
ADD COLUMN     "logoMode" TEXT NOT NULL DEFAULT 'image-and-name',
ADD COLUMN     "shippingInfo" TEXT,
ADD COLUMN     "showTestimonials" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "tagline" TEXT;

-- CreateTable
CREATE TABLE "category" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hero_slide" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "kicker" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hero_slide_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "testimonial" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "TestimonialStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "moderatedAt" TIMESTAMP(3),
    "moderatedById" TEXT,

    CONSTRAINT "testimonial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "category_shopId_name_key" ON "category"("shopId", "name");

-- CreateIndex
CREATE INDEX "hero_slide_shopId_position_idx" ON "hero_slide"("shopId", "position");

-- CreateIndex
CREATE INDEX "testimonial_shopId_status_createdAt_idx" ON "testimonial"("shopId", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "product" ADD CONSTRAINT "product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category" ADD CONSTRAINT "category_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hero_slide" ADD CONSTRAINT "hero_slide_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "testimonial" ADD CONSTRAINT "testimonial_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Shop Link rules the database enforces even if application code has a bug.
ALTER TABLE "shop" ADD CONSTRAINT "shop_storefront_lengths" CHECK (
  char_length(COALESCE("tagline", '')) <= 80
  AND char_length(COALESCE("about", '')) <= 2000
  AND char_length(COALESCE("shippingInfo", '')) <= 2000
);
ALTER TABLE "shop" ADD CONSTRAINT "shop_logo_mode_known" CHECK ("logoMode" IN ('image-and-name', 'image-only', 'name-only'));
ALTER TABLE "shop" ADD CONSTRAINT "shop_home_section_known" CHECK ("homeSection" IN ('bestsellers', 'new', 'featured', 'hidden'));
ALTER TABLE "hero_slide" ADD CONSTRAINT "hero_slide_lengths" CHECK (
  char_length("title") BETWEEN 1 AND 80
  AND char_length(COALESCE("kicker", '')) <= 40
  AND char_length(COALESCE("body", '')) <= 160
);
ALTER TABLE "category" ADD CONSTRAINT "category_name_length" CHECK (char_length("name") BETWEEN 1 AND 40);
ALTER TABLE "product" ADD CONSTRAINT "product_custom_lengths" CHECK (
  char_length(COALESCE("customLabel", '')) <= 80
  AND char_length(COALESCE("customPlaceholder", '')) <= 120
);
ALTER TABLE "product" ADD CONSTRAINT "product_custom_max_length_range" CHECK ("customMaxLength" BETWEEN 1 AND 500);
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_note_length" CHECK (char_length(COALESCE("note", '')) <= 500);
ALTER TABLE "testimonial" ADD CONSTRAINT "testimonial_lengths" CHECK (
  char_length("authorName") BETWEEN 1 AND 60
  AND char_length("message") BETWEEN 10 AND 1000
);
