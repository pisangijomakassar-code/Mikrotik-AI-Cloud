# E2E Test Plan — MikroTik AI Cloud

> Level: High-Level (happy path + critical edge cases)  
> Tools target: Playwright + manual via browser  
> Status legend: ✅ Verified · ❌ Belum diimplementasi · 🔲 Belum ditest

---

## 1. Authentication

| # | Skenario | Steps | Expected | Status |
|---|---|---|---|---|
| A1 | Login SUPER_ADMIN | Buka `/login`, isi `superadmin@bukakanet.id` + password | Redirect ke `/platform` | ✅ |
| A2 | Login Tenant ADMIN | Isi `admin@mikrotik.local` + password | Redirect ke `/dashboard` | ✅ |
| A3 | Login gagal — password salah | Email valid + password salah | Pesan error, tetap di `/login` | ✅ |
| A4 | Akses halaman protected tanpa login | Buka `/dashboard` langsung | Redirect ke `/login` | ✅ |
| A5 | Logout | Avatar → Logout | Session hapus, redirect `/login` | ✅ |

---

## 2. SUPER_ADMIN — Platform Console

| # | Skenario | Steps | Expected | Status |
|---|---|---|---|---|
| B1 | Lihat daftar tenant | Login SUPER_ADMIN → `/platform/tenants` | List tenant tampil, ada kolom plan & status | ✅ |
| B2 | Buat tenant baru | Klik "Tambah Tenant" → isi form → Submit | Tenant muncul di list, bisa login | 🔲 |
| B3 | Ubah plan tenant FREE → PRO | Pilih tenant → ubah plan → Save | Sidebar & billing tenant tampilkan PRO | ✅ |
| B4 | Ubah plan tenant PRO → PREMIUM | Sama seperti B3 | Billing page tampilkan PREMIUM, limit = ∞ | ✅ |
| B5 | Toggle feature flag tenant | Detail tenant → toggle ON/OFF | Fitur muncul/hilang di sidebar tenant | 🔲 |
| B6 | Buat announcement | `/platform/announcements` → isi → Publish | Tampil di dashboard tenant | 🔲 |
| B7 | Hapus announcement | Klik hapus | Hilang dari list & dashboard tenant | 🔲 |
| B8 | SUPER_ADMIN tidak error di router API | Navigasi semua halaman platform | Tidak ada error 500 di console | ✅ |

---

## 3. Router & Network

| # | Skenario | Steps | Expected | Status |
|---|---|---|---|---|
| C1 | Tambah router (slot kosong) | `/routers` → Tambah Router → isi form | Router tersimpan, muncul di list | ✅ |
| C2 | Tolak tambah router jika limit plan | Plan FREE (max 1) → coba tambah ke-2 | Error "Slot penuh", tombol disabled | ✅ |
| C3 | Lihat health status router | `/routers` | Pill online/offline + CPU/RAM/Uptime tampil | 🔲 |
| C4 | Hapus router | Klik hapus → konfirmasi | Router hilang dari list | 🔲 |
| C5 | Netwatch topology — lihat node | `/netwatch` | Node AP tampil, ada status UP/DOWN | 🔲 |
| C6 | Netwatch — drag node + Save Layout | Drag node ke posisi baru → Save Layout | Layout tersimpan, tidak reset setelah refresh | 🔲 |
| C7 | Netwatch — tambah edge parent-child | Mode "Tambah Edge" → klik source → klik target | Garis edge tampil antara dua node | 🔲 |
| C8 | Netwatch — node DOWN terdeteksi | Ada AP yang down | Kartu alert merah muncul + node warna berbeda | 🔲 |

---

## 4. Hotspot — Users

