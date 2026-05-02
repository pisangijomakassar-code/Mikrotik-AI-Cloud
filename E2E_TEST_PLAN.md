# E2E Test Plan — MikroTik AI Cloud

> Level: High-Level (happy path + critical edge cases)  
> Tools target: Playwright + vitest atau manual via browser

---

## 1. Authentication

| # | Skenario | Steps | Expected |
|---|---|---|---|
| A1 | Login SUPER_ADMIN berhasil | Buka `/login`, isi `superadmin@bukakanet.id` + password, submit | Redirect ke `/platform` |
| A2 | Login Tenant ADMIN berhasil | Isi `admin@mikrotik.local` + password | Redirect ke `/dashboard` |
| A3 | Login gagal — password salah | Isi email valid + password salah | Tampil pesan error, tetap di `/login` |
| A4 | Akses halaman protected tanpa login | Buka `/dashboard` langsung | Redirect ke `/login` |
| A5 | Logout | Klik avatar → Logout | Session dihapus, redirect ke `/login` |

---

## 2. SUPER_ADMIN — Platform Console

| # | Skenario | Steps | Expected |
|---|---|---|---|
| B1 | Lihat daftar tenant | Login SUPER_ADMIN → `/platform/tenants` | List tenant tampil, ada kolom plan & status |
| B2 | Buat tenant baru | Klik "Tambah Tenant" → isi form → Submit | Tenant muncul di list, dapat login |
| B3 | Ubah plan tenant FREE → PRO | Pilih tenant → ubah plan ke PRO → Save | Tenant login → sidebar & billing page tampilkan PRO |
| B4 | Ubah plan tenant PRO → PREMIUM | Sama seperti B3 | Billing page tampilkan PREMIUM, limit token = ∞ |
| B5 | Toggle feature flag tenant | Masuk detail tenant → toggle fitur ON/OFF | Fitur muncul/hilang di sidebar tenant |
| B6 | Buat announcement | `/platform/announcements` → isi form → Publish | Announcement tampil di dashboard tenant |
| B7 | Hapus announcement | Klik hapus pada announcement | Hilang dari list & dari dashboard tenant |
| B8 | SUPER_ADMIN tidak bisa akses router API | Cek console saat di `/platform` | Tidak ada error 500 di console |

---

## 3. Tenant ADMIN — Router & Network

| # | Skenario | Steps | Expected |
|---|---|---|---|
| C1 | Tambah router (plan FREE, slot kosong) | `/routers` → Tambah Router → isi form | Router tersimpan, muncul di list |
| C2 | Tolak tambah router jika limit tercapai | Plan FREE (max 1) → tambah router ke-2 | Tombol disabled atau error "Slot penuh" |
| C3 | Tambah router (plan PRO, max 3) | Sama → tambah router ke-2 | Berhasil |
| C4 | Lihat status health router | `/routers` | Pill online/offline + CPU/RAM tampil |
| C5 | Hapus router | Klik hapus → confirm | Router hilang dari list |

---

## 4. Tenant ADMIN — Hotspot

| # | Skenario | Steps | Expected |
|---|---|---|---|
| D1 | Lihat daftar hotspot users | `/hotspot/users` | List user tampil dari RouterOS |
| D2 | Lihat active sessions | `/hotspot/active` | Session aktif tampil realtime |
| D3 | Generate voucher batch | `/vouchers/generate` → pilih profil + jumlah | Voucher ter-generate, muncul di list |
| D4 | Print voucher | Pilih batch → Print | Preview print terbuka |

---

## 5. Tenant ADMIN — Reseller

| # | Skenario | Steps | Expected |
|---|---|---|---|
| E1 | Tambah reseller | `/resellers` → Tambah | Reseller tersimpan |
| E2 | Top up saldo reseller | Pilih reseller → Top Up → nominal | Saldo bertambah |
| E3 | Lihat transaksi reseller | `/resellers/transactions` | Histori transaksi tampil |

---

## 6. Billing & Plan

| # | Skenario | Steps | Expected |
|---|---|---|---|
| F1 | Billing page tampilkan plan aktif | Login ADMIN → `/settings/billing` | Plan sesuai data DB (bukan selalu FREE) |
| F2 | Token usage tampil hari ini | Sama | Angka token usage ter-update |
| F3 | Daftar invoice tampil | Sama | Invoice list atau "No invoices yet" |
| F4 | SUPER_ADMIN ubah plan → tenant refresh billing | B3/B4 → login tenant → buka billing | Plan langsung berubah tanpa perlu logout |

---

## 7. Payment (Xendit — belum diimplementasi)

| # | Skenario | Steps | Expected |
|---|---|---|---|
| G1 | Checkout upgrade plan | Klik "Upgrade ke PRO" → pilih metode | Redirect ke payment page Xendit |
| G2 | Pembayaran VA berhasil | Simulasi webhook Xendit `payment.succeeded` | Status subscription berubah ACTIVE, invoice PAID |
| G3 | Pembayaran gagal / expired | Simulasi webhook `payment.expired` | Invoice FAILED, plan tidak berubah |
| G4 | Duplikasi webhook | Kirim webhook sama 2x | Idempotent — tidak double-update subscription |

---

## 8. AI Assistant

| # | Skenario | Steps | Expected |
|---|---|---|---|
| H1 | Kirim pesan ke AI | `/chat` → ketik perintah → Enter | Respon dari LLM tampil |
| H2 | Token habis (FREE plan) | Gunakan sampai limit 100 token | Error "Quota habis", saran upgrade |
| H3 | LLM provider tidak dikonfigurasi | Hapus API key → chat | Pesan error yang jelas, bukan crash |

---

## 9. Cross-Role Flow (Integrasi)

| # | Skenario | Steps | Expected |
|---|---|---|---|
| I1 | SUPER_ADMIN buat tenant → tenant bisa login | B2 → login dengan kredensial baru | Login berhasil, dashboard kosong tapi fungsional |
| I2 | SUPER_ADMIN ubah plan → sidebar tenant update | B3 → tenant refresh halaman | Sidebar badge langsung tampilkan plan baru |
| I3 | Tenant tambah router → SUPER_ADMIN lihat di monitor | C1 → login SUPER_ADMIN → cek monitoring | Router tenant terdaftar |

---

## Prioritas Eksekusi

```
BLOKIR SHIP   → A1, A2, A4, B1, B3, C1, C2, F1, F4
HIGH          → A3, A5, B2, B5, B6, D1, D3, H1, I1, I2
MEDIUM        → C3–C5, D2, D4, E1–E3, G1–G4
LOW / FUTURE  → H2, H3, I3
```

---

## Status Saat Ini

| Flow | Status |
|---|---|
| Auth (A1–A5) | ✅ Manual tested |
| SUPER_ADMIN console (B1–B8) | ✅ Manual tested |
| Router API (C1, C2) | ✅ Manual tested |
| Billing page plan (F1–F3) | ✅ Fixed & verified 2026-05-03 |
| Cross-role plan sync (F4, I2) | ✅ Fixed & verified 2026-05-03 |
| Payment Xendit (G1–G4) | ❌ Belum diimplementasi |
| AI token quota (H2) | ❌ Belum diverifikasi |
