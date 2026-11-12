-- CreateTable
CREATE TABLE "import_photo_link" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_photo_link_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "import_photo_link_importId_key" ON "import_photo_link"("importId");

-- CreateIndex
CREATE UNIQUE INDEX "import_photo_link_tokenHash_key" ON "import_photo_link"("tokenHash");

-- CreateIndex
CREATE INDEX "import_photo_link_shopId_idx" ON "import_photo_link"("shopId");

-- AddForeignKey
ALTER TABLE "import_photo_link" ADD CONSTRAINT "import_photo_link_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_photo_link" ADD CONSTRAINT "import_photo_link_importId_fkey" FOREIGN KEY ("importId") REFERENCES "product_import"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_photo_link" ADD CONSTRAINT "import_photo_link_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A link always expires after it was made.
ALTER TABLE "import_photo_link" ADD CONSTRAINT "import_photo_link_expiry_check" CHECK ("expiresAt" > "createdAt");
