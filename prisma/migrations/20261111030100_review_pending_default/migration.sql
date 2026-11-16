-- New verified-buyer reviews wait for shop moderation.
ALTER TABLE "review" ALTER COLUMN "status" SET DEFAULT 'PENDING';
