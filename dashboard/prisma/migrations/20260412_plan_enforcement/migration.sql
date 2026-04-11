-- Migration: plan_enforcement
-- 1. Rename ENTERPRISE → PREMIUM in SubscriptionPlan enum (Postgres 16+)
-- 2. Update all existing subscription rows to correct daily tokenLimit per plan
-- 3. Update column default from 20000 → 100

-- Step A: Rename the enum value
ALTER TYPE "SubscriptionPlan" RENAME VALUE 'ENTERPRISE' TO 'PREMIUM';

-- Step B: Set correct daily tokenLimit per plan
-- FREE: 100 tokens/day
UPDATE "Subscription" SET "tokenLimit" = 100  WHERE plan = 'FREE';

-- PRO: 1000 tokens/day
UPDATE "Subscription" SET "tokenLimit" = 1000 WHERE plan = 'PRO';

-- PREMIUM: -1 (unlimited sentinel)
UPDATE "Subscription" SET "tokenLimit" = -1   WHERE plan = 'PREMIUM';

-- Step C: Update column default from 20000 → 100
ALTER TABLE "Subscription" ALTER COLUMN "tokenLimit" SET DEFAULT 100;
