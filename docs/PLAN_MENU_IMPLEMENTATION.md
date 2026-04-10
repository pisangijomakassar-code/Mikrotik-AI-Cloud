# Plan: Implementasi Menu Dashboard MikroTik AI Agent

## Status: IMPLEMENTED (2026-04-10)

Semua phase sudah diimplementasikan. Berikut status per-phase:

| Phase | Deskripsi | Status | Files |
|-------|-----------|--------|-------|
| Phase 0 | Foundation (Prisma schema, types, services, voucher_db.py) | DONE | 4 files |
| Phase 1 | Sidebar restructure (6 collapsible groups) | DONE | 1 file modified |
| Phase 2 | MCP tools (voucher DB persistence + 4 reseller tools) | DONE | 1 file modified |
| Phase 3 | Reseller Bot (button-based Telegram bot, no LLM) | DONE | 1 file created + entrypoint modified |
| Phase 4 | Health Server (17 new endpoints: GET/POST/DELETE) | DONE | 1 file modified |
| Phase 5 | Next.js API Routes (24 route files) | DONE | 24 files created |
| Phase 6 | React Query Hooks (6 hook files) | DONE | 6 files created |
| Phase 7 | Dashboard Pages (12 pages + 3 components) | DONE | 15 files created/modified |
| Phase 8 | Voucher PDF (printable HTML with auto-print) | DONE | 1 file modified |

### Fitur yang Sudah Diimplementasikan

**1. Dashboard (Enhanced)**
- Hotspot stats cards (total users, active, enabled, disabled)
- Network warnings/alerts (CPU > 80%, memory > 90%, router offline)
- AI Network Insight (LLM-based analysis via OpenRouter)

**2. Hotspot Management**
- Hotspot Users — DataTable + add/enable/disable/delete
- Active Sessions — live view, 30s auto-refresh
- User Profiles — read-only list

**3. PPP Management**
- PPP Users (Secrets) — DataTable + add/delete
- Active Sessions — live view + kick action
- PPP Profiles — read-only list

**4. Reseller Management**
- Reseller List — CRUD + saldo top-up/top-down
- Reseller Detail — info card, saldo display, voucher/transaction tabs, generate voucher dialog
- Voucher History — global view across all sources (dashboard/nanobot/reseller_bot)
- Reseller Bot Setup — configure bot token, activate/deactivate

**5. Communication**
- Send Telegram messages to resellers/users
- Single recipient or broadcast mode
- Quick message templates (Status Voucher, Gangguan Jaringan, Info Promo)

**6. Backend**
- MCP tool `generate_hotspot_vouchers` auto-saves to PostgreSQL
- 4 reseller MCP tools (check_saldo, generate_voucher, request_deposit, transaction_history)
- Reseller Telegram Bot (button-based, no LLM) with /start menu
- 17 health_server endpoints for dashboard-to-router communication
- VoucherDB module (Python psycopg2) for MCP-to-PostgreSQL bridge

### Remaining TODO (Post-Deploy)
- Run `npx prisma migrate dev` in Docker container (requires Node.js 20+)
- Install `python-telegram-bot` in Docker container
- Test end-to-end reseller flow
- PDF voucher bisa di-enhance dengan @react-pdf/renderer untuk layout lebih rapi

---

## Context

Dashboard MikroTik AI Agent saat ini memiliki 9 halaman dasar. Kita perlu menambahkan 5 kelompok menu baru yang terinspirasi dari MikBotAM dan Mikhmon untuk menjadikan platform ini **solusi ISP management lengkap**, dimana user (pemilik ISP) bisa:
1. Mengelola hotspot & PPP dari dashboard
2. Punya reseller yang bisa self-service via bot Telegram terpisah
3. Melihat semua voucher yang di-generate (baik dari dashboard, Nanobot, maupun reseller bot) dalam satu tempat
4. Mendapat AI insight tentang kondisi jaringan

**Keputusan arsitektur yang sudah disetujui:**
- Reseller = entitas data-only, setiap user bisa punya reseller sendiri (scoped per `userId`)
- Bot Telegram TERPISAH untuk reseller — button-only, tanpa LLM
- Bot LLM AI (Nanobot) = khusus user/owner — full AI natural language
- MCP tool `generate_hotspot_vouchers` langsung tulis ke PostgreSQL → otomatis muncul di dashboard
- Komunikasi = Telegram saja
- AI Insight = LLM-based via OpenRouter
- Print Voucher = Generate PDF

