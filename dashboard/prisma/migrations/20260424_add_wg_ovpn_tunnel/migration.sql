-- Add OVPN and WIREGUARD to TunnelMethod enum
ALTER TYPE "TunnelMethod" ADD VALUE IF NOT EXISTS 'OVPN';
ALTER TYPE "TunnelMethod" ADD VALUE IF NOT EXISTS 'WIREGUARD';

-- Add WireGuard and OVPN specific columns to Tunnel table
ALTER TABLE "Tunnel" ADD COLUMN IF NOT EXISTS "winboxPort"     INTEGER;
ALTER TABLE "Tunnel" ADD COLUMN IF NOT EXISTS "subnetOctet"    INTEGER;
ALTER TABLE "Tunnel" ADD COLUMN IF NOT EXISTS "routerOctet"    INTEGER;
ALTER TABLE "Tunnel" ADD COLUMN IF NOT EXISTS "wgClientPrivKey" TEXT;
ALTER TABLE "Tunnel" ADD COLUMN IF NOT EXISTS "wgClientPubKey"  TEXT;
ALTER TABLE "Tunnel" ADD COLUMN IF NOT EXISTS "wgServerPubKey"  TEXT;

-- Index for port allocation queries
CREATE INDEX IF NOT EXISTS "Tunnel_winboxPort_idx" ON "Tunnel"("winboxPort");
CREATE INDEX IF NOT EXISTS "Tunnel_subnetOctet_idx" ON "Tunnel"("subnetOctet");