| # | Skenario | Steps | Expected | Status |
|---|---|---|---|---|
| D1 | Lihat daftar hotspot users | `/hotspot/users` | List user dari RouterOS tampil | 🔲 |
| D2 | Tambah hotspot user | Klik Add User → isi username/password/profile → Submit | User muncul di list | 🔲 |
| D3 | Cari user by username | Isi kolom search | List terfilter sesuai keyword | 🔲 |
| D4 | Filter user by profile | Pilih profile di dropdown | Hanya user profile tersebut tampil | 🔲 |
| D5 | Disable user | Klik toggle status → konfirmasi | Badge status berubah disabled | 🔲 |
| D6 | Enable user kembali | Klik toggle disabled user | Status kembali aktif | 🔲 |
| D7 | Hapus satu user | Ikon trash → konfirmasi | User hilang dari list | 🔲 |
| D8 | Hapus semua user disabled | Klik "Hapus Disabled" → konfirmasi | Semua user disabled terhapus | 🔲 |
| D9 | Hapus semua user expired | Klik "Hapus Expired" → konfirmasi | Semua user expired terhapus | 🔲 |
| D10 | Export CSV hotspot users | Klik Export CSV | File .csv terdownload dengan data user | 🔲 |
| D11 | Print voucher per user | Ikon print pada row | Preview cetak voucher user tersebut | 🔲 |
| D12 | Lihat active sessions | `/hotspot/active` | Session real-time tampil (refresh 30s) | 🔲 |

---

## 5. Hotspot — Profiles

| # | Skenario | Steps | Expected | Status |
|---|---|---|---|---|
| E1 | Lihat daftar profiles | `/hotspot/profiles` | List profile dengan rate limit tampil | 🔲 |
| E2 | Tambah profile baru | Add Profile → isi nama/rate limit/validity → Simpan | Profile muncul di list | 🔲 |
| E3 | Edit profile (rate limit) | Edit → ubah rate limit → Simpan | Perubahan tersimpan dan tampil | 🔲 |
| E4 | Set On Login Script | Ikon script → isi script → Simpan | Script tersimpan | 🔲 |
| E5 | Kosongkan On Login Script | Buka script dialog → Kosongkan Script | Script terhapus | 🔲 |
| E6 | Hapus profile | Ikon trash → konfirmasi | Profile hilang dari list | 🔲 |
| E7 | Tambah profile dengan Lock User ON | Centang Lock User saat tambah | Profile tersimpan dengan lock user enabled | 🔲 |

---

## 6. Voucher — Generate

| # | Skenario | Steps | Expected | Status |
|---|---|---|---|---|
| F1 | Generate voucher — basic | `/vouchers/generate` → pilih profil → jumlah 5 → Generate | 5 voucher username/password tampil | 🔲 |
| F2 | Generate dengan Jenis Voucher | Pilih Jenis Voucher → profil & harga terisi otomatis | Field auto-fill dari jenis voucher | 🔲 |
| F3 | Generate dengan prefix custom | Isi prefix "TEST" → Generate | Username diawali "TEST" | 🔲 |
| F4 | Generate dengan tipe karakter ABCD2345 | Pilih tipe ABCD2345 → Generate | Username/password hanya huruf kapital + angka | 🔲 |
| F5 | Generate dengan tipe login User=Pass | Pilih "Username = Password" → Generate | Username sama dengan password di setiap voucher | 🔲 |
| F6 | Generate dengan limit uptime | Isi Limit Uptime "1d" → Generate | Voucher memiliki batas uptime 1 hari | 🔲 |
| F7 | Generate dengan limit quota | Isi Limit Quota 1000 MB → Generate | Quota tercatat di voucher | 🔲 |
| F8 | Generate untuk reseller tertentu | Pilih reseller di dropdown → Generate | Batch tercatat atas nama reseller tersebut | 🔲 |
| F9 | Generate dengan diskon reseller | Isi Diskon 10% → Mark Up disable otomatis | Field Mark Up ter-disable, harga reseller turun 10% | 🔲 |
| F10 | Generate dengan mark up | Isi Mark Up 2000 → Generate | Diskon disable, harga total = harga + markup | 🔲 |
| F11 | Copy semua voucher | Klik "Copy Semua" | Semua username/password ter-copy ke clipboard | 🔲 |
| F12 | Copy satu voucher | Klik copy pada satu baris | Voucher tersebut ter-copy, ikon berubah centang | 🔲 |
| F13 | Batas maksimum 200 voucher | Isi jumlah 201 → Generate | Validasi error atau dibatasi ke 200 | 🔲 |
| F14 | Generate tanpa pilih profil | Klik Generate tanpa profil | Validasi error "profil wajib diisi" | 🔲 |