---

## Arsitektur

### Tiga Data Plane

**Plane A — Router Data (via health_server → RouterOS API):**
Hotspot users/active/profiles, PPP secrets/active/profiles, system metrics.
Pattern: `Dashboard API → health_server:8080 → librouteros → MikroTik`

**Plane B — Business Data (via Prisma → PostgreSQL):**
Reseller, saldo, voucher batch, reseller bot config.
Pattern: `Dashboard API → Prisma → PostgreSQL`

**Plane C — MCP-to-DB Bridge (MCP tools → PostgreSQL):**
Ketika voucher di-generate via Nanobot AI agent (Telegram) atau Reseller Bot, MCP tool langsung tulis ke PostgreSQL. Dashboard baca dari DB yang sama.
Pattern: `Nanobot/ResellerBot → MCP tool → RouterOS + PostgreSQL`

### Alur Voucher End-to-End

```
3 sumber generate voucher:
                                                    ┌─────────────┐
1. Dashboard UI ──→ API route ──→ health_server ──→ │  RouterOS   │
                         │                          │ (create     │
2. Nanobot Agent ──→ MCP tool ─────────────────────→│  hotspot    │
                         │                          │  users)     │
3. Reseller Bot ──→ MCP tool ─────────────────────→ └─────────────┘
                         │
                         ▼
                   ┌─────────────┐
                   │ PostgreSQL  │ ←── Dashboard baca dari sini
                   │ VoucherBatch│
                   │ + Saldo     │
                   └─────────────┘
```

### Reseller Bot Architecture

```
Per User (pemilik ISP):
┌──────────────────────────────────────────────┐
│ Container: mikrotik-agent                     │
│                                               │
│  ┌─────────────┐  ┌──────────────────────┐   │
│  │ Nanobot      │  │ Reseller Bot         │   │
│  │ (AI Agent)   │  │ (lightweight Python) │   │
│  │ Bot Token A  │  │ Bot Token B          │   │
│  │ Full LLM AI  │  │ Button-only, NO LLM  │   │
│  └──────┬───────┘  └──────────┬───────────┘   │
│         │                     │               │
│         ▼                     ▼               │
│  ┌──────────────────────────────────────┐     │
│  │ MCP Server (server.py)               │     │
│  │ + reseller tools (baru)              │     │
│  │ + voucher_db module (baru)           │     │
│  └──────────────────────────────────────┘     │
│         │                                     │
│  ┌──────┴───────┐  ┌──────────────────┐       │
│  │ health_server│  │ PostgreSQL       │       │
│  │ :8080        │  │ (shared DB)      │       │
│  └──────────────┘  └──────────────────┘       │
└──────────────────────────────────────────────┘
```

**Reseller Bot** = lightweight Python Telegram bot, **tanpa LLM** — hanya button-based interface (InlineKeyboardButton). Reseller tidak perlu ketik apapun, semua via tombol:

```
/start → Menu Utama:
┌─────────────┬───────────────┐
│ 💰 Cek Saldo │ 🎫 Beli Voucher│
├─────────────┼───────────────┤
│ 💳 Deposit   │ 📋 History     │
└─────────────┴───────────────┘

Klik "Beli Voucher" →
┌───────────────────┐
│ 5rb  - 1 Jam      │
│ 10rb - 3 Jam      │
│ 15rb - 1 Hari     │
│ 25rb - 3 Hari     │
│ ← Kembali         │
└───────────────────┘

Klik profile → Konfirmasi:
"Beli 1x voucher 5rb-1hr? Saldo: Rp 150.000"
┌──────────┬──────────┐
│ ✅ Ya     │ ❌ Batal  │
└──────────┴──────────┘

Klik "Deposit" →
┌──────────┬──────────┐
│ Rp 10rb  │ Rp 25rb  │
│ Rp 50rb  │ Rp 100rb │
│ ← Kembali           │
└──────────┴──────────┘
```

---

## Phase 0: Foundation (Database & Types)

### 0.1 Prisma Schema — Tambah Model Baru
**File:** `dashboard/prisma/schema.prisma`

