-- TrafficSnapshot: counter snapshot per-interface dari RouterOS.
-- Cron poll tiap 10 menit → simpan tx/rxBytes saat itu.
-- Hitung delta antar snapshot → bandwidth usage bulanan.
-- Reboot detection: kalau current < previous, counter reset; current jadi base baru.
-- Retention 12 bulan rolling, auto-cleanup mingguan.

CREATE TABLE IF NOT EXISTS "TrafficSnapshot" (
    "id"            TEXT NOT NULL,
    "routerName"    TEXT NOT NULL,
    "interfaceName" TEXT NOT NULL,
    "txBytes"       BIGINT NOT NULL,
    "rxBytes"       BIGINT NOT NULL,
    "takenAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId"        TEXT NOT NULL,
    CONSTRAINT "TrafficSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TrafficSnapshot_userId_routerName_interfaceName_takenAt_idx"
    ON "TrafficSnapshot"("userId", "routerName", "interfaceName", "takenAt");

CREATE INDEX IF NOT EXISTS "TrafficSnapshot_takenAt_idx"
    ON "TrafficSnapshot"("takenAt");

ALTER TABLE "TrafficSnapshot"
    ADD CONSTRAINT "TrafficSnapshot_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
