-- Payment ledger: who received each payment, when, receipt no, balance after,
-- and whether it was taken on the bill or later against the balance due.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentStage') THEN
    CREATE TYPE "PaymentStage" AS ENUM ('AT_BILLING', 'DUE_COLLECTION');
  END IF;
END $$;

ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "settledAt" TIMESTAMP(3);

ALTER TABLE "InvoicePayment" ADD COLUMN IF NOT EXISTS "receiptNo" TEXT;
ALTER TABLE "InvoicePayment" ADD COLUMN IF NOT EXISTS "stage" "PaymentStage" NOT NULL DEFAULT 'AT_BILLING';
ALTER TABLE "InvoicePayment" ADD COLUMN IF NOT EXISTS "balanceAfter" DECIMAL(14,2);
ALTER TABLE "InvoicePayment" ADD COLUMN IF NOT EXISTS "receivedById" TEXT;
ALTER TABLE "InvoicePayment" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'InvoicePayment_receivedById_fkey'
  ) THEN
    ALTER TABLE "InvoicePayment"
      ADD CONSTRAINT "InvoicePayment_receivedById_fkey"
      FOREIGN KEY ("receivedById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "InvoicePayment_tenantId_paidAt_idx"
  ON "InvoicePayment"("tenantId", "paidAt");
CREATE INDEX IF NOT EXISTS "InvoicePayment_tenantId_stage_paidAt_idx"
  ON "InvoicePayment"("tenantId", "stage", "paidAt");

-- ---------- Backfill existing payments ----------

-- Recorded time = payment time for historical rows
UPDATE "InvoicePayment" SET "createdAt" = "paidAt";

-- Payments taken more than a minute after the bill was raised/finalized were
-- collected later via "Record payment".
UPDATE "InvoicePayment" p
SET "stage" = 'DUE_COLLECTION'
FROM "Invoice" i
WHERE p."invoiceId" = i."id"
  AND p."paidAt" > COALESCE(i."finalizedAt", i."createdAt") + INTERVAL '1 minute';

-- Receiver: bill creator for at-billing payments
UPDATE "InvoicePayment" p
SET "receivedById" = i."createdById"
FROM "Invoice" i
WHERE p."invoiceId" = i."id"
  AND p."stage" = 'AT_BILLING'
  AND p."receivedById" IS NULL;

-- Receiver for later collections: matching INVOICE_PAYMENT_ADDED audit entry
UPDATE "InvoicePayment" p
SET "receivedById" = (
  SELECT a."userId"
  FROM "AuditLog" a
  WHERE a."action" = 'INVOICE_PAYMENT_ADDED'
    AND a."entityId" = p."invoiceId"
    AND a."createdAt" BETWEEN p."paidAt" - INTERVAL '2 minutes' AND p."paidAt" + INTERVAL '2 minutes'
  ORDER BY ABS(EXTRACT(EPOCH FROM (a."createdAt" - p."paidAt")))
  LIMIT 1
)
WHERE p."stage" = 'DUE_COLLECTION'
  AND p."receivedById" IS NULL;

-- Running balance + per-bill receipt numbers
WITH ordered AS (
  SELECT
    p."id",
    i."billNo",
    i."grandTotal",
    ROW_NUMBER() OVER (PARTITION BY p."invoiceId" ORDER BY p."paidAt", p."id") AS seq,
    SUM(p."amount") OVER (
      PARTITION BY p."invoiceId" ORDER BY p."paidAt", p."id"
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS paid_to_date
  FROM "InvoicePayment" p
  JOIN "Invoice" i ON i."id" = p."invoiceId"
)
UPDATE "InvoicePayment" p
SET
  "receiptNo" = COALESCE(p."receiptNo", o."billNo" || '/R' || o.seq),
  "balanceAfter" = GREATEST(0, o."grandTotal" - o.paid_to_date)
FROM ordered o
WHERE p."id" = o."id";

-- Settlement date for fully-paid bills = last payment time
UPDATE "Invoice" i
SET "settledAt" = COALESCE(
  (SELECT MAX(p."paidAt") FROM "InvoicePayment" p WHERE p."invoiceId" = i."id"),
  i."finalizedAt",
  i."createdAt"
)
WHERE i."paymentStatus" = 'PAID' AND i."settledAt" IS NULL;
