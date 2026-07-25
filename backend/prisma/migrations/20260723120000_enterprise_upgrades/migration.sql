-- AlterTable
CREATE TYPE "InvoiceTheme" AS ENUM ('CLASSIC', 'MODERN', 'COMPACT', 'BOLD');
CREATE TYPE "BrandAlign" AS ENUM ('LEFT', 'CENTER', 'RIGHT');

ALTER TABLE "BrandTemplate"
  ADD COLUMN "logoWidthPx" INTEGER NOT NULL DEFAULT 72,
  ADD COLUMN "bannerHeightPx" INTEGER NOT NULL DEFAULT 100,
  ADD COLUMN "invoiceTheme" "InvoiceTheme" NOT NULL DEFAULT 'CLASSIC',
  ADD COLUMN "logoAlign" "BrandAlign" NOT NULL DEFAULT 'LEFT';

CREATE TABLE "TenantIntegrationSettings" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "smtpHost" TEXT,
  "smtpPort" INTEGER,
  "smtpUser" TEXT,
  "smtpPassEnc" TEXT,
  "smtpSecure" BOOLEAN NOT NULL DEFAULT true,
  "smtpFromEmail" TEXT,
  "smtpFromName" TEXT,
  "waPhoneNumberId" TEXT,
  "waAccessTokenEnc" TEXT,
  "waApiVersion" TEXT NOT NULL DEFAULT 'v19.0',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TenantIntegrationSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TenantIntegrationSettings_tenantId_key" ON "TenantIntegrationSettings"("tenantId");

ALTER TABLE "TenantIntegrationSettings"
  ADD CONSTRAINT "TenantIntegrationSettings_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
