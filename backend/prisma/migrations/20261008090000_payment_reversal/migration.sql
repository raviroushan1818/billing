-- Payment reversal: a wrong entry is marked reversed (never deleted) with who,
-- when and why. Reversed rows are excluded from paid totals and reports.
ALTER TABLE "InvoicePayment" ADD COLUMN IF NOT EXISTS "reversedAt" TIMESTAMP(3);
ALTER TABLE "InvoicePayment" ADD COLUMN IF NOT EXISTS "reversedById" TEXT;
ALTER TABLE "InvoicePayment" ADD COLUMN IF NOT EXISTS "reversalReason" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'InvoicePayment_reversedById_fkey'
  ) THEN
    ALTER TABLE "InvoicePayment"
      ADD CONSTRAINT "InvoicePayment_reversedById_fkey"
      FOREIGN KEY ("reversedById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