```prisma
enum ResellerStatus {
  ACTIVE
  INACTIVE
}

enum SaldoTransactionType {
  TOP_UP
  TOP_DOWN
  VOUCHER_PURCHASE
}

model Reseller {
  id          String         @id @default(cuid())
  name        String
  phone       String         @default("")
  telegramId  String         @default("")
  balance     Int            @default(0)  // dalam IDR
  status      ResellerStatus @default(ACTIVE)
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt

  userId      String
  user        User           @relation(fields: [userId], references: [id], onDelete: Cascade)

  transactions   SaldoTransaction[]
  voucherBatches VoucherBatch[]

  @@index([userId])
  @@index([telegramId])
}

model SaldoTransaction {
  id             String               @id @default(cuid())
  type           SaldoTransactionType
  amount         Int                  // selalu positif
  balanceBefore  Int
  balanceAfter   Int
  description    String               @default("")
  createdAt      DateTime             @default(now())

  resellerId     String
  reseller       Reseller             @relation(fields: [resellerId], references: [id], onDelete: Cascade)

  @@index([resellerId])
  @@index([createdAt])
}

model VoucherBatch {
  id           String   @id @default(cuid())
  routerName   String
  profile      String
  count        Int
  pricePerUnit Int      @default(0)
  totalCost    Int
  vouchers     Json     // [{username, password}]
  source       String   @default("dashboard") // "dashboard" | "nanobot" | "reseller_bot"
  createdAt    DateTime @default(now())

  resellerId   String?                         // null jika admin langsung generate
  reseller     Reseller? @relation(fields: [resellerId], references: [id], onDelete: SetNull)

  userId       String                          // selalu ada — pemilik voucher
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([resellerId])
  @@index([userId])
  @@index([createdAt])
}
```

Tambah di `User` model:
```prisma
resellers      Reseller[]
voucherBatches VoucherBatch[]
resellerBotToken String?      // Bot token untuk reseller bot (opsional)
```

**Catatan:** `VoucherBatch.resellerId` nullable — admin bisa generate voucher langsung tanpa reseller. Field `source` melacak asal voucher (dashboard/nanobot/reseller_bot). `userId` selalu diisi untuk ownership.

**Jalankan:** `cd dashboard && npx prisma migrate dev --name add_reseller_models && npx prisma generate`

### 0.2 TypeScript Types
**File:** `dashboard/lib/types/index.ts` — tambah interface Reseller, SaldoTransaction, VoucherBatch, HotspotUser, PPPSecret, dll.

### 0.3 Reseller Service
**File baru:** `dashboard/lib/services/reseller.service.ts`

Fungsi kunci (semua pakai `prisma.$transaction` untuk atomicity):
- `createReseller(userId, data)` → create reseller milik user
- `listResellers(userId)` → list reseller milik user (scoped)
- `getReseller(resellerId, userId)` → detail + validasi ownership
- `topUpSaldo(resellerId, userId, amount, description)` → validasi + update balance + log
- `topDownSaldo(resellerId, userId, amount, description)` → validasi + cek balance cukup + update + log
- `listTransactions(resellerId, userId, pagination)` → list transaksi
- `listVoucherBatches(userId, resellerId?, pagination)` → list batch, opsional filter reseller

**Penting:** Semua operasi menerima `userId` dan memvalidasi ownership.

### 0.4 Voucher DB Module (Python)
**File baru:** `mikrotik_mcp/voucher_db.py`

Module Python ringan yang dipakai MCP tools untuk menulis VoucherBatch ke PostgreSQL:
```python
class VoucherDB:
    """Direct psycopg2 access to VoucherBatch table — same DB as Prisma."""
    
    def save_batch(self, user_id, router_name, profile, vouchers, 
                   source="nanobot", reseller_id=None, price_per_unit=0):
        """Insert VoucherBatch record. Called after successful router creation."""
    
    def get_reseller_by_telegram(self, telegram_id):
        """Lookup reseller by Telegram ID. Returns reseller + userId."""
    
    def check_saldo(self, reseller_id):
        """Return current balance."""
    
    def deduct_saldo(self, reseller_id, amount, description):
        """Atomic: deduct balance + create SaldoTransaction. Raises if insufficient."""
```

