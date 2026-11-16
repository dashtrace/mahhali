-- Append-only cash receipts and explicit, attributable discrepancy resolutions.
CREATE TABLE "remittance_supplement" (
  "id" TEXT NOT NULL, "shopId" TEXT NOT NULL, "remittanceId" TEXT NOT NULL,
  "amountUsdCents" BIGINT NOT NULL DEFAULT 0, "amountLbp" BIGINT NOT NULL DEFAULT 0,
  "reason" TEXT NOT NULL, "recordedByUserId" TEXT NOT NULL, "requestKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "remittance_supplement_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "remittance_supplement_shopId_requestKey_key" ON "remittance_supplement"("shopId", "requestKey");
CREATE INDEX "remittance_supplement_shopId_remittanceId_idx" ON "remittance_supplement"("shopId", "remittanceId");
ALTER TABLE "remittance_supplement" ADD CONSTRAINT "remittance_supplement_shopId_fkey"
  FOREIGN KEY ("shopId") REFERENCES "shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "remittance_supplement" ADD CONSTRAINT "remittance_supplement_remittanceId_fkey"
  FOREIGN KEY ("remittanceId") REFERENCES "remittance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "remittance_supplement" ADD CONSTRAINT "remittance_supplement_positive_amount_chk"
  CHECK ("amountUsdCents" >= 0 AND "amountLbp" >= 0 AND ("amountUsdCents" > 0 OR "amountLbp" > 0));

CREATE TABLE "remittance_resolution" (
  "id" TEXT NOT NULL, "shopId" TEXT NOT NULL, "remittanceId" TEXT NOT NULL,
  "reason" TEXT NOT NULL, "recordedByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "remittance_resolution_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "remittance_resolution_remittanceId_key" ON "remittance_resolution"("remittanceId");
ALTER TABLE "remittance_resolution" ADD CONSTRAINT "remittance_resolution_shopId_fkey"
  FOREIGN KEY ("shopId") REFERENCES "shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "remittance_resolution" ADD CONSTRAINT "remittance_resolution_remittanceId_fkey"
  FOREIGN KEY ("remittanceId") REFERENCES "remittance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "order_cash_resolution" (
  "id" TEXT NOT NULL, "shopId" TEXT NOT NULL, "orderId" TEXT NOT NULL,
  "reason" TEXT NOT NULL, "recordedByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "order_cash_resolution_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "order_cash_resolution_orderId_key" ON "order_cash_resolution"("orderId");
ALTER TABLE "order_cash_resolution" ADD CONSTRAINT "order_cash_resolution_shopId_fkey"
  FOREIGN KEY ("shopId") REFERENCES "shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_cash_resolution" ADD CONSTRAINT "order_cash_resolution_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
