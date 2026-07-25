-- AlterTable InvoiceLine: per-line godown for sales stock
ALTER TABLE "InvoiceLine" ADD COLUMN IF NOT EXISTS "godownId" TEXT;
CREATE INDEX IF NOT EXISTS "InvoiceLine_godownId_idx" ON "InvoiceLine"("godownId");
DO $$ BEGIN
  ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_godownId_fkey"
    FOREIGN KEY ("godownId") REFERENCES "Godown"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Purchase ITC tracking
ALTER TABLE "PurchaseBill" ADD COLUMN IF NOT EXISTS "itcEligible" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PurchaseBill" ADD COLUMN IF NOT EXISTS "itcCgst" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "PurchaseBill" ADD COLUMN IF NOT EXISTS "itcSgst" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "PurchaseBill" ADD COLUMN IF NOT EXISTS "itcIgst" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "PurchaseBill" ADD COLUMN IF NOT EXISTS "itcNotes" TEXT;
CREATE INDEX IF NOT EXISTS "PurchaseBill_tenantId_itcEligible_idx" ON "PurchaseBill"("tenantId", "itcEligible");
