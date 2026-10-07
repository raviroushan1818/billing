-- AlterEnum
ALTER TYPE "InvoiceTheme" ADD VALUE IF NOT EXISTS 'GST';

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "PrintFormat" AS ENUM ('A4', 'THERMAL_80', 'THERMAL_58');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "BrandTemplate"
  ADD COLUMN IF NOT EXISTS "printFormat" "PrintFormat" NOT NULL DEFAULT 'A4';
