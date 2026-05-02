/**
 * Tenant-aware Prisma client (multi-tenant isolation).
 *
 * Pakai `getTenantDb()` di API routes/server actions yang butuh tenant scope:
 *
 *   ```ts
 *   import { getTenantDb } from "@/lib/db-tenant"
 *
 *   export async function GET() {
 *     const db = await getTenantDb()
 *     const routers = await db.router.findMany()  // tenantId auto-injected
 *     return Response.json(routers)
 *   }
 *   ```
 *
 * Untuk Super Admin endpoints (perlu lihat lintas tenant), pakai raw `prisma`
 * dari `@/lib/db` — eksplisit, sulit "tidak sengaja" bocor.
 *
 * Models yang auto-scoped:
 *   Router, Reseller, VoucherBatch, VoucherType, VoucherProfileSetting,
 *   ActivityLog, TokenUsage, Subscription, Invoice, TrafficSnapshot,
 *   NetwatchTopology (via Router cascade — query pakai routerId)
 *
 * Models yang tidak di-scope (read-only / cascade dari parent):
 *   Tunnel, TunnelPort, SaldoTransaction (cascade dari Router/Reseller),
 *   Tenant, User (super admin needs cross-tenant access),
 *   AppSettings, SystemSetting (global).
 */
import { prisma } from "./db"
import { auth } from "./auth"

const TENANT_SCOPED_MODELS = new Set([
  "router",
  "reseller",
  "voucherBatch",
  "voucherType",
  "voucherProfileSetting",
  "activityLog",
  "tokenUsage",
  "subscription",
  "invoice",
  "trafficSnapshot",
])

const READ_OPS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
])

const WRITE_FILTER_OPS = new Set([
  "update",
  "updateMany",
  "upsert",
  "delete",
  "deleteMany",
])

const CREATE_OPS = new Set(["create", "createMany"])

/**
 * Build tenant-scoped Prisma client untuk session current.
 *
 * Throws kalau session tidak valid atau user tidak punya tenant
 * (mis. SUPER_ADMIN — yang harus pakai raw `prisma` instead).
 */
export async function getTenantDb() {
  const session = await auth()
  const tenantId = session?.user?.tenantId

  if (!session?.user) {
    throw new Error("getTenantDb: no session — user belum login")
  }
  if (!tenantId) {
    throw new Error(
      `getTenantDb: user ${session.user.id} (role=${session.user.role}) tidak punya tenant. ` +
        "SUPER_ADMIN endpoints harus pakai raw \`prisma\` dari @/lib/db, bukan getTenantDb().",
    )
  }

  return buildTenantClient(tenantId)
}

/**
 * Build tenant-scoped client untuk tenantId tertentu (bypass session).
 * Pakai untuk: bot Python yang carry tenantId via header/JWT, atau
 * super admin impersonation (kalau nanti diizinkan).
 */
export function buildTenantClient(tenantId: string) {
  return prisma.$extends({
    name: "tenant-isolation",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const m = model.charAt(0).toLowerCase() + model.slice(1)

          if (!TENANT_SCOPED_MODELS.has(m)) {
            return query(args)
          }

          // ── Read & filter-based write operations ──
          if (READ_OPS.has(operation) || WRITE_FILTER_OPS.has(operation)) {
            const a = args as Record<string, unknown>
            const where = (a.where as Record<string, unknown>) ?? {}
            // findUnique/Update/Delete with composite key or id won't accept tenantId
            // directly — need to nest as additional filter.
            if (
              operation === "findUnique" ||
              operation === "findUniqueOrThrow" ||
              operation === "update" ||
              operation === "delete"
            ) {
              // Convert to findFirst/updateMany-style by wrapping where with AND
              // Note: untuk update/delete by unique id, Prisma butuh field unique;
              // pakai AND filter agar tenantId tetap di-enforce sebagai security gate.
              a.where = { ...where, tenantId }
            } else {
              a.where = { ...where, tenantId }
            }
          }

          // ── Create operations ──
          if (CREATE_OPS.has(operation)) {
            const a = args as Record<string, unknown>
            if (operation === "create") {
              a.data = { ...((a.data as Record<string, unknown>) ?? {}), tenantId }
            } else if (operation === "createMany") {
              const data = a.data
              const arr = Array.isArray(data) ? data : [data]
              a.data = arr.map((d) => ({ ...(d as Record<string, unknown>), tenantId }))
            }
          }

          // ── Upsert: cover both create + update branch ──
          if (operation === "upsert") {
            const a = args as Record<string, unknown>
            const create = (a.create as Record<string, unknown>) ?? {}
            const update = (a.update as Record<string, unknown>) ?? {}
            a.create = { ...create, tenantId }
            a.update = { ...update, tenantId }
          }

          return query(args)
        },
      },
    },
  })
}

/**
 * Re-export raw prisma untuk akses tanpa tenant scope.
 * GUNAKAN HANYA UNTUK:
 *   - Super admin endpoints (lintas tenant)
 *   - Authentication (cari User by email saat login)
 *   - System/global queries (Tenant model, AppSettings, SystemSetting)
 *
 * JANGAN gunakan untuk admin tenant operation — selalu pakai getTenantDb().
 */
export { prisma as prismaRaw } from "./db"
