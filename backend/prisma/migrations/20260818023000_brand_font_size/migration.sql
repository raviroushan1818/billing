-- Tenant-configurable invoice body font size (px).
ALTER TABLE "BrandTemplate" ADD COLUMN "fontSizePx" INTEGER NOT NULL DEFAULT 12;
