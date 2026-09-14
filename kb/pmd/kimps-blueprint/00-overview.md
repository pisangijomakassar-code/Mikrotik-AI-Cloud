# 00 — KIMPS: Gambaran Umum Blueprint

> **Catatan kepanjangan akronim.** Nama "KIMPS" dipakai apa adanya sesuai penugasan.
> Kepanjangan resmi belum dikonfirmasi ke PMD, sehingga **sengaja tidak dicantumkan**
> di dokumen ini agar tidak terjadi salah kutip. ⚠️ KALIBRASI — mohon PMD mengisi
> kepanjangan resmi sebelum dokumen ini dipublikasikan.

## 1. Tujuan

KIMPS adalah blueprint metodologi manajemen proyek yang berlaku untuk seluruh proyek yang
dikelola atau disupervisi oleh PMD. Blueprint ini menjawab lima pertanyaan dasar:

1. **Kapan** sebuah inisiatif layak disebut proyek dan masuk ke tata kelola PMD?
2. **Siapa** yang berwenang memutuskan apa, pada titik mana?
3. **Apa** yang wajib dihasilkan di setiap fase?
4. **Bagaimana** proyek dikendalikan saat berjalan (risiko, isu, perubahan, biaya, mutu)?
5. **Dengan ukuran apa** keberhasilan dinilai?

## 2. Sasaran yang ingin dicapai

| Sasaran | Indikator keberhasilan |
|---------|------------------------|
| Keseragaman cara kerja | Seluruh proyek Tier 1 & 2 memakai artefak KIMPS yang sama |
| Keputusan lebih cepat | Tidak ada gate yang menggantung > 10 hari kerja |
| Transparansi status | Satu format laporan, satu irama pelaporan, satu dasbor |
| Pengendalian ruang lingkup | Setiap perubahan lingkup tercatat sebagai *Change Request* |
| Pembelajaran organisasi | Setiap proyek tutup dengan *lessons learned* yang terarsip |

## 3. Prinsip perancangan

1. **Proporsional, bukan seragam kaku.** Beban administrasi mengikuti bobot proyek. Proyek
   kecil tidak diperlakukan seperti proyek strategis. Lihat [01 — Klasifikasi Proyek](./01-klasifikasi-proyek.md).
2. **Gate adalah keputusan, bukan formalitas.** Setiap gate punya tiga kemungkinan hasil:
   *lanjut*, *lanjut bersyarat*, atau *hentikan*. Opsi "hentikan" harus benar-benar dipakai
   bila kriteria tidak terpenuhi.
3. **Satu artefak, satu pemilik.** Tidak ada dokumen tanpa penanggung jawab yang jelas.
4. **Metodologi-agnostik pada level eksekusi.** Fase dan gate bersifat wajib; cara tim
   bekerja di dalam fase eksekusi (waterfall, agile, atau hibrida) dipilih sesuai
   karakter proyek dan dinyatakan di *Project Charter*.
5. **Manfaat, bukan sekadar penyelesaian.** Proyek dianggap berhasil bila manfaatnya
   terealisasi, bukan hanya karena deliverable selesai.

## 4. Ruang lingkup penerapan

**Berlaku untuk:**
- Seluruh proyek investasi dan pengembangan yang dikelola PMD
- Proyek lintas departemen, apa pun nilainya
- Inisiatif dengan pendanaan proyek tersendiri

**Tidak berlaku untuk:**
- Aktivitas operasional rutin (BAU) tanpa anggaran proyek terpisah
- Pekerjaan pemeliharaan di bawah ambang Tier 3
- Kegiatan riset eksploratif sebelum melewati Gate 0

## 5. Struktur blueprint

| No | Dokumen | Isi pokok |
|----|---------|-----------|
| 00 | Gambaran Umum *(dokumen ini)* | Tujuan, prinsip, ruang lingkup |
| 01 | [Klasifikasi Proyek](./01-klasifikasi-proyek.md) | Tiering dan penyesuaian beban proses |
| 02 | [Siklus Hidup & Gate](./02-lifecycle-dan-gate.md) | Fase F0–F5 dan kriteria gate G0–G4 |
| 03 | [Tata Kelola & RACI](./03-governance-dan-raci.md) | Peran, forum, batas kewenangan |
| 04 | [Matriks Artefak](./04-matriks-artefak.md) | Dokumen wajib per fase per tier |
| 05 | [Proses Inti](./05-proses-inti.md) | Risiko, isu, perubahan, jadwal, biaya, mutu, vendor |
| 06 | [KPI & Pelaporan](./06-kpi-dan-pelaporan.md) | Metrik, irama, format laporan |
| 07 | [Roadmap Adopsi](./07-roadmap-adopsi.md) | Tahapan penerapan blueprint |
| 08 | [Glosarium](./08-glosarium.md) | Definisi istilah baku |
| — | [`templates/`](./templates/) | Delapan template kerja siap pakai |

## 6. Cara membaca blueprint ini

- **Baru pertama kali?** Baca 00 → 02 → 04. Itu sudah cukup untuk memahami alur.
- **Akan memulai proyek?** Langsung ke [TPL-01 Project Charter](./templates/TPL-01-project-charter.md).
- **Sedang menjalankan proyek?** Fokus ke 05 dan 06.
- **Anggota steering committee?** Baca 03 dan 02 bagian kriteria gate.

---

### Kendali Dokumen

| Atribut | Nilai |
|---------|-------|
| Versi | 0.1 (draft baseline) |
| Pemilik dokumen | Head of PMD ⚠️ KALIBRASI |
| Disetujui oleh | *belum disetujui* |
| Tinjauan berikutnya | 6 bulan setelah pengesahan |
