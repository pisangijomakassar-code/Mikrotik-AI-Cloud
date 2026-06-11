# Desain Laporan Keuangan — Rancangan (Design First)

> **Status:** Dokumen rancangan / mockup. Belum ada perubahan kode.
> Tujuan: menyatukan transaksi **voucher harian** dan **langganan bulanan** ke dalam laporan keuangan yang benar secara akuntansi (basis akrual, IDR).

---

## Kebijakan Akuntansi (Final / Locked)

| Channel | Pemicu Pengakuan Pendapatan | Alasan |
|---|---|---|
| **Reseller** | **Sell-in** — saat saldo reseller terpotong / voucher ditarik | Reseller bayar di muka (deposit); pendapatan lahir saat mereka menarik voucher |
| **Langsung / fisik** | **Saat aktivasi** — end user login/pakai | Generate voucher = bikin stok, bukan jualan |

- Basis: **Akrual**
- Mata uang: **IDR**
- Prinsip kunci: **"Top up itu utang, bukan untung. Untung lahir saat voucher ditarik (reseller) atau diaktifkan (langsung)."**

---

## A. Aturan Pengakuan — Dipetakan ke Data yang SUDAH ADA

Tiap peristiwa di DB dipetakan ke perlakuan akuntansinya agar mudah diimplementasi nanti.

| Record di DB | Channel | Perlakuan | Nilai | Diakui kapan |
|---|---|---|---|---|
| `SaldoTransaction.type = TOP_UP` | reseller | Liabilitas ↑ (kas masuk) | `amount` | saat top up |
| `SaldoTransaction.type = TOP_DOWN` | reseller | Liabilitas ↓ (kas keluar) | `amount` | saat refund |
| `SaldoTransaction.type = VOUCHER` | reseller | ✅ **PENDAPATAN (sell-in)** | `amount` | saat tarik voucher |
| `VoucherBatch source=dashboard, resellerId=null` | langsung | 📦 Stok (belum pendapatan) | — | — |
| `VoucherBatch source=mikhmon_import, resellerId=null` | langsung | ✅ **PENDAPATAN (aktivasi)** | `count × harga` | saat aktivasi |
| `Invoice.amount` (plan bulanan) | platform | 🔻 **BEBAN** (prorata periode) | `amount/100` | sepanjang bulan |
| `Reseller.balance` (akhir periode) | reseller | ⚖️ **Liabilitas** (utang saldo) | saldo | snapshot |

> **Sumber kebenaran pendapatan reseller = `SaldoTransaction.VOUCHER`** (gerakan ledger riil deposit→pendapatan), **bukan** `VoucherBatch.totalCost`. Ini menghindari dobel hitung.

---

## B. Mockup Laporan — dengan Contoh Angka

**Asumsi 1 periode (1 bulan):**
- Reseller A: top up Rp1.000.000, tarik voucher Rp600.000 → saldo akhir Rp400.000
- Reseller B: top up Rp500.000, tarik voucher Rp450.000 → saldo akhir Rp50.000
- Channel langsung: generate 200 voucher @Rp5.000, **120 teraktivasi**, 80 belum aktif
- Langganan platform: plan PRO Rp150.000/bulan

### 1) 📊 Laporan Laba Rugi (akrual) — *"pendapatan riil"*

| | Rp |
|---|--:|
| Pendapatan voucher — reseller *(sell-in)* | 1.050.000 |
| Pendapatan voucher — langsung *(120 aktivasi)* | 600.000 |
| **Total Pendapatan Diakui** | **1.650.000** |
| (−) Beban langganan platform | (150.000) |
| **LABA BERSIH** | **1.500.000** |

👉 Integrasi harian vs bulanan: voucher harian = baris pendapatan, langganan bulanan = baris beban. Margin voucher menutup langganan.

### 2) 💵 Laporan Arus Kas — *"uang yang benar-benar bergerak"*

| | Rp |
|---|--:|
| Kas masuk — top up reseller | 1.500.000 |
| Kas masuk — penjualan langsung | 600.000 |
| (−) Kas keluar — langganan | (150.000) |
| **Arus Kas Bersih** | **1.950.000** |

⚠️ **Laba (1.500.000) ≠ Kas (1.950.000)**. Selisih Rp450.000 itu **bukan untung** — itu deposit reseller yang belum jadi hak tenant.

### 3) ⚖️ Posisi & Liabilitas (akhir periode)

| | Rp |
|---|--:|
| **Utang Saldo Reseller** (A 400rb + B 50rb) | 450.000 |
| Voucher langsung belum aktif (80 lembar) | *potensi 400rb — bukan aset* |

> Voucher digital nyaris tanpa biaya produksi, jadi 80 lembar itu **KPI potensi pendapatan**, bukan persediaan bernilai di neraca.

### 4) 📈 KPI Operasional

- Activation rate langsung: **60%** (120/200)
- Saldo deposit mengendap: **Rp450.000** (uang nganggur di reseller)
- Pendapatan per reseller, voucher mati/expired, dll.

---

## C. Jembatan Kas ↔ Pendapatan (kunci anti-bingung)

```
Kas masuk dari reseller ........  1.500.000
(−) Diakui jadi pendapatan ..... (1.050.000)
= Kenaikan Utang Saldo Reseller ..  450.000   ✓ cocok dgn liabilitas neraca
```

Satu kalimat untuk diingat: **"Top up itu utang, bukan untung. Untung lahir saat voucher ditarik/dipakai."**

---

## D. ⚠️ Celah Data yang HARUS Dibereskan Dulu

Saat ini aktivasi (`mikhmon_import`) **tidak tahu** voucher itu berasal dari reseller atau langsung.

**Risiko:** voucher reseller yang diaktifkan bisa **terhitung 2x** — sekali di sell-in (`SaldoTransaction.VOUCHER`), sekali lagi di aktivasi (`VoucherBatch source=mikhmon_import`).

**Solusi (pilih saat implement):** tandai voucher reseller di level username/prefix, lalu **pendapatan aktivasi hanya menghitung voucher yang `resellerId`-nya kosong**. Tanpa ini, angka channel langsung bisa tercampur.

**Rekomendasi:** benahi celah D ini **sebelum / sekaligus** merombak `/reports`.

---

## E. Langkah Implementasi (urutan disarankan)

1. **Beresin tagging voucher reseller** (celah D) — wajib dulu agar angka bersih.
2. **Rombak** `dashboard/app/api/reports/route.ts` → 4 blok output (Laba Rugi · Arus Kas · Posisi · KPI).
3. **Redesign** halaman `/reports`: tab **Laba Rugi · Arus Kas · Posisi · KPI** + export CSV per tab.
