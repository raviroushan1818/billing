-- CreateEnum
CREATE TYPE "HeaderMode" AS ENUM ('COMPOSED', 'LETTERHEAD');

-- AlterTable
ALTER TABLE "BrandTemplate"
  ADD COLUMN "headerMode" "HeaderMode" NOT NULL DEFAULT 'COMPOSED';
