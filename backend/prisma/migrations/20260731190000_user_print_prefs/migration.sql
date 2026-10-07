-- AlterTable
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "preferredPrintFormat" "PrintFormat",
  ADD COLUMN IF NOT EXISTS "preferredInvoiceTheme" "InvoiceTheme";
