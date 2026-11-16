-- Optional CTA text and in-shop destination. Null preserves the existing catalogue link.
ALTER TABLE "hero_slide"
ADD COLUMN "ctaLabel" TEXT,
ADD COLUMN "ctaCategoryId" TEXT,
ADD COLUMN "ctaCollectionId" TEXT,
ADD COLUMN "ctaSectionId" TEXT;
