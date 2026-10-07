-- IndHMS bridge credentials + invoice external reference
ALTER TABLE "TenantIntegrationSettings" ADD COLUMN IF NOT EXISTS "hmsApiKeyHash" TEXT;
ALTER TABLE "TenantIntegrationSettings" ADD COLUMN IF NOT EXISTS "hmsApiKeyPrefix" TEXT;
ALTER TABLE "TenantIntegrationSettings" ADD COLUMN IF NOT EXISTS "hmsWebhookSecret" TEXT;
ALTER TABLE "TenantIntegrationSettings" ADD COLUMN IF NOT EXISTS "hmsBaseUrl" TEXT;
ALTER TABLE "TenantIntegrationSettings" ADD COLUMN IF NOT EXISTS "hmsBridgeUserId" TEXT;

ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "externalRef" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_tenantId_externalRef_key"
  ON "Invoice"("tenantId", "externalRef")
  WHERE "externalRef" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "Invoice_tenantId_externalRef_idx"
  ON "Invoice"("tenantId", "externalRef");
