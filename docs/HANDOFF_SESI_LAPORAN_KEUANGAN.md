# Handoff Sesi — Desain Laporan Keuangan MikroTik AI Cloud

> **Tujuan file ini:** rekaman lengkap percakapan sesi sebelumnya, dipakai sebagai konteks awal saat membuka **sesi baru** (di laptop/desktop/web). Tempel ringkasan ini atau minta Claude membacanya agar langsung nyambung.
>
> - **Tanggal sesi:** 2026-06-12 s/d 2026-06-13
> - **Branch:** `claude/mikrotik-ai-project-check-xa2eza`
> - **PR terkait:** draft PR #2
> - **Dokumen hasil:** `docs/DESAIN_LAPORAN_KEUANGAN.md`

---

## TL;DR (baca ini dulu)

1. Kita **mendesain** (belum koding) sistem laporan keuangan yang menyatukan **voucher harian** + **langganan bulanan** secara akuntansi yang benar (basis akrual, IDR).
2. **Kebijakan pengakuan pendapatan sudah dikunci:**
   - **Channel reseller → Sell-in** (pendapatan diakui saat saldo reseller terpotong / voucher ditarik).
   - **Channel langsung/fisik → Saat aktivasi** (generate voucher = stok, bukan jualan).
3. Hasilnya ditulis ke `docs/DESAIN_LAPORAN_KEUANGAN.md` (sudah di-commit & push ke branch di atas, masuk draft PR #2).
4. **Belum ada kode laporan keuangan yang diubah.** Murni rancangan / design-first.
5. **Implementasi belum dikerjakan.** Urutan yang disepakati: (1) tagging voucher reseller → (2) rombak API `reports` → (3) redesign halaman `/reports`.

---

## Konteks Proyek (untuk Claude di sesi baru)

- Proyek: **MikroTik AI Agent** — SaaS, tiap user punya AI agent (Nanobot) untuk kelola router MikroTik via Telegram. Model **1 Agent = 1 User**.
- Stack: PostgreSQL 16, Next.js 16 dashboard, Nanobot AI agent + Python MCP server.
- Lihat `CLAUDE.md` untuk arsitektur lengkap.
- Tabel relevan untuk laporan keuangan: `VoucherBatch`, `SaldoTransaction`, `Reseller`, `Subscription`, `Invoice`, `TokenUsage`.

---

## Isi Percakapan (kronologis)

### 1. Permintaan awal user
User ingin laporan keuangan yang **menyatukan transaksi voucher (harian)** dengan **langganan (bulanan)**, supaya tidak bingung membedakan mana "uang masuk" vs "untung riil". Diminta pendekatan **desain dulu** (mockup), belum koding, dan **jangan push dulu**.

### 2. Keputusan kebijakan akuntansi (dikunci oleh user)
- **Reseller channel:** Sell-in — pendapatan saat voucher ditarik / saldo terpotong.
- **Direct/physical channel:** Saat aktivasi — end user login/pakai.
- **Scope:** Desain dulu (mockup laporan), tanpa perubahan kode.

### 3. Rancangan yang disepakati (ringkas)

**Aturan pengakuan — dipetakan ke data yang sudah ada:**

| Record di DB | Channel | Perlakuan | Diakui kapan |
|---|---|---|---|
| `SaldoTransaction.type = TOP_UP` | reseller | Liabilitas ↑ (kas masuk) | saat top up |
| `SaldoTransaction.type = TOP_DOWN` | reseller | Liabilitas ↓ (kas keluar) | saat refund |
| `SaldoTransaction.type = VOUCHER` | reseller | ✅ **PENDAPATAN (sell-in)** | saat tarik voucher |
| `VoucherBatch source=dashboard, resellerId=null` | langsung | 📦 Stok (belum pendapatan) | — |
| `VoucherBatch source=mikhmon_import, resellerId=null` | langsung | ✅ **PENDAPATAN (aktivasi)** | saat aktivasi |
| `Invoice.amount` | platform | 🔻 BEBAN (prorata) | sepanjang bulan |
| `Reseller.balance` (akhir periode) | reseller | ⚖️ Liabilitas (utang saldo) | snapshot |

> Sumber kebenaran pendapatan reseller = `SaldoTransaction.VOUCHER`, **bukan** `VoucherBatch.totalCost` (hindari dobel hitung).

**Empat blok laporan yang dirancang (dengan contoh angka di dokumen):**
1. 📊 Laporan Laba Rugi (akrual) — pendapatan reseller + langsung − beban langganan = laba bersih.
2. 💵 Laporan Arus Kas — kas masuk top up + jualan langsung − langganan.
3. ⚖️ Posisi & Liabilitas — Utang Saldo Reseller (= total `Reseller.balance`).
4. 📈 KPI Operasional — activation rate, saldo mengendap, dll.

**Insight kunci:** "Top up itu utang, bukan untung. Untung lahir saat voucher ditarik (reseller) atau diaktifkan (langsung)." Laba ≠ Kas — selisihnya = kenaikan utang saldo reseller (jembatan rekonsiliasi).

### 4. ⚠️ Celah data yang HARUS dibereskan sebelum implementasi
Aktivasi (`mikhmon_import`) tidak tahu voucher itu dari reseller atau langsung → **risiko dobel hitung** (sell-in + aktivasi). Solusi: tandai voucher reseller (username/prefix), lalu pendapatan aktivasi hanya hitung voucher yang `resellerId`-nya kosong. **Benahi ini dulu.**

### 5. Diskusi meta: di mana memori sesi tersimpan
- **Transkrip chat** tersimpan di akun Claude (server Anthropic) — bisa dibuka dari perangkat mana pun via `claude.ai/code` / `code.claude.com`, Claude desktop app, atau ekstensi VS Code (login akun sama: `budirman.basri@kalla.co.id`).
- **Container cloud bersifat sementara** — hanya file yang **di-commit + push** yang selamat.
- Karena itu dokumen desain disimpan ke file & di-push.

### 6. Eksekusi yang sudah dilakukan
- Dibuat & di-commit: `docs/DESAIN_LAPORAN_KEUANGAN.md` (commit `c203a66`).
- Di-push ke branch `claude/mikrotik-ai-project-check-xa2eza`.
- Branch ini juga berisi 2 commit lama dari sesi "cek proyek" (tidak terkait laporan keuangan):
  - `dashboard/hooks/use-routers.ts` — tambah field `wanInterface`.
  - `dashboard/next.config.ts` — hapus config eslint mati (Next.js 16).
- Semua masuk **draft PR #2**, **belum di-merge ke `main`** → produksi belum terpengaruh.

---

## Status & Langkah Berikutnya (TODO untuk sesi baru)

- [ ] **(Wajib duluan)** Beresin tagging voucher reseller untuk hindari dobel-hitung aktivasi.
- [ ] Rombak `dashboard/app/api/reports/route.ts` → 4 blok output (Laba Rugi · Arus Kas · Posisi · KPI).
- [ ] Redesign halaman `/reports`: tab Laba Rugi · Arus Kas · Posisi · KPI + export CSV per tab.
- [ ] (Opsional) Pertimbangkan pisahkan dokumen desain ke PR sendiri agar terpisah dari fix tipe.

---

## Cara pakai file ini di sesi baru
1. Buka sesi baru Claude Code (web/desktop/VS Code) di repo ini.
2. Minta: *"Baca `docs/HANDOFF_SESI_LAPORAN_KEUANGAN.md` dan `docs/DESAIN_LAPORAN_KEUANGAN.md`, lalu lanjut dari TODO."*
3. Pastikan tetap di branch `claude/mikrotik-ai-project-check-xa2eza` (atau buat branch baru sesuai arahan).
