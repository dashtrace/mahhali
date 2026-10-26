-- CreateEnum
CREATE TYPE "OrderSource" AS ENUM ('CATALOGUE', 'MANUAL');

-- AlterTable
ALTER TABLE "invitation" ADD COLUMN     "courierId" TEXT;

-- AlterTable
ALTER TABLE "order_event" ADD COLUMN     "note" TEXT;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "createdByUserId" TEXT,
ADD COLUMN     "customerEmail" TEXT,
ADD COLUMN     "customerName" TEXT NOT NULL,
ADD COLUMN     "customerPhone" TEXT NOT NULL,
ADD COLUMN     "failureReason" TEXT,
ADD COLUMN     "source" "OrderSource" NOT NULL DEFAULT 'CATALOGUE';

-- AlterTable
ALTER TABLE "remittance" ADD COLUMN     "recordedByUserId" TEXT;

-- AlterTable
ALTER TABLE "review" ADD COLUMN     "hiddenAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "shop" ADD COLUMN     "autoCancelHours" INTEGER,
ADD COLUMN     "baselineConfirmMinutes" INTEGER,
ADD COLUMN     "baselineOrdersPerDay" INTEGER,
ADD COLUMN     "codToleranceMinor" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "deliveryFeeMinor" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'en',
ADD COLUMN     "stripeCustomerId" TEXT,
ADD COLUMN     "stripeSubscriptionId" TEXT,
ADD COLUMN     "whatsappPhone" TEXT;

-- AlterTable
ALTER TABLE "variant" ADD COLUMN     "archived" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_courierId_fkey" FOREIGN KEY ("courierId") REFERENCES "courier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Checks Prisma cannot express: the database refuses impossible values.
ALTER TABLE "shop" ADD CONSTRAINT "shop_language_known" CHECK ("language" IN ('en', 'ar'));
ALTER TABLE "shop" ADD CONSTRAINT "shop_fees_non_negative" CHECK ("deliveryFeeMinor" >= 0 AND "codToleranceMinor" >= 0);
ALTER TABLE "shop" ADD CONSTRAINT "shop_auto_cancel_positive" CHECK ("autoCancelHours" IS NULL OR "autoCancelHours" > 0);
ALTER TABLE "orders" ADD CONSTRAINT "orders_money_non_negative" CHECK ("subtotalMinor" >= 0 AND "deliveryFeeMinor" >= 0 AND "totalMinor" >= 0 AND "codMinor" >= 0);
ALTER TABLE "orders" ADD CONSTRAINT "orders_reported_non_negative" CHECK (COALESCE("reportedUsdCents", 0) >= 0 AND COALESCE("reportedLbp", 0) >= 0);
ALTER TABLE "remittance" ADD CONSTRAINT "remittance_amounts_non_negative" CHECK ("amountUsdCents" >= 0 AND "amountLbp" >= 0);
ALTER TABLE "remittance_line" ADD CONSTRAINT "remittance_line_amounts_non_negative" CHECK ("collectedUsdCents" >= 0 AND "collectedLbp" >= 0 AND "feeMinor" >= 0);