---

## 7. Voucher — Histori & Cetak

| # | Skenario | Steps | Expected | Status |
|---|---|---|---|---|
| G1 | Lihat histori batch voucher | `/vouchers` | Tabel batch tampil: tanggal, profil, jumlah, total | 🔲 |
| G2 | Filter histori by source | Dropdown Source → pilih "Reseller Bot" | Hanya batch dari reseller bot tampil | 🔲 |
| G3 | Filter histori by reseller | Dropdown Reseller → pilih reseller | Hanya batch reseller itu tampil | 🔲 |
| G4 | Reset filter | Klik Reset | Semua batch tampil kembali | 🔲 |
| G5 | Pagination histori | Klik Next page | Halaman berikutnya tampil | 🔲 |
| G6 | Generate via modal di histori | Klik "Generate Voucher" → isi form → Generate | Batch baru muncul di atas histori | 🔲 |
| G7 | Cetak voucher — preview A4 | `/vouchers/print` → pilih Tipe A4 → Tampilkan Preview | Preview grid voucher A4 tampil | 🔲 |
| G8 | Cetak voucher — preview thermal | Pilih Tipe Thermal → Tampilkan Preview | Layout thermal tampil | 🔲 |
| G9 | Cetak voucher — filter tanggal custom | Toggle "Custom" → isi dari/sampai → Tampilkan | Hanya voucher dalam rentang tanggal tampil | 🔲 |
| G10 | Cetak voucher — filter by reseller | Pilih reseller → Tampilkan | Hanya voucher reseller itu tampil | 🔲 |
| G11 | Cetak voucher — tampilkan harga | Centang "Tampilkan Harga" → Preview | Harga tampil di kartu voucher | 🔲 |
| G12 | Cetak voucher — voucher per halaman | Ubah ke 40 → Preview | Layout menyesuaikan 40 voucher per halaman | 🔲 |

---

## 8. Jenis Voucher (Voucher Settings)

| # | Skenario | Steps | Expected | Status |
|---|---|---|---|---|
| H1 | Lihat daftar jenis voucher | `/vouchers/settings` | Tabel jenis voucher tampil | 🔲 |
| H2 | Tambah jenis voucher baru | Add Voucher → isi nama/harga/profil → Simpan | Jenis voucher muncul di list dan dropdown generate | 🔲 |
| H3 | Edit jenis voucher (harga) | Edit → ubah harga → Simpan | Harga baru tersimpan | 🔲 |
| H4 | Set group voucher (1-9) | Edit → toggle group 3 → Simpan | Group tersimpan, tampil di kolom Group VCR | 🔲 |
| H5 | Set warna voucher | Edit → pilih warna → Simpan | Warna tersimpan di kolom VCR CLR | 🔲 |
| H6 | Hapus jenis voucher | Trash → konfirmasi | Jenis voucher hilang dari list | 🔲 |
| H7 | Jenis voucher muncul di dropdown generate | Buka `/vouchers/generate` setelah tambah | Jenis voucher tersedia di dropdown | 🔲 |

---

## 9. Reseller

