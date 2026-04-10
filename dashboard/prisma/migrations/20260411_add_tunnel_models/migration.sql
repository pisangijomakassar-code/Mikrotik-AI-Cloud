-- Add tunnel-related enums
DO $$ BEGIN
  CREATE TYPE "TunnelMethod" AS ENUM ('CLOUDFLARE', 'SSTP');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "TunnelStatus" AS ENUM ('PENDING', 'CONNECTED', 'DISCONNECTED', 'ERROR');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ConnectionMethod" AS ENUM ('DIRECT', 'TUNNEL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add connectionMethod to Router (if column doesn't exist)
ALTER TABLE "Router" ADD COLUMN IF NOT EXISTS "connectionMethod" "ConnectionMethod" NOT NULL DEFAULT 'DIRECT';

-- Create Tunnel table
CREATE TABLE IF NOT EXISTS "Tunnel" (
    "id"                    TEXT NOT NULL,
    "method"                "TunnelMethod" NOT NULL,
    "status"                "TunnelStatus" NOT NULL DEFAULT 'PENDING',
    "cloudflareTunnelId"    TEXT,
    "cloudflareTunnelToken" TEXT,
    "vpnUsername"           TEXT,
    "vpnPassword"           TEXT,
    "vpnAssignedIp"         TEXT,
    "routerLanIp"           TEXT NOT NULL DEFAULT '192.168.88.1',
    "lastConnectedAt"       TIMESTAMP(3),
    "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "routerId"              TEXT NOT NULL,

    CONSTRAINT "Tunnel_pkey" PRIMARY KEY ("id")
);

-- Create TunnelPort table
CREATE TABLE IF NOT EXISTS "TunnelPort" (
    "id"          TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "remotePort"  INTEGER NOT NULL,
    "localPort"   INTEGER,
    "hostname"    TEXT,
    "enabled"     BOOLEAN NOT NULL DEFAULT true,
    "tunnelId"    TEXT NOT NULL,

    CONSTRAINT "TunnelPort_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
DO $$ BEGIN
  ALTER TABLE "Tunnel" ADD CONSTRAINT "Tunnel_cloudflareTunnelId_key" UNIQUE ("cloudflareTunnelId");
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Tunnel" ADD CONSTRAINT "Tunnel_routerId_key" UNIQUE ("routerId");
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "TunnelPort" ADD CONSTRAINT "TunnelPort_tunnelId_serviceName_key" UNIQUE ("tunnelId", "serviceName");
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS "Tunnel_status_idx" ON "Tunnel"("status");
CREATE INDEX IF NOT EXISTS "Tunnel_method_idx" ON "Tunnel"("method");
CREATE INDEX IF NOT EXISTS "TunnelPort_tunnelId_idx" ON "TunnelPort"("tunnelId");

-- Foreign keys
DO $$ BEGIN
  ALTER TABLE "Tunnel" ADD CONSTRAINT "Tunnel_routerId_fkey"
    FOREIGN KEY ("routerId") REFERENCES "Router"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "TunnelPort" ADD CONSTRAINT "TunnelPort_tunnelId_fkey"
    FOREIGN KEY ("tunnelId") REFERENCES "Tunnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
