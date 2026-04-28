-- ============================================================
-- Fix reseller schema: add missing columns, tables, and enums
-- ============================================================

-- 1. Add missing columns to Reseller table
ALTER TABLE "Reseller" ADD COLUMN IF NOT EXISTS "discount"     INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Reseller" ADD COLUMN IF NOT EXISTS "voucherGroup" TEXT    NOT NULL DEFAULT 'default';
ALTER TABLE "Reseller" ADD COLUMN IF NOT EXISTS "uplink"       TEXT    NOT NULL DEFAULT '';

-- 2. Add missing columns to VoucherBatch table
ALTER TABLE "VoucherBatch" ADD COLUMN IF NOT EXISTS "discount"     INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "VoucherBatch" ADD COLUMN IF NOT EXISTS "markUp"       INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "VoucherBatch" ADD COLUMN IF NOT EXISTS "hargaEndUser" INTEGER NOT NULL DEFAULT 0;

-- 3. Add missing columns to SaldoTransaction table
ALTER TABLE "SaldoTransaction" ADD COLUMN IF NOT EXISTS "hargaVoucher"    INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "SaldoTransaction" ADD COLUMN IF NOT EXISTS "voucherUsername" TEXT    NOT NULL DEFAULT '';
ALTER TABLE "SaldoTransaction" ADD COLUMN IF NOT EXISTS "voucherPassword" TEXT    NOT NULL DEFAULT '';
ALTER TABLE "SaldoTransaction" ADD COLUMN IF NOT EXISTS "voucherInfo"     TEXT    NOT NULL DEFAULT '';
ALTER TABLE "SaldoTransaction" ADD COLUMN IF NOT EXISTS "proofImageUrl"   TEXT    NOT NULL DEFAULT '';

-- 4. Fix SaldoTransactionType enum: add new values
ALTER TYPE "SaldoTransactionType" ADD VALUE IF NOT EXISTS 'TOP_UP';
ALTER TYPE "SaldoTransactionType" ADD VALUE IF NOT EXISTS 'TOP_DOWN';
ALTER TYPE "SaldoTransactionType" ADD VALUE IF NOT EXISTS 'VOUCHER_PURCHASE';

-- 5. Fix ResellerStatus enum: add INACTIVE value
ALTER TYPE "ResellerStatus" ADD VALUE IF NOT EXISTS 'INACTIVE';

-- 6. Create VoucherType table
CREATE TABLE IF NOT EXISTS "VoucherType" (
  "id"              TEXT        NOT NULL,
  "namaVoucher"     TEXT        NOT NULL,
  "deskripsi"       TEXT        NOT NULL DEFAULT '',
  "harga"           INTEGER     NOT NULL DEFAULT 0,
  "markUp"          INTEGER     NOT NULL DEFAULT 0,
  "server"          TEXT        NOT NULL DEFAULT 'all',
  "profile"         TEXT        NOT NULL DEFAULT '',
  "limitUptime"     TEXT        NOT NULL DEFAULT '0',
  "limitQuotaDl"    INTEGER     NOT NULL DEFAULT 0,
  "limitQuotaUl"    INTEGER     NOT NULL DEFAULT 0,
  "limitQuotaTotal" INTEGER     NOT NULL DEFAULT 0,
  "typeChar"        TEXT        NOT NULL DEFAULT 'Random abcd',
  "typeLogin"       TEXT        NOT NULL DEFAULT 'Username & Password',
  "prefix"          TEXT        NOT NULL DEFAULT '',
  "panjangKarakter" INTEGER     NOT NULL DEFAULT 6,
  "voucherGroup"    TEXT        NOT NULL DEFAULT 'default',
  "voucherColor"    TEXT        NOT NULL DEFAULT '#ffffff',
  "addressPool"     TEXT        NOT NULL DEFAULT '',
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "userId"          TEXT        NOT NULL,
  CONSTRAINT "VoucherType_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "VoucherType_userId_idx" ON "VoucherType"("userId");

DO $$ BEGIN
  ALTER TABLE "VoucherType" ADD CONSTRAINT "VoucherType_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 7. Create VoucherProfileSetting table
CREATE TABLE IF NOT EXISTS "VoucherProfileSetting" (
  "id"          TEXT         NOT NULL,
  "profileName" TEXT         NOT NULL,
  "price"       INTEGER      NOT NULL DEFAULT 0,
  "charType"    TEXT         NOT NULL DEFAULT 'alphanumeric',
  "charLength"  INTEGER      NOT NULL DEFAULT 6,
  "loginType"   TEXT         NOT NULL DEFAULT 'separate',
  "limitUptime" TEXT,
  "limitQuota"  TEXT,
  "qrColor"     TEXT         NOT NULL DEFAULT '#000000',
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "userId"      TEXT         NOT NULL,
  CONSTRAINT "VoucherProfileSetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "VoucherProfileSetting_userId_profileName_key"
  ON "VoucherProfileSetting"("userId", "profileName");

CREATE INDEX IF NOT EXISTS "VoucherProfileSetting_userId_idx"
  ON "VoucherProfileSetting"("userId");

DO $$ BEGIN
  ALTER TABLE "VoucherProfileSetting" ADD CONSTRAINT "VoucherProfileSetting_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 8. Add missing foreign keys on Reseller / SaldoTransaction / VoucherBatch
DO $$ BEGIN
  ALTER TABLE "Reseller" ADD CONSTRAINT "Reseller_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "SaldoTransaction" ADD CONSTRAINT "SaldoTransaction_resellerId_fkey"
    FOREIGN KEY ("resellerId") REFERENCES "Reseller"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "VoucherBatch" ADD CONSTRAINT "VoucherBatch_resellerId_fkey"
    FOREIGN KEY ("resellerId") REFERENCES "Reseller"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "VoucherBatch" ADD CONSTRAINT "VoucherBatch_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
