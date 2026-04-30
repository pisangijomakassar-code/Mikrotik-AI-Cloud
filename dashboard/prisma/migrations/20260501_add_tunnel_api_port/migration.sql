-- Add apiPort column to Tunnel for MikroTik API (8728) port forwarding
ALTER TABLE "Tunnel" ADD COLUMN "apiPort" INTEGER;
