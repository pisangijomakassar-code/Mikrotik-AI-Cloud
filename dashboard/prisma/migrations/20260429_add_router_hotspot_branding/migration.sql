-- Add hotspot branding fields to Router (used when printing voucher cards).
-- hotspotName: display name shown on voucher header. Empty = fallback to Router.name.
-- hotspotLogoUrl: URL/path to logo image. Empty = no logo on voucher.

ALTER TABLE "Router" ADD COLUMN IF NOT EXISTS "hotspotName"    TEXT NOT NULL DEFAULT '';
ALTER TABLE "Router" ADD COLUMN IF NOT EXISTS "hotspotLogoUrl" TEXT NOT NULL DEFAULT '';
