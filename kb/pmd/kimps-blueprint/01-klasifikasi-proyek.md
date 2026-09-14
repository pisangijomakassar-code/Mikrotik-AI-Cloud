# 01 — Klasifikasi Proyek (Tiering)

Tiering menentukan seberapa berat tata kelola yang dikenakan pada sebuah proyek. Tujuannya
agar proyek kecil tidak tenggelam oleh administrasi, dan proyek besar tidak lolos dari
pengawasan.

## 1. Kriteria penentuan tier

Penilaian memakai lima dimensi. **Tier ditentukan oleh dimensi tertinggi yang terpenuhi**
(bukan rata-rata) — satu dimensi Tier 1 sudah cukup menjadikan proyek Tier 1.

| Dimensi | Tier 3 — Ringan | Tier 2 — Menengah | Tier 1 — Strategis |
|---------|-----------------|-------------------|--------------------|
| Nilai anggaran ⚠️ KALIBRASI | < Rp 250 juta | Rp 250 juta – 2,5 miliar | > Rp 2,5 miliar |
| Durasi rencana | ≤ 3 bulan | 3 – 12 bulan | > 12 bulan |
| Keterlibatan unit | 1 departemen | 2 – 3 departemen | > 3 departemen / lintas entitas |
| Profil risiko | Rendah; dampak terbatas pada satu unit | Sedang; dampak operasional lintas unit | Tinggi; dampak finansial, reputasi, atau regulasi |
| Kaitan strategis | Perbaikan operasional | Mendukung sasaran tahunan | Tercantum dalam rencana strategis korporat |

> **Hak veto PMD.** Head of PMD berwenang menaikkan tier sebuah proyek tanpa memenuhi
> kriteria di atas, bila menilai ada risiko tersembunyi. Penurunan tier hanya boleh atas
> persetujuan Project Sponsor **dan** Head of PMD.

## 2. Konsekuensi tiering

| Aspek | Tier 3 | Tier 2 | Tier 1 |
|-------|--------|--------|--------|
| Gate wajib | G2, G4 | G1, G2, G3, G4 | G0, G1, G2, G3, G4 |
| Forum pengambil keputusan | Head of Department | Project Steering Committee | Project Steering Committee + Direksi |
| Frekuensi laporan status | Bulanan | Dwi-mingguan | Mingguan |
| Project Charter | Versi ringkas (1 halaman) | Lengkap | Lengkap + analisis kelayakan |
| Risk register | Opsional, minimal 5 risiko teratas | Wajib | Wajib + tinjauan bulanan formal |
| Peran PM | PM paruh waktu / merangkap | PM tersertifikasi | PM tersertifikasi, penugasan penuh |
| Post-Implementation Review | Tidak wajib | Wajib | Wajib + pengukuran realisasi manfaat |

## 3. Prosedur penetapan

1. Pengusul mengisi formulir intake (lihat [02 — Fase F0](./02-lifecycle-dan-gate.md#f0--intake--penyaringan)).
2. PMD melakukan skoring tier dalam **3 hari kerja**.
3. Hasil tier dicantumkan di *Project Charter* dan tidak boleh diubah sepihak oleh tim proyek.
4. Bila selama proyek berjalan terjadi perubahan material (anggaran naik melewati ambang,
   lingkup meluas lintas departemen), PM **wajib** mengajukan peninjauan ulang tier melalui
   *Change Request*.

## 4. Contoh penerapan

| Kasus | Dimensi pemicu | Tier |
|-------|----------------|------|
| Penggantian perangkat jaringan satu cabang, Rp 120 juta, 6 minggu, 1 unit | Semua di Tier 3 | **Tier 3** |
| Implementasi sistem HRIS, Rp 1,8 miliar, 9 bulan, 4 departemen | Keterlibatan unit > 3 → Tier 1 | **Tier 1** |
| Digitalisasi arsip, Rp 300 juta, 5 bulan, 2 departemen, risiko rendah | Anggaran & durasi Tier 2 | **Tier 2** |
| Pilot proyek Rp 80 juta tapi menyangkut kepatuhan regulasi | Profil risiko Tier 1 | **Tier 1** |

---

### Kendali Dokumen

| Atribut | Nilai |
|---------|-------|
| Versi | 0.1 (draft baseline) |
| Pemilik dokumen | Head of PMD ⚠️ KALIBRASI |
| Ketergantungan | Ambang nilai wajib selaras dengan kebijakan *Delegation of Authority* korporat |