Menggunakan psycopg2 langsung (sama seperti `registry_pg.py`), bukan Prisma. Tabel menggunakan PascalCase quoted identifiers sesuai konvensi Prisma.

---

## Phase 1: Sidebar Restructuring

**File:** `dashboard/components/sidebar.tsx`

Ubah dari flat `NavItem[]` ke grouped navigation dengan collapsible sections.

```
OVERVIEW (selalu terbuka)
  ├── Dashboard          /dashboard
  └── AI Assistant       /chat

HOTSPOT
  ├── Users              /hotspot/users
  ├── Active Sessions    /hotspot/active
  └── User Profiles      /hotspot/profiles

PPP
  ├── PPP Users          /ppp/secrets
  ├── Active Sessions    /ppp/active
  └── PPP Profiles       /ppp/profiles

RESELLER
  ├── Reseller List      /resellers
  ├── Voucher History    /resellers/vouchers
  └── Reseller Bot       /resellers/bot

SYSTEM
  ├── Routers            /routers
  ├── Users              /users            [adminOnly]
  ├── Logs               /logs
  └── Communication      /communication

ACCOUNT
  ├── Profile            /profile
  ├── Plan               /plan
  ├── Settings           /settings         [adminOnly]
  └── Docs               /docs
```

Implementasi: collapsible sections, localStorage persistence, auto-open saat child route aktif, chevron animation.

**Icon baru (lucide-react):** Wifi, Signal, UserCog, Network, Activity, Settings2, Store, Receipt, MessageSquare, BotMessageSquare

---

## Phase 2: MCP Server — Modifikasi & Tools Baru

### 2.1 Modifikasi `generate_hotspot_vouchers` 
**File:** `mikrotik_mcp/server.py` (line 1734)

Setelah sukses create voucher di router, tambahkan call ke `voucher_db.save_batch()`:
```python
# Existing: create users on router
# NEW: persist to PostgreSQL
from voucher_db import VoucherDB
vdb = VoucherDB(os.environ.get("DATABASE_URL"))
vdb.save_batch(
    user_id=user_id,
    router_name=router_name,
    profile=profile,
    vouchers=created_vouchers,
    source="nanobot",  # atau "dashboard" jika dari health_server
)
```

### 2.2 MCP Tools Baru untuk Reseller
**File:** `mikrotik_mcp/server.py` — tambah tools baru:

| Tool | Deskripsi |
|------|-----------|
| `reseller_check_saldo(user_id, reseller_telegram_id)` | Cek saldo reseller |
| `reseller_generate_voucher(user_id, reseller_telegram_id, profile, count, router)` | Generate voucher + auto-deduct saldo |
| `reseller_request_deposit(user_id, reseller_telegram_id, amount)` | Kirim notifikasi deposit ke admin |
| `reseller_transaction_history(user_id, reseller_telegram_id, limit)` | Lihat riwayat transaksi |

Semua tool reseller menerima `user_id` (pemilik ISP) + `reseller_telegram_id` (ID Telegram reseller).

`reseller_generate_voucher` flow:
1. Lookup reseller by telegram_id → get reseller record + price config
2. Validate saldo >= count * price_per_unit
3. Create vouchers on router (reuse existing generate logic)
4. Atomic: deduct saldo + save VoucherBatch (source="reseller_bot")
5. Return voucher list

---

## Phase 3: Reseller Bot

### 3.1 Reseller Bot Runtime
**File baru:** `mikrotik_mcp/reseller_bot.py`

Lightweight Python Telegram bot menggunakan `python-telegram-bot` library (async, v20+). Bot ini:

- Dibuat **per user** — setiap user yang mengaktifkan reseller bot menyediakan bot token-nya
- Dijalankan dalam thread terpisah (seperti `health_server.py`)
- Mengakses MCP tools secara langsung (import dari `server.py`) — bukan via HTTP
- Mengakses `voucher_db.py` untuk operasi saldo
- **Tanpa LLM** — semua interaksi via InlineKeyboardButton

**Callback handlers (semua via InlineKeyboardButton, bukan text commands):**

