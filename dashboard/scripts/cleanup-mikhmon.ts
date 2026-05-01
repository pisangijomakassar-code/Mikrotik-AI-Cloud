/**
 * Script to clean up old Mikhmon import batches before re-importing
 * Usage: npx tsx scripts/cleanup-mikhmon.ts
 */

import { prisma } from "@/lib/db"

async function main() {
  console.log("Cleaning up old Mikhmon import batches...")

  try {
    // Delete all VoucherBatch records with source starting with "mikhmon_import:"
    const deleted = await prisma.voucherBatch.deleteMany({
      where: {
        source: {
          startsWith: "mikhmon_import:",
        },
      },
    })

    console.log(`✓ Deleted ${deleted.count} Mikhmon import batches`)

    // Show summary of remaining batches
    const remaining = await prisma.voucherBatch.groupBy({
      by: ["source"],
      _count: true,
    })

    console.log("\nRemaining batches by source:")
    remaining.forEach((r) => {
      console.log(`  ${r.source}: ${r._count}`)
    })

    console.log("\n✓ Cleanup complete!")
    console.log("Next step: Re-import Mikhmon from dashboard (Hotspot > Import Mikhmon)")
  } catch (error) {
    console.error("Error during cleanup:", error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
