-- AlterTable
ALTER TABLE "product" ADD COLUMN     "collectionId" TEXT,
ADD COLUMN     "sectionId" TEXT;

-- CreateTable
CREATE TABLE "product_collection" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "product_collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_section" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "product_section_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_collection_shopId_categoryId_position_idx" ON "product_collection"("shopId", "categoryId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "product_collection_shopId_categoryId_name_key" ON "product_collection"("shopId", "categoryId", "name");

-- CreateIndex
CREATE INDEX "product_section_shopId_collectionId_position_idx" ON "product_section"("shopId", "collectionId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "product_section_shopId_collectionId_name_key" ON "product_section"("shopId", "collectionId", "name");

-- CreateIndex
CREATE INDEX "product_shopId_categoryId_collectionId_sectionId_idx" ON "product"("shopId", "categoryId", "collectionId", "sectionId");

-- AddForeignKey
ALTER TABLE "product" ADD CONSTRAINT "product_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "product_collection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product" ADD CONSTRAINT "product_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "product_section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_collection" ADD CONSTRAINT "product_collection_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_collection" ADD CONSTRAINT "product_collection_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_section" ADD CONSTRAINT "product_section_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_section" ADD CONSTRAINT "product_section_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "product_collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