```python
# /start → cek apakah sender terdaftar sebagai reseller
#   Jika ya: tampilkan menu utama dengan 4 button
#   Jika tidak: "Hubungi admin untuk didaftarkan."

# callback_data format: "action|param1|param2"
"saldo"          → voucher_db.check_saldo() → "Saldo: Rp 150.000" + tombol menu
"buy"            → tampilkan list profile sebagai buttons (ambil dari router)
"buy|5rb-1hr"    → konfirmasi: "Beli 1x 5rb-1hr? Saldo: Rp 150.000" + [Ya] [Batal]
"buy|5rb-1hr|ok" → reseller_generate_voucher() → kirim voucher + "Sisa saldo: Rp 145.000"
"deposit"        → tampilkan preset nominal buttons (10rb, 25rb, 50rb, 100rb)
"deposit|50000"  → kirim notifikasi ke admin + "Request Rp 50.000 dikirim ke admin"
"history"        → voucher_db.get_transactions(limit=10) → format as message
"menu"           → kembali ke menu utama
```

### 3.2 Bot Lifecycle Management
**File:** `entrypoint.sh` — tambah startup reseller bot

```bash
# Setelah start health_server & nanobot...
# Start reseller bot (jika bot token ada di config/DB)
python3 /app/mikrotik_mcp/reseller_bot.py &
```

Bot membaca `resellerBotToken` dari PostgreSQL (User table). Jika kosong → bot tidak start.

### 3.3 Dashboard: Reseller Bot Setup Page
**File baru:** `dashboard/app/(dashboard)/resellers/bot/page.tsx`

Halaman sederhana untuk user mengkonfigurasi reseller bot:
- Input: Bot Token (dari @BotFather)
- Tombol: "Aktifkan Bot" / "Nonaktifkan Bot"
- Status: bot running / stopped
- Instruksi: cara buat bot di BotFather, cara daftar reseller

**API route:** `POST /api/resellers/bot/route.ts` → simpan token ke User.resellerBotToken → trigger bot restart

---

## Phase 4: Health Server — Endpoint Baru

**File:** `mikrotik_mcp/health_server.py`

### GET endpoints:

| Endpoint | Deskripsi |
|----------|-----------|
| `/hotspot-users/{user_id}` | List hotspot users dari router |
| `/hotspot-active/{user_id}` | List active hotspot sessions |
| `/hotspot-profiles/{user_id}` | List hotspot user profiles |
| `/hotspot-stats/{user_id}` | Quick counts (total, active, disabled) |
| `/ppp-secrets/{user_id}` | List PPP secrets (tanpa password) |
| `/ppp-active/{user_id}` | List active PPP sessions |
| `/ppp-profiles/{user_id}` | List PPP profiles |

### POST endpoints:

| Endpoint | Deskripsi |
|----------|-----------|
| `/hotspot-user/{user_id}` | Tambah hotspot user |
| `/hotspot-user/{user_id}/{name}/enable` | Enable hotspot user |
| `/hotspot-user/{user_id}/{name}/disable` | Disable hotspot user |
| `/generate-vouchers/{user_id}` | Generate voucher + simpan ke DB (source="dashboard") |
| `/ppp-secret/{user_id}` | Tambah PPP secret |
| `/ppp-active/{user_id}/{id}/kick` | Kick PPP session |
| `/ai-insight/{user_id}` | Gather metrics → LLM analysis |
| `/send-telegram/{user_id}` | Kirim pesan Telegram |

### DELETE endpoints:

| Endpoint | Deskripsi |
|----------|-----------|
| `/hotspot-user/{user_id}/{name}` | Hapus hotspot user |
| `/ppp-secret/{user_id}/{name}` | Hapus PPP secret |

**`/generate-vouchers/{user_id}` juga menyimpan ke DB:**
Endpoint ini sekarang juga call `voucher_db.save_batch(source="dashboard")` setelah create voucher di router.

---

## Phase 5: Next.js API Routes

### Hotspot Routes (proxy ke health_server):
- `GET/POST  /api/hotspot/users/route.ts`
- `DELETE    /api/hotspot/users/[username]/route.ts`
- `POST      /api/hotspot/users/[username]/enable/route.ts`
- `POST      /api/hotspot/users/[username]/disable/route.ts`
- `GET       /api/hotspot/active/route.ts`
- `GET       /api/hotspot/profiles/route.ts`
- `GET       /api/hotspot/stats/route.ts`

