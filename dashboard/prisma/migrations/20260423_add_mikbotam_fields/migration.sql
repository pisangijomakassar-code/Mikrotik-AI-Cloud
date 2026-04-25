-- Add Mikbotam-compatible fields to Router model
-- MikroTik DNS settings + optional Telegram bot integration per-router

ALTER TABLE "Router" ADD COLUMN "dnsHotspot" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Router" ADD COLUMN "telegramOwnerUsername" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Router" ADD COLUMN "telegramOwnerId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Router" ADD COLUMN "botToken" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Router" ADD COLUMN "botUsername" TEXT NOT NULL DEFAULT '';
