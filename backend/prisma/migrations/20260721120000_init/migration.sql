-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'CLIENT_ADMIN', 'BILLING_OPERATOR', 'ACCOUNTANT', 'VIEWER');

-- CreateEnum
CREATE TYPE "BusinessProfile" AS ENUM ('HOSPITAL', 'SCHOOL', 'COMMERCIAL', 'CLINIC', 'RETAIL', 'GENERIC');

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'TRIAL');

-- CreateEnum
CREATE TYPE "SupplyType" AS ENUM ('B2B', 'B2C', 'B2CL');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('TAX_INVOICE', 'CREDIT_NOTE', 'DEBIT_NOTE');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'FINALIZED', 'VOID');

-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('CASH', 'UPI', 'CARD');

-- CreateEnum
CREATE TYPE "EinvoiceStatus" AS ENUM ('NOT_APPLICABLE', 'PENDING', 'PUSHED', 'FAILED');

-- CreateEnum
CREATE TYPE "MediaPurpose" AS ENUM ('LOGO', 'INVOICE_PDF', 'ATTACHMENT', 'LETTERHEAD');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "profileType" "BusinessProfile" NOT NULL DEFAULT 'GENERIC',
    "status" "TenantStatus" NOT NULL DEFAULT 'TRIAL',
    "planCode" TEXT NOT NULL DEFAULT 'STANDARD',
    "maxUsers" INTEGER NOT NULL DEFAULT 10,
    "maxInvoices" INTEGER NOT NULL DEFAULT 5000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantProfileConfig" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "profileType" "BusinessProfile" NOT NULL,
    "customFieldSchema" JSONB NOT NULL DEFAULT '{}',
    "invoiceTitle" TEXT NOT NULL DEFAULT 'TAX INVOICE',
    "partyLabel" TEXT NOT NULL DEFAULT 'Customer',
    "partyIdLabel" TEXT NOT NULL DEFAULT 'Customer Code',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantProfileConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "logoGcsKey" TEXT,
    "headerHtml" TEXT NOT NULL DEFAULT '',
    "footerHtml" TEXT NOT NULL DEFAULT '',
    "letterhead" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#0f4c81',
    "invoiceTitle" TEXT NOT NULL DEFAULT 'TAX INVOICE',
    "showGstin" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GstSettings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "gstin" TEXT,
    "legalName" TEXT NOT NULL,
    "tradeName" TEXT,
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "stateCode" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "fyStartMonth" INTEGER NOT NULL DEFAULT 4,
    "defaultGstRate" DECIMAL(5,2) NOT NULL DEFAULT 18,
    "eInvoiceEnabled" BOOLEAN NOT NULL DEFAULT false,
    "eInvoiceThreshold" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GstSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "password" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "failedLogins" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Party" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "stateCode" TEXT,
    "pincode" TEXT,
    "gstin" TEXT,
    "externalId" TEXT,
    "referredBy" TEXT,
    "customFields" JSONB NOT NULL DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Party_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemMaster" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "hsnSac" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'NOS',
    "rate" DECIMAL(14,2) NOT NULL,
    "gstRate" DECIMAL(5,2) NOT NULL DEFAULT 18,
    "barcode" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceSequence" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fy" TEXT NOT NULL,
    "prefix" TEXT NOT NULL DEFAULT 'INV',
    "nextNo" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "InvoiceSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "billNo" TEXT NOT NULL,
    "documentType" "DocumentType" NOT NULL DEFAULT 'TAX_INVOICE',
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "invoiceDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fy" TEXT NOT NULL,
    "partyId" TEXT,
    "partyName" TEXT NOT NULL,
    "partyPhone" TEXT,
    "partyAddress" TEXT,
    "partyGstin" TEXT,
    "partyStateCode" TEXT,
    "partyExternalId" TEXT,
    "referredBy" TEXT,
    "placeOfSupply" TEXT,
    "supplyType" "SupplyType" NOT NULL DEFAULT 'B2C',
    "reverseCharge" BOOLEAN NOT NULL DEFAULT false,
    "referenceInvoiceId" TEXT,
    "sellerGstin" TEXT,
    "sellerLegalName" TEXT,
    "sellerStateCode" TEXT,
    "sellerAddress" TEXT,
    "taxableAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "cgstAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "sgstAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "igstAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "cessAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "grandTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "roundOff" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "pdfGcsKey" TEXT,
    "irn" TEXT,
    "ackNo" TEXT,
    "ackDate" TIMESTAMP(3),
    "signedQr" TEXT,
    "einvoiceStatus" "EinvoiceStatus" NOT NULL DEFAULT 'NOT_APPLICABLE',
    "einvoicePayload" JSONB,
    "createdById" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "printedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLine" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "itemId" TEXT,
    "description" TEXT NOT NULL,
    "hsnSac" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'NOS',
    "qty" DECIMAL(14,3) NOT NULL,
    "rate" DECIMAL(14,2) NOT NULL,
    "discount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "taxableValue" DECIMAL(14,2) NOT NULL,
    "gstRate" DECIMAL(5,2) NOT NULL,
    "cgstAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "sgstAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "igstAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "cessAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoicePayment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "mode" "PaymentMode" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "upiRefId" TEXT,
    "cardLast4" TEXT,
    "notes" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoicePayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaObject" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "gcsKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "purpose" "MediaPurpose" NOT NULL,
    "sizeBytes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaObject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "meta" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_clientId_key" ON "Tenant"("clientId");

