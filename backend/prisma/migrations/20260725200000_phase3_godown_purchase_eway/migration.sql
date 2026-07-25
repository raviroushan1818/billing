-- CreateEnum
CREATE TYPE "PurchaseStatus" AS ENUM ('DRAFT', 'FINALIZED', 'VOID');
CREATE TYPE "EwayStatus" AS ENUM ('DRAFT', 'GENERATED', 'CANCELLED', 'FAILED');

-- AlterEnum StockMovementType
ALTER TYPE "StockMovementType" ADD VALUE 'PURCHASE';
ALTER TYPE "StockMovementType" ADD VALUE 'TRANSFER';

-- CreateTable Godown
CREATE TABLE "Godown" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "address" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Godown_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Godown_tenantId_name_key" ON "Godown"("tenantId", "name");
CREATE INDEX "Godown_tenantId_isActive_idx" ON "Godown"("tenantId", "isActive");
ALTER TABLE "Godown" ADD CONSTRAINT "Godown_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable ItemStock
CREATE TABLE "ItemStock" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "godownId" TEXT NOT NULL,
    "qty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ItemStock_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ItemStock_itemId_godownId_key" ON "ItemStock"("itemId", "godownId");
CREATE INDEX "ItemStock_tenantId_godownId_idx" ON "ItemStock"("tenantId", "godownId");
ALTER TABLE "ItemStock" ADD CONSTRAINT "ItemStock_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ItemMaster"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ItemStock" ADD CONSTRAINT "ItemStock_godownId_fkey" FOREIGN KEY ("godownId") REFERENCES "Godown"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Alter StockMovement
ALTER TABLE "StockMovement" ADD COLUMN "godownId" TEXT;
ALTER TABLE "StockMovement" ADD COLUMN "purchaseId" TEXT;
CREATE INDEX "StockMovement_tenantId_godownId_idx" ON "StockMovement"("tenantId", "godownId");
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_godownId_fkey" FOREIGN KEY ("godownId") REFERENCES "Godown"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- PurchaseBill
CREATE TABLE "PurchaseBill" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "billNo" TEXT NOT NULL,
    "status" "PurchaseStatus" NOT NULL DEFAULT 'DRAFT',
    "billDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fy" TEXT NOT NULL,
    "vendorId" TEXT,
    "vendorName" TEXT NOT NULL,
    "vendorGstin" TEXT,
    "vendorPhone" TEXT,
    "godownId" TEXT,
    "taxableAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "cgstAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "sgstAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "igstAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "grandTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PurchaseBill_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PurchaseBill_tenantId_billNo_key" ON "PurchaseBill"("tenantId", "billNo");
CREATE INDEX "PurchaseBill_tenantId_billDate_idx" ON "PurchaseBill"("tenantId", "billDate");
CREATE INDEX "PurchaseBill_tenantId_status_idx" ON "PurchaseBill"("tenantId", "status");
ALTER TABLE "PurchaseBill" ADD CONSTRAINT "PurchaseBill_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseBill" ADD CONSTRAINT "PurchaseBill_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PurchaseBill" ADD CONSTRAINT "PurchaseBill_godownId_fkey" FOREIGN KEY ("godownId") REFERENCES "Godown"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "PurchaseLine" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "itemId" TEXT,
    "description" TEXT NOT NULL,
    "hsnSac" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'NOS',
    "qty" DECIMAL(14,3) NOT NULL,
    "rate" DECIMAL(14,2) NOT NULL,
    "gstRate" DECIMAL(5,2) NOT NULL,
    "taxableValue" DECIMAL(14,2) NOT NULL,
    "cgstAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "sgstAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "igstAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(14,2) NOT NULL,
    CONSTRAINT "PurchaseLine_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PurchaseLine_purchaseId_idx" ON "PurchaseLine"("purchaseId");
CREATE INDEX "PurchaseLine_tenantId_idx" ON "PurchaseLine"("tenantId");
ALTER TABLE "PurchaseLine" ADD CONSTRAINT "PurchaseLine_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "PurchaseBill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseLine" ADD CONSTRAINT "PurchaseLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ItemMaster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- EwayBill
CREATE TABLE "EwayBill" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "status" "EwayStatus" NOT NULL DEFAULT 'DRAFT',
    "ewbNo" TEXT,
    "vehicleNo" TEXT,
    "transporter" TEXT,
    "fromPlace" TEXT,
    "toPlace" TEXT,
    "distanceKm" INTEGER,
    "validUntil" TIMESTAMP(3),
    "cancelReason" TEXT,
    "payload" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EwayBill_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EwayBill_tenantId_status_idx" ON "EwayBill"("tenantId", "status");
CREATE INDEX "EwayBill_invoiceId_idx" ON "EwayBill"("invoiceId");
CREATE INDEX "EwayBill_tenantId_createdAt_idx" ON "EwayBill"("tenantId", "createdAt");
ALTER TABLE "EwayBill" ADD CONSTRAINT "EwayBill_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EwayBill" ADD CONSTRAINT "EwayBill_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
