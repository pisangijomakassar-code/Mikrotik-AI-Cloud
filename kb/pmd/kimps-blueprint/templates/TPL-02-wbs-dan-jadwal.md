# TPL-02 — WBS & Jadwal Baseline

| | |
|---|---|
| **Proyek** | [nama] · [PRJ-YYYY-NNN] |
| **Versi** | [v1.0 — *baseline* disetujui di Gate G2 tanggal ___] |

---

## 1. Work Breakdown Structure

> Aturan penguraian: pecah sampai paket kerja berdurasi **≤ 2 minggu** dan punya **satu**
> penanggung jawab. Paket kerja yang lebih panjang sulit dinilai kemajuannya.
>
> Aturan 100%: penjumlahan level bawah harus mencakup seluruh lingkup level atasnya —
> tidak lebih, tidak kurang.

| Kode WBS | Nama paket kerja | Keluaran | Penanggung jawab | Estimasi (hari) |
|----------|------------------|----------|------------------|-----------------|
| 1 | [Fase / kelompok besar] | | | |
| 1.1 | [ ] | [ ] | [ ] | [ ] |
| 1.2 | [ ] | [ ] | [ ] | [ ] |
| 2 | [ ] | | | |
| 2.1 | [ ] | [ ] | [ ] | [ ] |

## 2. Milestone utama

| # | Milestone | Tanggal *baseline* | Kriteria tercapai | Gate terkait |
|---|-----------|--------------------|-------------------|--------------|
| M1 | [ ] | [ ] | [ ] | [G_] |
| M2 | [ ] | [ ] | [ ] | |

## 3. Ketergantungan antar paket kerja

| Paket kerja | Bergantung pada | Jenis | Jeda |
|-------------|-----------------|-------|------|
| [1.2] | [1.1] | Selesai–Mulai | [0 hari] |

## 4. Jalur kritis *(Tier 1 & 2 saja)*

Rangkaian paket kerja pada jalur kritis: [1.1 → 1.2 → 2.1 → ...]
Total durasi jalur kritis: [ ] hari kerja

> Perubahan durasi pada paket kerja di jalur ini langsung menggeser tanggal selesai
> proyek. Pantau lebih ketat dibanding paket kerja lain.

## 5. Cadangan waktu

| Jenis | Besaran | Pengendali |
|-------|---------|------------|
| Cadangan proyek | [ ] hari ([ ]% dari jalur kritis) | Project Manager |

> Cadangan ditempatkan di tingkat proyek, bukan disisipkan diam-diam ke setiap aktivitas.

## 6. Kebutuhan sumber daya

| Peran / sumber daya | Paket kerja terkait | Periode dibutuhkan | Status alokasi |
|---------------------|---------------------|--------------------|----------------|
| [ ] | [ ] | [ ] | [Dikonfirmasi / Menunggu] |

## 7. Persetujuan baseline

| Peran | Nama | Tanggal |
|-------|------|---------|
| Project Manager | [ ] | |
| Project Sponsor | [ ] | |

Setelah disetujui, jadwal ini menjadi *baseline* dan hanya dapat diubah melalui
[Change Request](./TPL-05-change-request.md).
