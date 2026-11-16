-- Preserve all existing PUBLISHED/HIDDEN reviews unchanged.
ALTER TYPE "ReviewStatus" ADD VALUE IF NOT EXISTS 'PENDING';
