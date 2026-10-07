-- CreateTable
CREATE TABLE IF NOT EXISTS "PlatformSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "clientIdPrefix" TEXT NOT NULL DEFAULT 'CLI',
    "clientIdSeparator" TEXT NOT NULL DEFAULT '-',
    "clientIdSuffixLength" INTEGER NOT NULL DEFAULT 8,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "PlatformSettings" ("id", "clientIdPrefix", "clientIdSeparator", "clientIdSuffixLength", "updatedAt")
VALUES ('default', 'CLI', '-', 8, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
