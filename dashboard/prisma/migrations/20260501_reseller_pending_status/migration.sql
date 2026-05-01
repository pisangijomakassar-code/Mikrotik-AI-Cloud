-- Add PENDING status untuk reseller yg menunggu approval owner
ALTER TYPE "ResellerStatus" ADD VALUE IF NOT EXISTS 'PENDING';