| # | Skenario | Steps | Expected | Status |
|---|---|---|---|---|
| I1 | Lihat daftar reseller | `/resellers` | List reseller dengan saldo tampil | 🔲 |
| I2 | Tambah reseller baru | Add Reseller → isi nama/Telegram ID/HP → Simpan | Reseller muncul di list | 🔲 |
| I3 | Edit reseller (diskon %) | Edit → ubah diskon → Simpan | Diskon baru tersimpan | 🔲 |
| I4 | Top Up saldo reseller | Klik Top Up → isi nominal → Simpan | Saldo bertambah, transaksi tercatat | 🔲 |
| I5 | Top Up dengan bukti transfer | Top Up → upload foto → Simpan | Foto tersimpan, tampil di histori transaksi | 🔲 |
| I6 | Top Down saldo reseller | Klik Top Down → isi nominal → Simpan | Saldo berkurang, transaksi tercatat | 🔲 |
| I7 | Cari reseller | Isi kolom search nama/Telegram ID | List terfilter | 🔲 |
| I8 | Hapus reseller | Trash → konfirmasi | Reseller hilang dari list | 🔲 |
| I9 | Lihat detail reseller | Klik nama reseller | Halaman detail tampil: saldo, info, histori | 🔲 |
| I10 | Histori voucher reseller | Detail → tab Voucher History | Semua batch voucher reseller tampil | 🔲 |
| I11 | Download PDF batch voucher | Tab Voucher History → Download PDF | File PDF batch terdownload | 🔲 |
| I12 | Histori transaksi saldo reseller | Detail → tab Transaction History | Semua top up/down/pembelian tercatat | 🔲 |
| I13 | Generate voucher dari detail reseller | Detail → Generate Voucher → Generate | Batch terbuat atas nama reseller tersebut | 🔲 |
| I14 | Saldo terpotong saat reseller beli voucher | Generate dengan reseller + harga → cek saldo | Saldo berkurang sesuai harga × jumlah - diskon | 🔲 |

---

## 10. Reseller — Histori Transaksi Global

| # | Skenario | Steps | Expected | Status |
|---|---|---|---|---|
| J1 | Lihat semua transaksi | `/resellers/transactions` | Semua transaksi semua reseller tampil | 🔲 |
| J2 | Cari transaksi | Isi search nama/voucher/keterangan | List terfilter | 🔲 |
| J3 | Lihat bukti transfer | Klik thumbnail bukti | Full-screen image viewer terbuka | 🔲 |
| J4 | Pagination | Klik Next | Halaman berikutnya tampil | 🔲 |

---

## 11. Laporan (Reports)

| # | Skenario | Steps | Expected | Status |
|---|---|---|---|---|
| K1 | Lihat laporan bulan ini | `/reports` → pilih bulan sekarang → Tampilkan | Summary cards tampil: voucher terjual, pendapatan | 🔲 |
| K2 | Filter laporan by bulan lalu | Ganti bulan ke bulan lalu | Data bulan lalu tampil | 🔲 |
| K3 | Filter laporan by range tanggal | Toggle custom range → isi dari/sampai | Data sesuai rentang tampil | 🔲 |
| K4 | Filter laporan by reseller | Pilih reseller tertentu | Hanya data reseller tersebut | 🔲 |
| K5 | Tab Voucher Terjual | Klik tab "Voucher Terjual" | Tabel batch: tanggal, router, profil, jumlah, total | 🔲 |
| K6 | Tab Transaksi Saldo | Klik tab "Transaksi Saldo" | Tabel transaksi top up/down/pembelian | 🔲 |
| K7 | Export CSV voucher | Tab Voucher → Export CSV | File CSV terdownload | 🔲 |
| K8 | Export CSV transaksi | Tab Transaksi → Export CSV | File CSV terdownload | 🔲 |
| K9 | Buka detail batch dari laporan | Klik baris batch di tabel | Drawer detail terbuka: voucher list + status | 🔲 |
| K10 | Status voucher di detail batch | Drawer terbuka | Voucher terbagi: Belum aktif / Aktif / Hilang / Tidak diketahui | 🔲 |
| K11 | Summary Voucher Lifecycle | Cek kartu summary | Generated vs Activated vs Stok tampil dengan angka | 🔲 |
| K12 | Import data penjualan | Klik "Import Data" → pilih bulan → Import Saja | Data diimport, laporan bulan tersebut muncul | 🔲 |
| K13 | Import + hapus dari router | Import → Import & Hapus dari Router | Data diimport, log di router terhapus | 🔲 |
| K14 | Sinkron data sekarang | Klik "Sinkron Sekarang" | Status last sync per router update | 🔲 |
| K15 | Cleanup log lama — dry run | Klik "Bersihkan" → isi bulan → Preview Dulu | Tampil: akan hapus X, simpan Y | 🔲 |
| K16 | Cleanup log lama — eksekusi | Setelah dry run → Sinkron + Hapus | Log lama terhapus, konfirmasi tampil | 🔲 |

