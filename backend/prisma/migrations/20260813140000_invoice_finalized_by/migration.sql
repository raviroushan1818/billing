-- Track who finalized an invoice (separate from who raised / voided it)
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "finalizedById" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "finalizedAt" TIMESTAMP(3);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Invoice_finalizedById_fkey'
  ) THEN
    ALTER TABLE "Invoice"
      ADD CONSTRAINT "Invoice_finalizedById_fkey"
      FOREIGN KEY ("finalizedById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Invoice_tenantId_finalizedById_idx"
  ON "Invoice"("tenantId", "finalizedById");
