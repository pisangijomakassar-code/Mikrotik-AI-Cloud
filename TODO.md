# MikroTik AI Agent — Status & Todo

> Terakhir update: 2026-04-24

---

## ✅ SUDAH SELESAI

### Router — Add/Edit Dialog
- [x] **Host:Port auto-split** — ketik `id30.tunnel.my.id:12065` di field HOST → blur → otomatis split jadi HOST=`id30.tunnel.my.id`, PORT=`12065` *(sudah ditest via Playwright, berfungsi)*
- [x] **Posisi Test Koneksi** dipindah ke bawah field Password (include login test username+password)
- [x] **Section baru di form Add/Edit Router**:
  - MikroTik DNS → field DNS Hotspot (opsional)
  - Owner (Telegram) → Username Owner, ID Telegram Owner
  - Bot Settings → Token Bot, Username Bot
- [x] Backend `test-connection` route pakai `parseHostPort()` sebagai safety net
- [x] `router.service.ts` — save/encrypt field baru (botToken, dnsHotspot, dll)
- [x] Prisma schema Router: tambah `dnsHotspot`, `telegramOwnerUsername`, `telegramOwnerId`, `botToken`, `botUsername`

### Reseller — Schema & Data Layer
- [x] Prisma schema Reseller: tambah `discount`, `voucherGroup`, `uplink`
- [x] Prisma schema SaldoTransaction: tambah `hargaVoucher`, `voucherUsername`, `voucherPassword`, `voucherInfo`
- [x] Hook `use-resellers.ts`: interface `ResellerData` & `TransactionData` proper typed
- [x] `reseller.schema.ts`: validasi Zod untuk field baru
- [x] `reseller.service.ts`: `createReseller` simpan field baru
- [x] `add-reseller-dialog.tsx`: form lengkap (Nama, Username/ID Telegram, HP, Saldo awal, Diskon%, Grup Voucher, Uplink)
- [x] DB Migration: semua kolom baru sudah di-apply ke PostgreSQL via `docker exec psql`

### Reseller — Halaman & API
- [x] `resellers/page.tsx`: rewrite Mikbotam-style
  - Tabel compact (py-1.5), kolom: No, ID User, Nama Reseller, Diskon(%), Uplink, Saldo, Group VCR, Last Update, Operation
  - Search bar (nama/telegramId/HP)
  - Edit inline dialog dengan semua field baru
  - Top Up / Top Down dialog dengan prefix Rp.
  - Link ke History Transaksi
- [x] `resellers/transactions/page.tsx`: halaman History Transaksi baru
  - Kolom: No, ID User, Nama Reseller, Harga Voucher, Saldo Awal, Saldo Akhir, Top Up, Username/Password Voucher, Voucher Info, Keterangan, Waktu/Tanggal
  - Badge type: TOP UP (hijau), TOP DOWN (merah), VOUCHER (cyan)
  - Search + pagination
- [x] `app/api/resellers/history/route.ts`: API endpoint history transaksi global (filter by userId, search, pagination)
- [x] Sidebar `nav-config.ts`: tambah "History Transaksi" di grup Reseller

### Build & Deploy
- [x] Fix TypeScript build error (`use-resellers.ts:57` — `Reseller` type tidak ditemukan)
- [x] Docker build sukses, container di-restart dengan kode terbaru

### Voucher
- [x] **GEN-1 Generate Voucher** — form generate di `/resellers/vouchers`: pilih profile, qty, prefix, tombol generate, list hasil, tombol cetak
- [x] **VCH-2 Voucher History** — tabel batch voucher di `/resellers/vouchers`: filter source/reseller, pagination, badge source
- [x] **VCH-1 Print Voucher (3 jenis)** — `print-voucher-sheet.tsx` mendukung 3 layout:
  - **Default** — 4 kolom, username + password + QR kecil
  - **QR Code** — 3 kolom, QR besar (96px), layout portrait per kartu
  - **Small** — 5 kolom, compact tanpa QR, hanya username/password
  - Layout selector di toolbar cetak, print CSS auto-apply grid kolom sesuai layout
- [x] **Tombol Print per-row di Hotspot Users** — ikon printer di setiap baris, buka PrintVoucherSheet untuk 1 voucher

### Hotspot Users
- [x] **PRF-1 Fix filter profile** — dropdown diganti native `<select>`, tidak ada timing issue
- [x] API `health_server.py` `/hotspot-users` sekarang mengembalikan field `password`
- [x] **HSU-1 Hotspot User List upgrade** — kolom Mac Address, tombol Export CSV, print per-row

### Laporan & Bot
- [x] **RPT-1 Laporan (Reports)** — halaman `/reports` dengan summary cards, tabel voucher + transaksi, export CSV per tab
- [x] **BOT-1 Reseller Bot Config** — halaman `/resellers/bot`, API GET/POST/DELETE, token mask, instruksi setup
- [x] **QR-1 Bukti Deposit** — upload foto bukti transfer di dialog Top Up, compress ke JPEG 800px, simpan base64 ke DB; thumbnail + full-view di History Transaksi
- [x] **LGT-1 Light Mode** — tambah `--color-surface-*` / `--color-tertiary` tokens ke `@theme inline`; batch replace 55+ file: `#131b2e`→`bg-surface-low`, `#222a3d`→`bg-muted`, `#dae2fd`→`text-foreground`, `#4cd7f6`→`text-primary`, dll; `border-white/5`→`border-border/20`, `divide-white/5`→`divide-border/20`