---

## 12. PPP

| # | Skenario | Steps | Expected | Status |
|---|---|---|---|---|
| L1 | Lihat active PPP sessions | `/ppp/active` | List sesi PPP aktif tampil (refresh 30s) | 🔲 |
| L2 | Kick PPP session | Klik Kick → konfirmasi | Session hilang dari list | 🔲 |
| L3 | Lihat PPP profiles | `/ppp/profiles` | List profil PPP tampil (read-only) | 🔲 |
| L4 | Lihat PPP secrets | `/ppp/secrets` | List secrets tampil | 🔲 |
| L5 | Tambah PPP secret | Add Secret → isi nama/password/service/profile → Simpan | Secret muncul di list | 🔲 |
| L6 | Cari PPP secret | Isi search | List terfilter | 🔲 |
| L7 | Hapus PPP secret | Trash → konfirmasi | Secret hilang | 🔲 |

---

## 13. Communication (Telegram)

| # | Skenario | Steps | Expected | Status |
|---|---|---|---|---|
| M1 | Akses Communication — plan PREMIUM | Login dengan tenant PREMIUM → `/communication` | Halaman terbuka normal | 🔲 |
| M2 | Akses Communication — plan FREE/PRO | Login dengan tenant FREE → `/communication` | Pesan upgrade plan tampil, kirim disabled | 🔲 |
| M3 | Kirim pesan ke satu reseller | Mode Single → pilih reseller → ketik pesan → Kirim | Pesan terkirim ke Telegram reseller | 🔲 |
| M4 | Kirim pesan ke custom Chat ID | Mode Single → Custom Chat ID → isi ID → Kirim | Pesan terkirim ke chat ID tersebut | 🔲 |
| M5 | Broadcast ke semua reseller | Mode Broadcast → Select All → ketik pesan → Kirim | Pesan terkirim ke semua reseller | 🔲 |
| M6 | Broadcast ke reseller terpilih | Mode Broadcast → pilih beberapa → Kirim | Pesan terkirim ke reseller terpilih saja | 🔲 |
| M7 | Kirim dengan foto | Upload foto → ketik pesan → Kirim | Foto + teks terkirim ke Telegram | 🔲 |
| M8 | Gunakan quick template | Klik template di sidebar | Pesan terisi otomatis dengan template | 🔲 |
| M9 | Karakter counter | Ketik pesan panjang | Counter bertambah, warning di 90% (3686 karakter) | 🔲 |
| M10 | Tombol kirim disabled jika kosong | Kosongkan pesan + tidak ada penerima | Tombol Kirim disabled | 🔲 |

---

## 14. Billing & Payment

| # | Skenario | Steps | Expected | Status |
|---|---|---|---|---|
| N1 | Billing page tampil plan aktif | `/settings/billing` | Plan sesuai DB (bukan selalu FREE) | ✅ |
| N2 | Token usage tampil | Sama | Angka token hari ini ter-update | 🔲 |
| N3 | Daftar invoice tampil | Sama | Invoice list atau "No invoices yet" | 🔲 |
| N4 | Klik Upgrade — Snap popup muncul | Klik "Pilih Pro" | Popup Midtrans QRIS muncul | ❌ (dummy key) |
| N5 | Pembayaran sukses → plan naik | Simulasi webhook `settlement` | Invoice PAID, subscription naik ke PRO | ❌ (belum ada real key) |
| N6 | Pembayaran expire → invoice CANCELED | Simulasi webhook `expire` | Invoice status CANCELED | ❌ |
| N7 | Duplikasi webhook diabaikan | Kirim webhook sama 2x | Subscription tidak double-update | ❌ |
| N8 | SUPER_ADMIN ubah plan → tenant refresh | SUPER_ADMIN ganti plan → tenant buka billing | Plan langsung berubah tanpa logout | ✅ |