### PPP Routes (proxy ke health_server):
- `GET/POST  /api/ppp/secrets/route.ts`
- `DELETE    /api/ppp/secrets/[name]/route.ts`
- `GET       /api/ppp/active/route.ts`
- `POST      /api/ppp/active/[id]/kick/route.ts`
- `GET       /api/ppp/profiles/route.ts`

### Reseller Routes (direct Prisma — scoped per user):
- `GET/POST  /api/resellers/route.ts`
- `GET/PATCH/DELETE /api/resellers/[id]/route.ts`
- `POST      /api/resellers/[id]/topup/route.ts`
- `POST      /api/resellers/[id]/topdown/route.ts`
- `GET/POST  /api/resellers/[id]/vouchers/route.ts`
- `GET       /api/resellers/[id]/vouchers/[batchId]/pdf/route.ts`
- `GET       /api/resellers/[id]/transactions/route.ts`
- `POST      /api/resellers/bot/route.ts` — save bot token + trigger restart

### Voucher Routes (global per user — semua sumber):
- `GET       /api/vouchers/route.ts` — list semua VoucherBatch milik user (dari dashboard + nanobot + reseller bot)

### Dashboard & Communication:
- `GET       /api/dashboard/ai-insight/route.ts`
- `POST      /api/telegram/send/route.ts`

---

## Phase 6: React Query Hooks

### `use-hotspot.ts`
- `useHotspotUsers(router?)`, `useHotspotActive(router?)`, `useHotspotProfiles(router?)`
- `useHotspotStats(router?)`, `useAddHotspotUser()`, `useRemoveHotspotUser()`
- `useEnableHotspotUser()`, `useDisableHotspotUser()`

### `use-ppp.ts`
- `usePPPSecrets(router?)`, `usePPPActive(router?)`, `usePPPProfiles(router?)`
- `useAddPPPSecret()`, `useRemovePPPSecret()`, `useKickPPP()`

### `use-resellers.ts`
- `useResellers()`, `useReseller(id)`, `useCreateReseller()`, `useUpdateReseller()`, `useDeleteReseller()`
- `useTopUpSaldo()`, `useTopDownSaldo()`
- `useGenerateVouchers()`, `useVoucherBatches(resellerId?)`, `useTransactions(resellerId)`

### `use-vouchers.ts`
- `useAllVouchers(filter?)` — semua voucher milik user, filter by source/reseller/date

### `use-ai-insight.ts`, `use-telegram.ts`

---

## Phase 7: Dashboard Pages

### 7.1 Enhanced Dashboard (`dashboard/page.tsx` — MODIFY)
- `DashboardHotspotStats` — card: total users, active sessions, disabled
- `DashboardWarnings` — threshold alerts (CPU > 80%, mem > 90%) — pure frontend
- `DashboardAIInsight` — card + "Generate Insight" button → LLM response

### 7.2 Hotspot Pages
- `/hotspot/users/page.tsx` — DataTable + AddDialog + enable/disable/delete
- `/hotspot/active/page.tsx` — DataTable read-only
- `/hotspot/profiles/page.tsx` — DataTable read-only

### 7.3 PPP Pages
- `/ppp/secrets/page.tsx` — DataTable + AddDialog + enable/disable/delete
- `/ppp/active/page.tsx` — DataTable + kick action
- `/ppp/profiles/page.tsx` — DataTable read-only

### 7.4 Reseller Pages
- `/resellers/page.tsx` — DataTable reseller list + AddResellerDialog + saldo display
- `/resellers/[id]/page.tsx` — Detail: info card, saldo (TopUp/TopDown), tabs (Vouchers, Transactions)
- `/resellers/vouchers/page.tsx` — Global voucher history (SEMUA sumber: dashboard, nanobot, reseller bot) dengan filter by source + reseller
- `/resellers/bot/page.tsx` — Setup reseller bot (input token, activate/deactivate, status)

### 7.5 Communication Page
- `/communication/page.tsx` — Recipient selector (reseller/user/custom chatId), message textarea, broadcast toggle

---

## Phase 8: Voucher PDF Generation

**Install:** `npm install @react-pdf/renderer` di dashboard

