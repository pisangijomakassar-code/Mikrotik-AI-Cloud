-- Tambah composite index buat hot-path query bandwidth bulanan & peak hour
-- yang group by router (tanpa interface partition).
CREATE INDEX IF NOT EXISTS "TrafficSnapshot_userId_routerName_takenAt_idx"
  ON "TrafficSnapshot" ("userId", "routerName", "takenAt");
