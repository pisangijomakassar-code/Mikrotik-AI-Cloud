-- Remove agentUrl column from User table
ALTER TABLE "User" DROP COLUMN IF EXISTS "agentUrl";

-- Create billing enums
DO $$ BEGIN
  CREATE TYPE "SubscriptionPlan" AS ENUM ('FREE', 'PRO', 'ENTERPRISE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELED', 'TRIALING');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'PENDING', 'PAID', 'OVERDUE', 'CANCELED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Create Subscription table
CREATE TABLE IF NOT EXISTS "Subscription" (
  "id" TEXT NOT NULL,
  "plan" "SubscriptionPlan" NOT NULL DEFAULT 'FREE',
  "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
  "tokenLimit" INTEGER NOT NULL DEFAULT 20000,
  "tokensUsed" INTEGER NOT NULL DEFAULT 0,
  "billingCycleStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "billingCycleEnd" TIMESTAMP(3),
  "externalId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "userId" TEXT NOT NULL,
  CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- Create TokenUsage table
CREATE TABLE IF NOT EXISTS "TokenUsage" (
  "id" TEXT NOT NULL,
  "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "tokensIn" INTEGER NOT NULL DEFAULT 0,
  "tokensOut" INTEGER NOT NULL DEFAULT 0,
  "model" TEXT NOT NULL DEFAULT '',
  "sessionId" TEXT,
  "durationMs" INTEGER,
  "userId" TEXT NOT NULL,
  CONSTRAINT "TokenUsage_pkey" PRIMARY KEY ("id")
);

-- Create Invoice table
CREATE TABLE IF NOT EXISTS "Invoice" (
  "id" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
  "amount" INTEGER NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'IDR',
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "tokensUsed" INTEGER NOT NULL DEFAULT 0,
  "externalId" TEXT,
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "userId" TEXT NOT NULL,
  CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_externalId_key" ON "Subscription"("externalId");
CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_userId_key" ON "Subscription"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_number_key" ON "Invoice"("number");
CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_externalId_key" ON "Invoice"("externalId");

-- Indexes
CREATE INDEX IF NOT EXISTS "TokenUsage_userId_idx" ON "TokenUsage"("userId");
CREATE INDEX IF NOT EXISTS "TokenUsage_timestamp_idx" ON "TokenUsage"("timestamp");
CREATE INDEX IF NOT EXISTS "Invoice_userId_idx" ON "Invoice"("userId");
CREATE INDEX IF NOT EXISTS "Invoice_status_idx" ON "Invoice"("status");

-- Foreign keys
ALTER TABLE "Subscription" DROP CONSTRAINT IF EXISTS "Subscription_userId_fkey";
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TokenUsage" DROP CONSTRAINT IF EXISTS "TokenUsage_userId_fkey";
ALTER TABLE "TokenUsage" ADD CONSTRAINT "TokenUsage_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Invoice" DROP CONSTRAINT IF EXISTS "Invoice_userId_fkey";
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed: create FREE subscription for all existing users
INSERT INTO "Subscription" ("id", "userId", "plan", "status", "tokenLimit", "tokensUsed", "billingCycleStart", "updatedAt")
SELECT gen_random_uuid()::text, id, 'FREE', 'ACTIVE', 20000, 0, NOW(), NOW()
FROM "User"
WHERE id NOT IN (SELECT "userId" FROM "Subscription");
