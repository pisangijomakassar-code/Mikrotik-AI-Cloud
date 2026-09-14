# 07 — Roadmap Adopsi

Blueprint yang diterbitkan tanpa rencana adopsi akan berhenti sebagai dokumen. Bagian ini
mengatur cara KIMPS diberlakukan secara bertahap.

## 1. Tahapan

| Tahap | Durasi acuan | Sasaran | Keluaran |
|-------|--------------|---------|----------|
| **T1 — Kalibrasi** | 3–4 minggu | Mengisi seluruh penanda ⚠️ KALIBRASI | Blueprint v1.0 siap disahkan |
| **T2 — Uji coba terbatas** | 2–3 bulan | Menguji pada 2–3 proyek nyata | Catatan perbaikan, template terevisi |
| **T3 — Pengesahan** | 2 minggu | Persetujuan resmi | Blueprint v1.1 disahkan, diberlakukan |
| **T4 — Penggelaran** | 3 bulan | Seluruh proyek baru memakai KIMPS | Pelatihan selesai, dasbor berjalan |
| **T5 — Pelembagaan** | Berkelanjutan | KIMPS menjadi cara kerja normal | Tinjauan 6 bulanan |

## 2. Rincian per tahap

### T1 — Kalibrasi
Yang harus diputuskan PMD bersama pemangku kepentingan:

| Butir kalibrasi | Dokumen | Pihak yang perlu dilibatkan |
|-----------------|---------|------------------------------|
| Kepanjangan resmi akronim KIMPS | 00 | PMD |
| Ambang nilai anggaran per tier | 01 | Finance, Direksi |
| Pemetaan nama jabatan ke struktur nyata | 03 | HR, PMD |
| Batas kewenangan perubahan (DoA) | 03 | Finance, Corporate Secretary |
| Ambang eskalasi deviasi jadwal & biaya | 02, 06 | Finance, PMD |
| Besaran cadangan kontinjensi & manajemen | 05 | Finance |
| Batas waktu penyelesaian isu per prioritas | 05 | PMD |
| Target KPI portofolio | 06 | Direksi |
| Kebijakan retensi arsip | 04 | Corporate Secretary / GA |
| Jangka waktu pengukuran realisasi manfaat | 02 | Finance, Sponsor |

> Cara kerja praktis: satu lokakarya setengah hari untuk butir finansial (tier, DoA,
> cadangan), satu lokakarya untuk butir operasional (peran, eskalasi, KPI).

### T2 — Uji coba terbatas
- Pilih **tiga proyek** yang sedang berjalan atau akan dimulai: satu Tier 1, satu Tier 2,
  satu Tier 3. Proyek yang sudah lewat G2 tidak cocok dijadikan percontohan.
- Tunjuk satu Senior PM sebagai *champion* untuk masing-masing.
- PMD mendampingi penuh, mencatat setiap titik yang membingungkan atau terasa berlebihan.
- Akhir tahap: lokakarya evaluasi. Pertanyaan pokoknya — artefak mana yang **tidak** dipakai
  untuk mengambil keputusan? Itu kandidat untuk dipangkas.

### T3 — Pengesahan
- Revisi berdasarkan temuan uji coba.
- Pengesahan oleh Direksi atau forum yang berwenang.
- Terbitkan sebagai kebijakan internal dengan tanggal berlaku yang jelas.

### T4 — Penggelaran
| Kegiatan | Sasaran peserta | Durasi |
|----------|-----------------|--------|
| Pelatihan dasar KIMPS | Seluruh PM dan calon PM | 1 hari |
| Pembekalan Sponsor & PSC | Sponsor, anggota PSC | 2 jam — fokus pada peran di gate |
| Klinik template | PM | 2 jam, berkala |
| Penyiapan dasbor portofolio | PMD | — |

**Aturan transisi:** proyek yang sudah lewat Gate G2 pada tanggal berlaku **tidak** wajib
mundur ke belakang. Cukup menyesuaikan format pelaporan (dokumen 06) dan proses gate yang
tersisa.

### T5 — Pelembagaan
- Tinjauan blueprint setiap **6 bulan**.
- Setiap *lessons learned* yang berulang di tiga proyek berbeda menjadi kandidat perubahan
  blueprint.
- KPI kepatuhan gate masuk ke penilaian kinerja PMD.

## 3. Risiko adopsi

| Risiko | Dampak | Penanganan |
|--------|--------|------------|
| Dianggap birokrasi tambahan | Penolakan diam-diam; artefak diisi asal-asalan | Tunjukkan tiering; pangkas artefak yang terbukti tidak terpakai saat uji coba |
| Sponsor tidak hadir di gate | Gate menggantung, proyek tersendat | Batas waktu keputusan 10 hari kerja + eskalasi otomatis ([03 §5](./03-governance-dan-raci.md#5-prinsip-eskalasi)) |
| Gate jadi stempel formalitas | Kontrol semu; masalah lolos ke fase berikutnya | PMD berwenang menolak gate yang tidak memenuhi syarat; catat dan laporkan tingkat penghentian dini |
| PM tidak punya waktu (merangkap operasional) | Kualitas pengelolaan turun | Alokasi waktu PM disepakati tertulis di Gate G1 |
| Template tidak dipakai, tiap PM bikin sendiri | Data portofolio tidak bisa dibandingkan | Template jadi syarat kelulusan gate, bukan anjuran |
| Blueprint jadi dokumen mati | Kembali ke cara lama | Pemilik dokumen bernama + tinjauan 6 bulanan terjadwal |

---

### Kendali Dokumen

| Atribut | Nilai |
|---------|-------|
| Versi | 0.1 (draft baseline) |
| Pemilik dokumen | Head of PMD ⚠️ KALIBRASI |
| Dokumen terkait | Seluruh dokumen blueprint |
