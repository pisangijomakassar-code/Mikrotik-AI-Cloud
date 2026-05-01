-- Netwatch topology per router — visualisasi tree AP estafet di /netwatch
CREATE TABLE IF NOT EXISTS "NetwatchTopology" (
  "id"         TEXT NOT NULL,
  "host"       TEXT NOT NULL,
  "label"      TEXT NOT NULL DEFAULT '',
  "x"          DOUBLE PRECISION NOT NULL DEFAULT 0,
  "y"          DOUBLE PRECISION NOT NULL DEFAULT 0,
  "isCentral"  BOOLEAN NOT NULL DEFAULT false,
  "parentId"   TEXT,
  "routerId"   TEXT NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NetwatchTopology_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NetwatchTopology_routerId_host_key" ON "NetwatchTopology" ("routerId", "host");
CREATE INDEX "NetwatchTopology_routerId_idx" ON "NetwatchTopology" ("routerId");
CREATE INDEX "NetwatchTopology_parentId_idx" ON "NetwatchTopology" ("parentId");

ALTER TABLE "NetwatchTopology"
  ADD CONSTRAINT "NetwatchTopology_routerId_fkey"
  FOREIGN KEY ("routerId") REFERENCES "Router"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NetwatchTopology"
  ADD CONSTRAINT "NetwatchTopology_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "NetwatchTopology"("id") ON DELETE SET NULL ON UPDATE CASCADE;
