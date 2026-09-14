# 06 — KPI & Pelaporan

## 1. KPI tingkat proyek

Dilaporkan oleh PM pada setiap laporan status.

| KPI | Rumus | Ambang sehat ⚠️ KALIBRASI |
|-----|-------|---------------------------|
| Deviasi jadwal | (Tanggal proyeksi − Tanggal *baseline*) ÷ durasi *baseline* | ≤ 10% |
| Deviasi biaya | (Proyeksi biaya akhir − Anggaran *baseline*) ÷ anggaran *baseline* | ≤ 5% |
| Schedule Performance Index (SPI) | Nilai pekerjaan selesai ÷ nilai pekerjaan terjadwal | ≥ 0,90 |
| Cost Performance Index (CPI) | Nilai pekerjaan selesai ÷ biaya aktual | ≥ 0,95 |
| Ketercapaian *milestone* | *Milestone* selesai tepat waktu ÷ total *milestone* jatuh tempo | ≥ 85% |
| Risiko terbuka kategori tinggi | Jumlah absolut | ≤ 3 |
| Isu terbuka melewati batas waktu | Jumlah absolut | 0 |
| Perubahan lingkup kumulatif | Σ dampak CR disetujui ÷ nilai *baseline* | ≤ 15% |

### Status warna proyek

| Warna | Kriteria | Konsekuensi |
|:-----:|----------|-------------|
| 🟢 **Hijau** | Seluruh KPI dalam ambang sehat | Lanjut normal |
| 🟡 **Kuning** | Satu atau lebih KPI di luar ambang, ada rencana pemulihan yang kredibel | Dibahas di rapat Sponsor; rencana pemulihan dilampirkan |
| 🔴 **Merah** | KPI di luar ambang tanpa rencana pemulihan, **atau** ada risiko ekstrem terbuka, **atau** *milestone* utama terlewat | Eskalasi ke PSC pada kesempatan pertama; tinjauan menyeluruh |

**Aturan anti-"hijau abadi".** Proyek yang berubah dari Hijau langsung ke Merah tanpa
melewati Kuning menandakan kegagalan pelaporan, bukan kejutan. PMD mencatatnya sebagai
temuan proses dan menindaklanjuti dengan PM terkait.

## 2. KPI tingkat portofolio (milik PMD)

Dilaporkan bulanan dalam Portfolio Review.

| KPI | Definisi | Target ⚠️ KALIBRASI |
|-----|----------|---------------------|
| Ketepatan waktu portofolio | Proyek selesai tepat waktu ÷ proyek selesai | ≥ 75% |
| Ketepatan anggaran portofolio | Proyek selesai dalam anggaran ÷ proyek selesai | ≥ 80% |
| Kepatuhan gate | Gate dilewati dengan berita acara lengkap ÷ total gate | 100% |
| Waktu keputusan gate | Rata-rata hari kerja dari pengajuan sampai keputusan | ≤ 10 hari |
| Kelengkapan artefak | Artefak wajib tersedia ÷ artefak wajib seharusnya | ≥ 95% |
| Realisasi manfaat | Proyek dengan manfaat terukur tercapai ÷ proyek yang sudah lewat F5 | ≥ 70% |
| Tingkat penghentian dini | Proyek dihentikan di gate ÷ total proyek masuk | Dipantau, bukan ditekan ke nol |

> Catatan: tingkat penghentian dini **nol** bukan prestasi. Itu justru tanda gate tidak
> berfungsi sebagai penyaring.

## 3. Irama pelaporan

| Laporan | Penyusun | Penerima | Frekuensi | Format |
|---------|----------|----------|-----------|--------|
| Status proyek | PM | Sponsor, PMD | T1 mingguan · T2 dwi-mingguan · T3 bulanan | [TPL-06](./templates/TPL-06-status-report.md) |
| Ringkasan eksekutif | PM | PSC | Bulanan / per gate | 1 halaman, diturunkan dari TPL-06 |
| Dasbor portofolio | PMD | Direksi, seluruh Sponsor | Bulanan | Dasbor |
| Laporan gate | PMD | Sponsor, PSC | Per gate | [TPL-07](./templates/TPL-07-gate-review-checklist.md) |
| Laporan penutupan | PM | Sponsor, PSC, PMD | Per proyek | [TPL-08](./templates/TPL-08-project-closure.md) |
| Laporan realisasi manfaat | Sponsor | PSC, PMD | 3–12 bulan pasca go-live | Bebas, memuat angka pembanding |

**Batas waktu penyerahan:** laporan status diserahkan paling lambat **hari kerja kedua**
setelah periode pelaporan berakhir. Laporan yang terlambat dicatat dalam kepatuhan proses.

## 4. Prinsip penyusunan laporan

1. **Satu halaman untuk eksekutif.** Rincian ditaruh di lampiran, bukan di badan laporan.
2. **Angka sebelum narasi.** Status warna dan KPI di bagian atas; penjelasan menyusul.
3. **Setiap hal merah butuh pemilik dan tanggal.** Masalah tanpa nama dan tanggal bukan
   laporan, hanya keluhan.
4. **Bandingkan terhadap *baseline*, bukan terhadap laporan sebelumnya.** Perbandingan
   antar-laporan menyembunyikan penyimpangan yang menumpuk perlahan.
5. **Jangan ubah definisi metrik di tengah proyek.** Bila terpaksa, cantumkan catatan
   perubahan definisi.

---

### Kendali Dokumen

| Atribut | Nilai |
|---------|-------|
| Versi | 0.1 (draft baseline) |
| Pemilik dokumen | Head of PMD ⚠️ KALIBRASI |
| Dokumen terkait | 01, 02, 05, TPL-06, TPL-07 |