**File baru:** `dashboard/lib/pdf/voucher-template.tsx`
Layout: 2 kolom × 4 baris = 8 kartu per A4. Kartu berisi: username, password, profile, tanggal, branding ISP.

**API route:** `GET /api/resellers/[id]/vouchers/[batchId]/pdf`
**UI:** Tombol "Download PDF" per voucher batch

---

## Urutan Implementasi & Dependencies

```
Phase 0 (Foundation: DB + types + services + voucher_db.py) ← PERTAMA
  │
  ├── Phase 1 (Sidebar restructure)
  │
  ├── Phase 2 (MCP: modify generate_vouchers + add reseller tools)
  │
  ├── Phase 3 (Reseller Bot: reseller_bot.py + entrypoint)
  │
  ├── Phase 4 (Health Server: new endpoints)
  │
  ├── Phase 5 (Next.js API Routes)
  │
  ├── Phase 6 (React Query Hooks)
  │
  └── Phase 7 (Pages + Components)
       │
       └── Phase 8 (PDF generation)
```

**Bisa paralel setelah Phase 0:**
- Phase 1 (sidebar) ↔ Phase 2 (MCP) ↔ Phase 3 (reseller bot) ↔ Phase 4 (health server)
- Phase 5-6-7 setelah Phase 2+4 selesai
- Phase 3 (reseller bot) independen dari dashboard phases

---

## File-File Kritis

| File | Perubahan |
|------|-----------|
| `dashboard/prisma/schema.prisma` | +3 model, +2 enum, +relasi, +resellerBotToken field |
| `mikrotik_mcp/server.py` | Modify generate_hotspot_vouchers + add 4 reseller tools |
| `mikrotik_mcp/voucher_db.py` | **BARU** — Python module untuk VoucherBatch & saldo ops ke PostgreSQL |
| `mikrotik_mcp/reseller_bot.py` | **BARU** — Lightweight Telegram bot untuk reseller (button-only, no LLM) |
| `mikrotik_mcp/health_server.py` | +15 endpoint handlers |
| `dashboard/components/sidebar.tsx` | Restructure ke collapsible groups |
| `entrypoint.sh` | Tambah startup reseller bot |

## File-File Referensi (Pattern to Follow)

| File | Pattern |
|------|---------|
| `mikrotik_mcp/registry_pg.py` | psycopg2 access ke PostgreSQL (untuk voucher_db.py) |
| `mikrotik_mcp/health_server.py:77` | Health server handler pattern |
| `mikrotik_mcp/server.py:1734` | generate_hotspot_vouchers (yang akan dimodifikasi) |
| `dashboard/app/api/routers/health/route.ts` | API route proxy pattern |
| `dashboard/app/api/routers/route.ts` | API route direct Prisma pattern |
| `dashboard/hooks/use-routers.ts` | React Query hook pattern |
| `dashboard/components/user-table.tsx` | DataTable component pattern |
| `dashboard/components/add-router-dialog.tsx` | Dialog/modal form pattern |

---

## Verification / Testing

1. **Database:** `npx prisma migrate dev` + `npx prisma generate` sukses
2. **MCP tools:** Test `generate_hotspot_vouchers` via Nanobot → cek VoucherBatch muncul di DB
3. **Health server:** curl setiap endpoint baru di `localhost:8080`
4. **API routes:** Test `/api/hotspot/*`, `/api/ppp/*`, `/api/resellers/*`
5. **Reseller flow end-to-end:**
   - Dashboard: buat reseller → top-up saldo → generate voucher → saldo berkurang → download PDF → hotspot user terbuat di router → voucher muncul di voucher history
6. **Nanobot flow:** Generate voucher via Telegram bot → cek voucher muncul di dashboard
7. **Reseller bot flow:**
   - Set bot token di dashboard → bot mulai
   - Reseller klik "Cek Saldo" → saldo tampil
   - Reseller klik "Beli Voucher" → pilih profile → konfirmasi → voucher dikirim + saldo berkurang + muncul di dashboard
   - Reseller klik "Deposit" → pilih nominal → notifikasi diterima admin
8. **AI Insight:** Generate → LLM response tampil
9. **Communication:** Kirim Telegram → pesan diterima
10. **Sidebar:** Collapsible groups + navigasi + admin-only filtering
11. **Build:** `npm run build` sukses
