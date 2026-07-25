-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PARTIAL', 'PAID');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('ADJUST', 'SALE', 'RETURN', 'OPENING');

-- AlterTable ItemMaster
ALTER TABLE "ItemMaster" ADD COLUMN "trackStock" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ItemMaster" ADD COLUMN "stockQty" DECIMAL(14,3) NOT NULL DEFAULT 0;

-- AlterTable Invoice
ALTER TABLE "Invoice" ADD COLUMN "amountPaid" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "Invoice" ADD COLUMN "balanceDue" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "Invoice" ADD COLUMN "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID';
ALTER TABLE "Invoice" ADD COLUMN "dueDate" TIMESTAMP(3);

-- Backfill paid invoices (existing finalized with payments = grand total)
UPDATE "Invoice" i
SET
  "amountPaid" = COALESCE((
    SELECT SUM(p."amount") FROM "InvoicePayment" p WHERE p."invoiceId" = i."id"
  ), 0),
  "balanceDue" = GREATEST(0, i."grandTotal" - COALESCE((
    SELECT SUM(p."amount") FROM "InvoicePayment" p WHERE p."invoiceId" = i."id"
  ), 0));

UPDATE "Invoice"
SET "paymentStatus" = CASE
  WHEN "amountPaid" <= 0 THEN 'UNPAID'::"PaymentStatus"
  WHEN "balanceDue" <= 0.01 THEN 'PAID'::"PaymentStatus"
  ELSE 'PARTIAL'::"PaymentStatus"
END;

-- CreateTable StockMovement
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "qtyDelta" DECIMAL(14,3) NOT NULL,
    "qtyAfter" DECIMAL(14,3) NOT NULL,
    "note" TEXT,
    "invoiceId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StockMovement_tenantId_itemId_createdAt_idx" ON "StockMovement"("tenantId", "itemId", "createdAt");
CREATE INDEX "StockMovement_tenantId_createdAt_idx" ON "StockMovement"("tenantId", "createdAt");
CREATE INDEX "Invoice_tenantId_paymentStatus_idx" ON "Invoice"("tenantId", "paymentStatus");
CREATE INDEX "Invoice_tenantId_dueDate_idx" ON "Invoice"("tenantId", "dueDate");

ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ItemMaster"("id") ON DELETE CASCADE ON UPDATE CASCADE;
