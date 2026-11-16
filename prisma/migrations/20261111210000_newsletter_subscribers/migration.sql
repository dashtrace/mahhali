-- Voluntary storefront marketing email subscriptions; scoped per shop.
CREATE TABLE "newsletter_subscriber" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "consentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "newsletter_subscriber_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "newsletter_subscriber_shopId_email_key" ON "newsletter_subscriber"("shopId", "email");
CREATE INDEX "newsletter_subscriber_shopId_createdAt_idx" ON "newsletter_subscriber"("shopId", "createdAt");
ALTER TABLE "newsletter_subscriber" ADD CONSTRAINT "newsletter_subscriber_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
