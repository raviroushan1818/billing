-- CreateEnum
CREATE TYPE "InquiryStatus" AS ENUM ('NEW', 'READ');

-- CreateTable
CREATE TABLE "PlatformInquiry" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "InquiryStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformInquiry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlatformInquiry_status_createdAt_idx" ON "PlatformInquiry"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PlatformInquiry_createdAt_idx" ON "PlatformInquiry"("createdAt");