---

## 🚧 IN PROGRESS — Tunnel Manager (OpenVPN + WireGuard)

### Latar Belakang
User punya 1 VPS (IP publik) + 3 MikroTik (behind NAT).
Saat ini pakai mytunnel.id (OVPN client di MikroTik → server mytunnel).
Tujuan: pindah ke VPS sendiri, integrasi ke dashboard.

### Yang Dibutuhkan

#### 1. Backend VPS — OpenVPN Server
- [ ] Tambah container `openvpn` di `docker-compose.yml`
- [ ] Script auto-setup: init PKI, buat CA, server cert
- [ ] Config `server.conf`: mode TCP (karena MikroTik OVPN client hanya support TCP), subnet `10.8.0.0/24`
- [ ] API untuk buat/hapus user (cert per MikroTik): `POST /api/tunnel/users`
- [ ] `ifconfig-push` per user → IP VPN fix per MikroTik (tidak berubah-ubah)

#### 2. Port Forwarding Winbox
- [ ] Assign port unik per MikroTik untuk Winbox (8291):
  - MikroTik-1 → VPS:18291 → 10.8.0.2:8291
  - MikroTik-2 → VPS:28291 → 10.8.0.3:8291
  - dst.
- [ ] Manage iptables rules via API: `POST /api/tunnel/portforward`
- [ ] Simpan mapping port ke DB

#### 3. Dashboard — Halaman Tunnel Manager (`/tunnel`)
- [ ] Tabel: daftar tunnel (nama MikroTik, VPN IP, status online/offline, port Winbox)
- [ ] Tombol **+ Tambah Tunnel** → generate user OVPN → tampilkan:
  - Script CLI MikroTik (copy-paste langsung ke terminal)
  - File `.ovpn` untuk download (jika pakai laptop)
- [ ] Status real-time: ping ke VPN IP tiap MikroTik
- [ ] Tombol **Buka Winbox** → link `winbox://VPS_IP:port`
- [ ] Tombol **Hapus Tunnel** → revoke cert + hapus port forward

#### 4. Integrasi ke Router Management
- [ ] Saat Add Router: jika pilih "via Tunnel" → auto-isi HOST dari VPN IP yang sudah terdaftar
- [ ] Badge di tabel router: "TUNNEL" vs "DIRECT"

### Keputusan Arsitektur (Final)
| Parameter | Keputusan | Alasan |
|-----------|-----------|--------|
| Protokol | OpenVPN TCP | RouterOS 6 hanya support TCP |
| Auth MikroTik | Username + Password | RouterOS 6, cert support terbatas |
| Cipher | AES-256-CBC | Kompatibel RouterOS 6 |
| TLS Auth | SHA1 | RouterOS 6 |
| Winbox akses | Port forward VPS | Tidak perlu VPN di laptop |
| mytunnel.id | Tetap jalan (backup) | Dual tunnel, tidak konflik |
| IP VPN | Static per MikroTik | `ifconfig-push` di ccd/ |

### Constraints
- **RAM VPS tersisa**: 300 MB → OpenVPN container pakai ~30-50 MB, masih aman
- **RouterOS 6**: tidak support WireGuard, tidak support TLS 1.3 → config OVPN harus legacy-compatible
- **3 MikroTik** sudah online via mytunnel → bisa test paralel tanpa downtime

### Kebutuhan Teknis
- Container: `openvpn` (image: `kylemanna/openvpn`) — ringan, ~30-50 MB RAM
- Port VPS yang perlu dibuka di firewall: `1194/tcp` (OVPN), `18291/tcp`, `28291/tcp`, `38291/tcp` (Winbox)
- Storage tambahan: < 50 MB
- Tidak perlu install apapun di laptop — Winbox langsung ke `VPS_IP:port`

### Script MikroTik yang akan di-generate (RouterOS 6)
```routeros
/interface ovpn-client add \
  name=tunnel-vps \
  connect-to=VPS_IP \
  port=1194 \
  mode=ip \
  user=mikrotik-1 \
  password=GENERATED_PASS \
  cipher=aes256 \
  auth=sha1 \
  add-default-route=no \
  disabled=no
```

---

## 🗂️ File-file Penting

```
D:\project\mikrotik-ai-agent\
├── dashboard\
│   ├── app\
│   │   ├── (dashboard)\
│   │   │   ├── resellers\
│   │   │   │   ├── page.tsx                    ← Reseller list (Mikbotam-style)
│   │   │   │   ├── transactions\page.tsx       ← History Transaksi
│   │   │   │   └── vouchers\page.tsx           ← Voucher History + Generate
│   │   │   ├── hotspot\users\page.tsx          ← Print per-row + filter profile
│   │   │   └── routers\page.tsx
│   │   └── api\
│   │       ├── resellers\history\route.ts
│   │       └── routers\test-connection\route.ts
│   ├── components\
│   │   ├── print-voucher-sheet.tsx             ← 3 layout: Default, QR Code, Small
│   │   ├── add-router-dialog.tsx
│   │   ├── edit-router-dialog.tsx
│   │   ├── dialogs\add-reseller-dialog.tsx
│   │   └── sidebar\nav-config.ts
│   └── hooks\use-resellers.ts
├── mikrotik_mcp\
│   └── health_server.py                        ← password field di hotspot-users endpoint
```