-- CreateIndex
CREATE INDEX "Tenant_status_idx" ON "Tenant"("status");

-- CreateIndex
CREATE INDEX "Tenant_profileType_idx" ON "Tenant"("profileType");

-- CreateIndex
CREATE UNIQUE INDEX "TenantProfileConfig_tenantId_key" ON "TenantProfileConfig"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "BrandTemplate_tenantId_key" ON "BrandTemplate"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "GstSettings_tenantId_key" ON "GstSettings"("tenantId");

-- CreateIndex
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_tenantId_email_key" ON "User"("tenantId", "email");

-- CreateIndex
CREATE INDEX "Party_tenantId_idx" ON "Party"("tenantId");

-- CreateIndex
CREATE INDEX "Party_tenantId_phone_idx" ON "Party"("tenantId", "phone");

-- CreateIndex
CREATE INDEX "Party_tenantId_externalId_idx" ON "Party"("tenantId", "externalId");

-- CreateIndex
CREATE INDEX "Party_tenantId_gstin_idx" ON "Party"("tenantId", "gstin");

-- CreateIndex
CREATE INDEX "Party_tenantId_name_idx" ON "Party"("tenantId", "name");

-- CreateIndex
CREATE INDEX "ItemMaster_tenantId_idx" ON "ItemMaster"("tenantId");

-- CreateIndex
CREATE INDEX "ItemMaster_tenantId_name_idx" ON "ItemMaster"("tenantId", "name");

-- CreateIndex
CREATE INDEX "ItemMaster_tenantId_barcode_idx" ON "ItemMaster"("tenantId", "barcode");

-- CreateIndex
CREATE INDEX "InvoiceSequence_tenantId_idx" ON "InvoiceSequence"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceSequence_tenantId_fy_prefix_key" ON "InvoiceSequence"("tenantId", "fy", "prefix");

-- CreateIndex
CREATE INDEX "Invoice_tenantId_invoiceDate_idx" ON "Invoice"("tenantId", "invoiceDate");

-- CreateIndex
CREATE INDEX "Invoice_tenantId_status_idx" ON "Invoice"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Invoice_tenantId_partyId_idx" ON "Invoice"("tenantId", "partyId");

-- CreateIndex
CREATE INDEX "Invoice_tenantId_fy_idx" ON "Invoice"("tenantId", "fy");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_tenantId_billNo_key" ON "Invoice"("tenantId", "billNo");

-- CreateIndex
CREATE INDEX "InvoiceLine_invoiceId_idx" ON "InvoiceLine"("invoiceId");

-- CreateIndex
CREATE INDEX "InvoiceLine_tenantId_idx" ON "InvoiceLine"("tenantId");

-- CreateIndex
CREATE INDEX "InvoicePayment_invoiceId_idx" ON "InvoicePayment"("invoiceId");

-- CreateIndex
CREATE INDEX "InvoicePayment_tenantId_idx" ON "InvoicePayment"("tenantId");

-- CreateIndex
CREATE INDEX "InvoicePayment_tenantId_mode_idx" ON "InvoicePayment"("tenantId", "mode");

-- CreateIndex
CREATE INDEX "MediaObject_tenantId_idx" ON "MediaObject"("tenantId");

-- CreateIndex
CREATE INDEX "MediaObject_tenantId_purpose_idx" ON "MediaObject"("tenantId", "purpose");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_createdAt_idx" ON "AuditLog"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- AddForeignKey
ALTER TABLE "TenantProfileConfig" ADD CONSTRAINT "TenantProfileConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandTemplate" ADD CONSTRAINT "BrandTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GstSettings" ADD CONSTRAINT "GstSettings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Party" ADD CONSTRAINT "Party_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemMaster" ADD CONSTRAINT "ItemMaster_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceSequence" ADD CONSTRAINT "InvoiceSequence_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoicePayment" ADD CONSTRAINT "InvoicePayment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaObject" ADD CONSTRAINT "MediaObject_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

