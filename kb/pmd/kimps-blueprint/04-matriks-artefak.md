# 04 — Matriks Artefak

Daftar dokumen yang wajib dihasilkan per fase, dibedakan menurut tier.

**W** = Wajib · **R** = Wajib dalam bentuk ringkas · **O** = Opsional · **–** = Tidak berlaku

## 1. Matriks utama

| Fase | Artefak | Template | Pemilik | T1 | T2 | T3 |
|------|---------|----------|---------|:--:|:--:|:--:|
| F0 | Formulir Intake | — | Pengusul | W | W | W |
| F0 | Skoring Tier | — | PMD | W | W | W |
| F1 | Project Charter | [TPL-01](./templates/TPL-01-project-charter.md) | PM | W | W | R |
| F1 | Analisis Kelayakan / Business Case | — | Sponsor | W | O | – |
| F1 | Peta Pemangku Kepentingan | — | PM | W | W | O |
| F1 | Risiko Tingkat Tinggi (awal) | [TPL-03](./templates/TPL-03-risk-register.md) | PM | W | W | O |
| F2 | WBS & Jadwal *Baseline* | [TPL-02](./templates/TPL-02-wbs-dan-jadwal.md) | PM | W | W | R |
| F2 | Anggaran *Baseline* | — | PM | W | W | R |
| F2 | Risk Register lengkap | [TPL-03](./templates/TPL-03-risk-register.md) | PM | W | W | R |
| F2 | Rencana Komunikasi | — | PM | W | O | – |
| F2 | Rencana Mutu & Kriteria Penerimaan | — | PM + Business Owner | W | W | R |
| F2 | Rencana Pengadaan | — | PM + Procurement | W¹ | W¹ | O¹ |
| F2 | Struktur Tim & RACI | — | PM | W | W | O |
| F3 | Laporan Status Berkala | [TPL-06](./templates/TPL-06-status-report.md) | PM | W | W | W |
| F3 | Issue Log | [TPL-04](./templates/TPL-04-issue-log.md) | PM | W | W | R |
| F3 | Change Request | [TPL-05](./templates/TPL-05-change-request.md) | PM | W² | W² | W² |
| F3 | Hasil UAT | — | Business Owner | W | W | O |
| F3 | Dokumentasi Serah Terima Operasional | — | PM + Tech Lead | W | W | R |
| G0–G4 | Berita Acara Gate Review | [TPL-07](./templates/TPL-07-gate-review-checklist.md) | PMD | W | W | R |
| F4 | Laporan Penutupan Proyek | [TPL-08](./templates/TPL-08-project-closure.md) | PM | W | W | R |
| F4 | Lessons Learned | [TPL-08 §6](./templates/TPL-08-project-closure.md) | PM + PMD | W | W | R |
| F4 | Berita Acara Penutupan Kontrak | — | Procurement | W¹ | W¹ | W¹ |
| F5 | Post-Implementation Review | — | PMD | W | W | O |
| F5 | Laporan Realisasi Manfaat | — | Sponsor | W | O | – |

¹ Hanya bila proyek melibatkan vendor atau pengadaan eksternal.
² Hanya bila terjadi perubahan terhadap *baseline* yang sudah ditetapkan.

## 2. Aturan pengarsipan

1. **Lokasi tunggal.** Seluruh artefak final diarsipkan di KB PMD. Salinan di drive
   pribadi atau surel tidak diakui sebagai arsip resmi.
2. **Penamaan berkas:**
   `[KodeProyek]_[KodeArtefak]_[vN.N]_[YYYYMMDD]`
   Contoh: `PRJ-2026-014_CHARTER_v1.2_20260315`
3. **Versi.** Naikkan digit kedua untuk revisi minor, digit pertama untuk revisi yang
   memerlukan persetujuan ulang. Versi yang disetujui di gate dikunci dan tidak boleh
   ditimpa — buat versi baru.
4. **Retensi.** ⚠️ KALIBRASI — usulan: 5 tahun setelah penutupan untuk seluruh artefak,
   mengikuti kebijakan retensi dokumen korporat.
5. **Kode proyek** diterbitkan oleh PMD saat lulus Gate G0 (Tier 1) atau saat *Project
   Charter* disetujui (Tier 2 & 3), dengan format `PRJ-[tahun]-[nomor urut 3 digit]`.

## 3. Prinsip "cukup, tidak berlebih"

Artefak yang tidak dibaca siapa pun adalah pemborosan. Bila sebuah artefak wajib ternyata
tidak pernah dipakai dalam pengambilan keputusan selama tiga proyek berturut-turut, PMD
wajib meninjau ulang kewajibannya pada siklus tinjauan berikutnya.

---

### Kendali Dokumen

| Atribut | Nilai |
|---------|-------|
| Versi | 0.1 (draft baseline) |
| Pemilik dokumen | Head of PMD ⚠️ KALIBRASI |
| Dokumen terkait | 01, 02, seluruh template |
