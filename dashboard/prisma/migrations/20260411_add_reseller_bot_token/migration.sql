-- Add resellerBotToken column to User table
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "resellerBotToken" TEXT;

-- Add Reseller-related enums (idempotent)
DO $$ BEGIN
  CREATE TYPE "ResellerStatus" AS ENUM ('ACTIVE', 'SUSPENDED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "SaldoTransactionType" AS ENUM ('TOPUP', 'TOPDOWN', 'PURCHASE', 'REFUND');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Reseller table
CREATE TABLE IF NOT EXISTS "Reseller" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT NOT NULL DEFAULT '',
  "telegramId" TEXT NOT NULL DEFAULT '',
  "balance" INTEGER NOT NULL DEFAULT 0,
  "status" "ResellerStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "userId" TEXT NOT NULL,
  CONSTRAINT "Reseller_pkey" PRIMARY KEY ("id")
);

-- SaldoTransaction table
CREATE TABLE IF NOT EXISTS "SaldoTransaction" (
  "id" TEXT NOT NULL,
  "type" "SaldoTransactionType" NOT NULL,
  "amount" INTEGER NOT NULL,
  "balanceBefore" INTEGER NOT NULL,
  "balanceAfter" INTEGER NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resellerId" TEXT NOT NULL,
  CONSTRAINT "SaldoTransaction_pkey" PRIMARY KEY ("id")
);

-- VoucherBatch table
CREATE TABLE IF NOT EXISTS "VoucherBatch" (
  "id" TEXT NOT NULL,
  "routerName" TEXT NOT NULL,
  "profile" TEXT NOT NULL,
  "count" INTEGER NOT NULL,
  "pricePerUnit" INTEGER NOT NULL DEFAULT 0,
  "totalCost" INTEGER NOT NULL,
  "vouchers" JSONB NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'dashboard',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resellerId" TEXT,
  "userId" TEXT NOT NULL,
  CONSTRAINT "VoucherBatch_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "Reseller_userId_idx" ON "Reseller"("userId");
CREATE INDEX IF NOT EXISTS "Reseller_telegramId_idx" ON "Reseller"("telegramId");
CREATE INDEX IF NOT EXISTS "SaldoTransaction_resellerId_idx" ON "SaldoTransaction"("resellerId");
CREATE INDEX IF NOT EXISTS "SaldoTransaction_createdAt_idx" ON "SaldoTransaction"("createdAt");
CREATE INDEX IF NOT EXISTS "VoucherBatch_resellerId_idx" ON "VoucherBatch"("resellerId");
CREATE INDEX IF NOT EXISTS "VoucherBatch_userId_idx" ON "VoucherBatch"("userId");
CREATE INDEX IF NOT EXISTS "VoucherBatch_createdAt_idx" ON "VoucherBatch"("createdAt");
