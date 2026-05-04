-- Add wanInterface column to Router table
ALTER TABLE "Router" ADD COLUMN IF NOT EXISTS "wanInterface" TEXT NOT NULL DEFAULT '';
