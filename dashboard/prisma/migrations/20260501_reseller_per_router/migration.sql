-- Make Reseller scoped per Router. Existing resellers are backfilled to user's
-- default router (or oldest router if no default).

-- Step 1: add nullable column
ALTER TABLE "Reseller" ADD COLUMN "routerId" TEXT;

-- Step 2: backfill — assign each reseller to user's default router (or oldest)
UPDATE "Reseller" r
SET "routerId" = (
  SELECT ro.id
  FROM "Router" ro
  WHERE ro."userId" = r."userId"
  ORDER BY ro."isDefault" DESC, ro."addedAt" ASC
  LIMIT 1
)
WHERE r."routerId" IS NULL;

-- Step 3: orphan resellers (user has no router) — delete them
-- Safe because such resellers can't have created any voucher batches anyway.
DELETE FROM "Reseller" WHERE "routerId" IS NULL;

-- Step 4: enforce NOT NULL + FK + unique
ALTER TABLE "Reseller" ALTER COLUMN "routerId" SET NOT NULL;

ALTER TABLE "Reseller"
  ADD CONSTRAINT "Reseller_routerId_fkey"
  FOREIGN KEY ("routerId") REFERENCES "Router"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "Reseller_routerId_name_key" ON "Reseller"("routerId", "name");
CREATE INDEX "Reseller_routerId_idx" ON "Reseller"("routerId");
