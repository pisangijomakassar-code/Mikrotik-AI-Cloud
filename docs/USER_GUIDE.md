# Panduan Pengguna — MikroTik AI Agent

Panduan ini fokus ke pengelolaan voucher hotspot lewat dashboard.
Untuk perintah Telegram bot natural language, lihat [API_REFERENCE.md](./API_REFERENCE.md).

---

## Daftar Isi

1. [Konsep Inti](#konsep-inti)
2. [Setup Awal](#setup-awal)
3. [Navigasi Dashboard](#navigasi-dashboard)
4. [Hotspot Profile](#hotspot-profile)
5. [Generate Voucher](#generate-voucher)
6. [Cetak Voucher](#cetak-voucher)
7. [Setting Voucher (Bot)](#setting-voucher-bot)
8. [Laporan](#laporan)
9. [Log Aktivitas](#log-aktivitas)
10. [Sinkronisasi & Maintenance](#sinkronisasi--maintenance)
11. [Pertanyaan Umum (FAQ)](#pertanyaan-umum-faq)

---

## Konsep Inti

### Bagaimana voucher bekerja

Setiap voucher punya 3 fase lifecycle:

| Fase | Keterangan |
|------|-----------|
| **Generated** | Voucher dibuat di dashboard / agent → tercatat di tabel `VoucherBatch`. Akun voucher dibuat di MikroTik (`/ip hotspot user`) dengan `comment` kosong. Belum jadi pendapatan. |
| **Activated** | User pertama kali login pakai voucher. On-login script di profil menulis datetime expiry ke `comment` user, plus log transaksi ke `/system script` (mode *c). **Inilah momen pendapatan dihitung**. |
| **Expired / Removed** | Setelah masa berlaku habis, `bgservice` scheduler menjalankan aksi sesuai mode profil: `set limit-uptime=1s` (Notice) atau `remove user` (Remove). |

Aplikasi ini **kompatibel dengan Mikhmon** — format on-login script dan log
transaksi di RouterOS sama persis, sehingga bisa dipakai bersama Mikhmon UI di
router yang sama.

### Sumber data laporan

Dashboard membaca data dari **PostgreSQL** (cepat, aman) — bukan query langsung
ke RouterOS tiap kali. Sinkronisasi otomatis jalan tiap **1 jam**, atau bisa
trigger manual lewat tombol "Sinkron Sekarang" di halaman Laporan.

---

## Setup Awal

### 1. Tambah Router

**System → Routers → Tambah Router**

Field penting:
- **Nama** — identifier (e.g. `ummi`)
- **Host & Port** — IP/hostname RouterOS API + port (default 8728)
- **Username & Password** — credential MikroTik dengan API access

**Section "Hotspot Branding"** (opsional, untuk cetak voucher):
- **DNS Hotspot** — DNS hotspot router (untuk QR code login)
- **Nama Hotspot** — display name di header voucher cetak (kalau kosong → fallback ke nama router)
- **Logo Hotspot URL** — URL gambar logo (opsional)

### 2. Tambah Reseller (opsional)

**Reseller → Reseller List → Add Reseller**

Field:
- **Nama** + **WhatsApp**
- **Diskon (%)** — auto-applied saat reseller pilih voucher
- **Voucher Group** — filter jenis voucher yang boleh diakses reseller (default `default`)

---

## Navigasi Dashboard

### Router Aktif (Sidebar)

Di **bawah brand "MikroTik AI"** ada card **"Router aktif"** yang menampilkan
nama router yang sedang aktif untuk semua menu.

```
┌──────────────────────────┐
│ 🤖 MikroTik AI           │
│    AI-Driven Network     │
├──────────────────────────┤
│ 📡 ROUTER AKTIF          │
│ ┌──────────────────────┐ │
│ │ ummi              ▼  │ │   ← klik untuk ganti
│ └──────────────────────┘ │
└──────────────────────────┘
```

Klik card → modal popup dengan daftar semua router milik kamu beserta status
(online/warning/offline). Pilihan tersimpan di browser (localStorage), semua
menu akan otomatis menampilkan data router yang dipilih.

Card menjadi tombol "+ Tambah Router" kalau kamu belum punya router terdaftar.

### Top Bar — Status Real-time

Di header atas (sebelah kanan tombol menu) ada deretan pill status real-time
untuk router aktif:

```
🟢 LLM ready · CPU 14% · RAM 17% · HDD 42% · 📶 38 · 👥 587
```

| Pill | Sumber data |
|------|-------------|
| 🟢/🔴 LLM ready/down | Health agent backend |
| CPU | `/system resource` cpu-load |
| RAM | `(total - free) / total × 100` |
| HDD | `(total - free) / total × 100` |
| 📶 N | Active hotspot session sekarang |
| 👥 N | Total user voucher di RouterOS |

Warna otomatis: **hijau** kalau aman (<70%), **kuning** warning (70-84%), **merah**
critical (≥85%).

### Smart polling (hemat resource RouterOS)

Top bar polling setiap **30 detik**, dengan optimasi:

| Kondisi | Polling? |
|---------|----------|
| Tab aktif & user aktif | ✅ Tiap 30 detik |
| Tab dashboard di background (Ctrl+Tab/Alt+Tab) | ⏸ Pause otomatis (Page Visibility API) |
| User idle > 30 menit (no mouse/keyboard) | ⏸ Pause + tampil pill "paused" + tombol Refresh |
| Kembali fokus / klik Refresh | ▶ Refresh sekali + lanjut polling 30s |

Plus **server-side cache 25 detik** di agent — 100 user yang buka dashboard tetap
hanya ~2 query/menit ke RouterOS.

### Network Throughput — tabs

Card Network Throughput di dashboard punya 3 tab:

| Tab | Sumber data | Reset kapan? |
|-----|-------------|--------------|
| **Sejak Reboot** | Counter live `/interface` dari RouterOS | Otomatis nol saat router reboot |
| **Bulan Ini** | Akumulasi delta snapshot dari TrafficSnapshot DB | Tanggal 1 setiap bulan |
| **30 Hari** | Akumulasi delta snapshot 30 hari terakhir | Rolling — selalu 30 hari ke belakang dari hari ini |

**Cara kerja "Bulan Ini" / "30 Hari"**

- Agent jalankan cron tiap **10 menit** → ambil counter `tx-byte/rx-byte` semua
  interface running, simpan ke tabel `TrafficSnapshot`.
- Saat dibuka, dashboard hitung **delta antar snapshot berurutan** lalu sum.
  Reboot terdeteksi otomatis: kalau counter lebih kecil dari sebelumnya → dianggap
  reset, sample tsb dipakai sebagai base baru (delta tidak negatif).
- **Retention 12 bulan**. Cron mingguan otomatis hapus snapshot yang lebih lama.

**Spek kapasitas**: 100 user × 1 router × ~10 interface × snapshot tiap 10 menit
× 12 bulan ≈ ~1.7 GB. Negligible untuk PostgreSQL.

---

## Hotspot Profile

**Hotspot → User Profiles**

Profile menentukan rate limit, masa berlaku, dan mode expired voucher di
RouterOS.

### Field penting

| Field | Keterangan |
|-------|-----------|
| **Nama Profile** | Identifier di MikroTik (mis. `1jam`, `12jam`, `24jam`) |
| **Rate Limit** | TX/RX, mis. `1M/1M` |
| **Shared Users** | Berapa device boleh login bersamaan |
| **Expired Mode** | Lihat penjelasan di bawah — default `Notice & Record` |
| **Validity** | Masa berlaku sejak login pertama (mis. `12h`, `1d`, `30d`) |
| **Lock User (MAC binding)** | `Yes` = voucher terkunci ke device login pertama; `No` = bebas dipakai di device lain |
| **Transparent Proxy** | Aktifkan transparent proxy untuk profile ini |

### 5 Pilihan Expired Mode

| Mode | Aksi saat expired | User di RouterOS | Log activation |
|------|------------------|-----------------|----------------|
| **Notice & Record** ⭐ (default) | `set limit-uptime=1s` | tetap ada (disable) | ✅ |
| **Remove & Record** | `remove user` | hilang | ✅ |
| **Notice (no log)** | `set limit-uptime=1s` | tetap ada (disable) | ❌ |
| **Remove (no log)** | `remove user` | hilang | ❌ |
| **None** | (tidak auto-expire) | tetap ada selamanya | ❌ |

**Kenapa default Notice & Record (`ntfc`)?** User TIDAK dihapus saat expired —
data uptime/bytes tetap bisa dilihat untuk audit. Plus log activation tersimpan
di `/system script` untuk laporan akurat.

### Saat profile dibuat

Backend otomatis:
1. Set `on-login` script di profile (sesuai mode + validity).
2. Buat scheduler `<profile>service` interval 1 menit yang loop semua user
   dalam profile, parse comment expiry datetime, dan apply aksi expired.
3. Hardcode `status-autorefresh=1m`, `transparent-proxy` sesuai pilihan.

Saat profile dihapus, `bgservice` scheduler otomatis ikut dibersihkan.

---

## Generate Voucher

**Reseller → Generate Voucher**

Form bisa dipakai **dengan atau tanpa Jenis Voucher (Bot)** yang tersimpan.

### Field

| Field | Keterangan |
|-------|-----------|
| Jumlah Voucher | 1–200 per generate |
| Reseller | Opsional. Pilih reseller → diskon (%) auto-fill |
| Diskon Reseller (%) | Diskon dari harga end-user. Bisa di-override |
| Harga End User (Rp) | Harga jual ke konsumen akhir |
| Mark Up (Rp) | Markup di atas harga end-user (di-skip kalau ada diskon) |
| Jenis Voucher (opsional) | Pilih template tersimpan untuk auto-fill default |
| Profil Hotspot * | Wajib kalau Jenis Voucher tidak dipilih |
| Server / Router | Default = router default user |
| Prefix | Awalan username (mis. `Mu`, `1J-`) |
| Panjang Karakter | 3–8 karakter random |
| Tipe Karakter | `Random abcd2345` / `Random ABCD2345` / `Random 1234` / dll |
| Tipe Login | `Username = Password` (kode tunggal) atau `Username & Password` (terpisah) |
| Limit Uptime | Opsional. Cap waktu pemakaian aktif (akumulasi sesi) |
| Limit Quota (Mb) | Opsional. Cap total bytes |

### Saat generate

1. Backend bikin N akun di `/ip hotspot user` dengan profile yang dipilih.
2. Batch tercatat di tabel `VoucherBatch` (PostgreSQL) dengan info reseller,
   harga, markup, dll.
3. Hasil voucher (username/password) tampil di panel kanan untuk di-copy.

---

## Cetak Voucher

**Reseller → Cetak Voucher**

Cetak voucher fisik dari batch yang sudah di-generate.

### Filter

- **Mode**: `Terbaru` (1 batch terakhir) atau `Custom` (rentang tanggal)
- **Reseller**: filter per reseller atau semua
- **Profil Hotspot / Jenis Voucher**: filter per profil
- **Tipe Cetak**:
  - **Kartu A4 (custom jumlah/halaman)** — input 10–100 voucher per halaman, grid otomatis menyesuaikan
  - **Thermal (58mm strip)** — 1 voucher per strip untuk printer thermal Bluetooth
- **Tampilkan harga**: toggle untuk hide/show harga di voucher

### Layout dinamis (Kartu A4)

| Per Halaman | Grid | Tinggi Kartu | Density |
|------------|------|-------------|---------|
| 20 | 4×5 | 57.4mm | besar (vc-roomy) |
| 40 | 5×8 | 35.9mm | medium |
| 80 | 8×10 | 28.7mm | kecil (vc-small) |
| 100 | 8×13 | 22.1mm | sangat kecil (vc-tiny) |

Font + padding auto-scale berdasarkan tinggi kartu.

### Yang ditampilkan per voucher

- Nama hotspot (dari `Router.hotspotName` atau fallback `Router.name`)
- Username (font monospace bold)
- Validity (ter-translate ke "X Jam / X Hari")
- Harga (prioritas: profile.sellPrice → batch.hargaEndUser → batch.pricePerUnit)
- Nama reseller (kecil, italic) — kalau batch punya reseller

### Print

Klik **Cetak (N)** → browser native print dialog (`window.print()`). Sidebar dan
header dashboard otomatis di-hide saat print, hanya konten voucher yang muncul.

---

## Setting Voucher (Bot)

**Reseller → Setting Voucher (Bot)**

Template voucher yang dipakai bot Telegram reseller saat customer beli voucher.

Field utama:
- **Nama Voucher** (display name, mis. "Voucher 1 Hari")
- **Profile Hotspot** (link ke profile di MikroTik)
- **Harga** (modal/cost) + **Mark Up**
- **Limit Uptime / Quota** (opsional, cap di akun user voucher)
- **Type Char / Type Login** / **Prefix** / **Panjang Karakter**
- **Voucher Group** (multi-select) — control reseller mana yang boleh akses
- **Voucher Color** — warna kartu voucher di Telegram

> ⚠️ **Save di sini TIDAK menyentuh MikroTik** — hanya tersimpan di PostgreSQL.
> Voucher fisik dibuat saat **Generate Voucher** atau saat reseller buy via bot.

---

## Laporan

**Reseller → Laporan**

### Status Sinkronisasi RouterOS

Card di atas:
- **Sinkron terakhir**: kapan auto-sync terakhir berhasil per router
- **/system script (mikhmon)**: jumlah entri + estimasi bytes
- Tombol **Sinkron Sekarang** — pull `/system script` ke PostgreSQL on-demand
- Tombol **Bersihkan log lama** — hapus entri lebih lama dari N bulan (default 6,
  preset 3/6/12/24, custom 1–120). Sync ke DB dulu, baru hapus dari router.

### Voucher Lifecycle (3 angka)

| Metric | Sumber |
|--------|--------|
| **Generated** | Total voucher dari batch dengan source ≠ `mikhmon_import*` (= dashboard generate) |
| **Activated (Realized)** | Total voucher dari batch `mikhmon_import:*` (dari sync /system script — momen login pertama). **Inilah pendapatan riil** |
| **Belum Aktif (Stock)** | `Generated − Activated` |
| **Activation Rate** | `Activated / Generated × 100%` |

### Filter

- **Pilih Bulan** (default = bulan ini)
- **Tanggal Custom** (opsional, override bulan)
- **Filter Reseller** (semua atau spesifik)

### Tabel Voucher Terjual

Klik baris batch → modal popup detail per voucher:
- Username, Status (Belum aktif / Aktif / Hilang/Expired), Uptime, Comment expiry datetime
- Summary chips per status

### Import Data Penjualan

Tombol di header — manual import script Mikhmon dari router untuk bulan tertentu.

---

## Log Aktivitas

**System → Log Aktivitas**

Log real-time dari RouterOS, **default tampil event voucher saja**:
- `voucher xxx login` — user voucher login
- `voucher xxx logout (reason)` — user logout dengan alasan
- `voucher xxx gagal login: ...` — percobaan login gagal

### Filter Topik

| Pilihan | Yang ditampilkan |
|---------|------------------|
| **Voucher (login/logout/gagal)** ⭐ default | Hanya event hotspot user authentication |
| **Semua event hotspot** | Semua log dengan topic `hotspot` |
| **Semua topik** | Tanpa filter |
| System / Firewall / DHCP / Wireless | Per topic standard MikroTik |
| Error / Warning / Info | Per severity |

Auto-refresh tiap 10 detik. Bisa pilih router & jumlah entri (50/100/200/500).

---

## Sinkronisasi & Maintenance

### Auto-sync 1 jam

Background cron jalan tiap 1 jam, untuk setiap router yang terdaftar:
- Pull `/system script` filter `comment=mikhmon` dari RouterOS
- Upsert ke PostgreSQL `VoucherBatch` dengan source `mikhmon_import:YYYY-MM`

**Tidak pernah hapus** dari router — itu operasi terpisah lewat tombol "Bersihkan
log lama".

### Cleanup script lama

Tombol **Bersihkan log lama** di Reports:
1. Pilih retention (1–120 bulan, preset 3/6/12/24)
2. Klik **Preview Dulu (Dry-run)** → tampil `wouldDelete: N entries, kept: M, cutoff: YYYY-MM`
3. Klik **Sinkron + Hapus N Script** → atomic operation:
   - Sync semua script ke PostgreSQL dulu (data aman di DB)
   - Lalu delete script lama dari `/system script` di RouterOS

Disarankan jalan sebulan sekali kalau pemakaian voucher tinggi.

### Auto-cleanup user expired

Background cron tiap 5 menit hapus user dengan `limit-uptime` tercapai
(legacy mechanism untuk batch lama yang tidak pakai bgservice).

---

## Pertanyaan Umum (FAQ)

### Saya buat profile baru tapi voucher dari profile itu tidak hangus saat validity habis. Kenapa?

Cek:
1. **Expired Mode bukan `None`** — kalau None, on-login script tidak di-set, tidak ada bgservice scheduler.
2. **Validity tidak kosong** — kalau kosong, mekanisme expiry mati.
3. **bgservice scheduler aktif** — buka Winbox → System → Scheduler, cari `<nama_profile>service`, pastikan `disabled=no`.
4. **User sudah login pertama kali** — kalau belum, comment expiry datetime belum di-set, scheduler tidak akan trigger.

### Voucher dari Mikhmon (yang dibuat sebelum pakai dashboard ini) tampil di Reports?

Ya, otomatis. Auto-sync setiap 1 jam pull semua `/system script` dengan
`comment=mikhmon` ke PostgreSQL. Voucher Mikhmon tampil di tab "Voucher Terjual"
dengan source `mikhmon_import:YYYY-MM`.

### Generated 0 di Voucher Lifecycle, kenapa?

Berarti semua voucher di rentang waktu yang dipilih berasal dari Mikhmon import
(bukan dari dashboard generate). Ini wajar untuk data historis. Voucher yang
di-generate via dashboard akan menambah angka Generated.

### Saya hapus profile, tapi bgservice scheduler masih ada?

Backend handler delete profile sudah cleanup `<profile>service` scheduler
otomatis. Kalau masih ada, mungkin nama profile berbeda dari nama scheduler —
hapus manual lewat Winbox → System → Scheduler.

### Cetak voucher Thermal — header tidak ada logo

Logo voucher belum di-render sebagai `<img>` (current limitation). Yang tampil:
nama hotspot text, username, validity, harga, reseller. Logo URL tersimpan di
Router setting tapi rendering masih placeholder.

### Reseller bayar pakai apa?

Lewat bot Telegram (Reseller Bot) — reseller buy voucher → debit saldo
(`SaldoTransaction.type = VOUCHER_PURCHASE`). Saldo bisa di-top up via Bot Owner
atau manual via Reseller List page.

---

## Versi & Update

Dokumentasi ini di-update setiap kali ada perubahan UI/fitur. Cek log commit
[di GitHub](https://github.com/codevjs/mikrotik-ai-agent) untuk perubahan terbaru.

| Versi | Tanggal | Ringkasan |
|-------|---------|-----------|
| 2.1 | 2026-04-30 | Tambah section "Navigasi Dashboard" — Router Aktif selector di sidebar, Top Bar quickstats pills (CPU/RAM/HDD/client/users) dengan smart polling (Page Visibility + idle 30 menit) |
| 2.0 | 2026-04-29 | Rewrite full bahasa Indonesia. Tambah dokumentasi: 5 expired mode, Cetak Voucher dynamic perPage, Voucher Lifecycle 3 angka, sync & cleanup tools, log filter voucher |
| 1.0 | 2025 | Initial — fokus Telegram bot natural language commands |