---

## 15. AI Assistant

| # | Skenario | Steps | Expected | Status |
|---|---|---|---|---|
| O1 | Kirim perintah ke AI | `/chat` → ketik perintah → Enter | Respons LLM tampil | 🔲 |
| O2 | LLM provider belum dikonfigurasi | Hapus API key → chat | Pesan error jelas, bukan crash | 🔲 |
| O3 | Token habis (FREE plan) | Gunakan sampai limit 100 token | Error "Quota habis", saran upgrade | 🔲 |

---

## 16. Cross-Role Flow (Integrasi)

| # | Skenario | Steps | Expected | Status |
|---|---|---|---|---|
| P1 | SUPER_ADMIN buat tenant → tenant login | B2 → login dengan kredensial baru | Login berhasil, dashboard bersih tapi fungsional | 🔲 |
| P2 | SUPER_ADMIN ubah plan → sidebar tenant update | B3 → tenant refresh halaman | Sidebar badge langsung tampilkan plan baru | ✅ |
| P3 | Voucher dibeli reseller → laporan terbaca | F8 → K1 filter reseller yang sama | Batch voucher muncul di laporan | 🔲 |
| P4 | Top up saldo → tercatat di histori transaksi | I4 → J1 cari nama reseller | Transaksi top up tercatat | 🔲 |
| P5 | Generate voucher reseller → saldo terpotong | I13 → cek saldo di `/resellers` | Saldo berkurang sesuai harga batch | 🔲 |
| P6 | Hapus reseller → histori tetap ada | I8 → K1 filter | Laporan tetap menampilkan histori reseller terhapus | 🔲 |

---

## Prioritas Eksekusi

```
BLOKIR SHIP    → A1–A5, B1, B3, C1, C2, F1, F14, G1, I1, I4, K1, K5, N1, N8
HIGH           → F2–F8, G2–G6, I2–I6, I9–I14, K2–K11, P3–P5
MEDIUM         → D1–D12, E1–E7, G7–G12, H1–H7, I10–I13, J1–J4, K12–K16, L1–L7
LOW / FUTURE   → M1–M10, N4–N7, O1–O3, P6
```

---

## Ringkasan Status

| Area | Total | ✅ Verified | 🔲 Belum ditest | ❌ Belum impl |
|---|---|---|---|---|
| Auth | 5 | 5 | 0 | 0 |
| SUPER_ADMIN | 8 | 3 | 5 | 0 |
| Router & Netwatch | 8 | 2 | 6 | 0 |
| Hotspot Users | 12 | 0 | 12 | 0 |
| Hotspot Profiles | 7 | 0 | 7 | 0 |
| Voucher Generate | 14 | 0 | 14 | 0 |
| Voucher Histori & Cetak | 12 | 0 | 12 | 0 |
| Jenis Voucher | 7 | 0 | 7 | 0 |
| Reseller | 14 | 0 | 14 | 0 |
| Reseller Transaksi Global | 4 | 0 | 4 | 0 |
| Laporan | 16 | 0 | 16 | 0 |
| PPP | 7 | 0 | 7 | 0 |
| Communication | 10 | 0 | 10 | 0 |
| Billing & Payment | 8 | 3 | 1 | 4 |
| AI Assistant | 3 | 0 | 3 | 0 |
| Cross-Role | 6 | 2 | 4 | 0 |
| **TOTAL** | **141** | **15** | **122** | **4** |
