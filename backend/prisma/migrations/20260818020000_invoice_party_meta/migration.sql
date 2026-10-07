-- Hospital / clinic patient snapshot on invoices (age, gender, care of).
ALTER TABLE "Invoice" ADD COLUMN "partyMeta" JSONB NOT NULL DEFAULT '{}';
