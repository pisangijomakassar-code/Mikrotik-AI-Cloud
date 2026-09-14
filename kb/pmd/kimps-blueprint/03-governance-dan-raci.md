# 03 — Tata Kelola & RACI

## 1. Peran dan tanggung jawab

| Peran | Tanggung jawab pokok | Kewenangan kunci |
|-------|----------------------|------------------|
| **Project Sponsor** | Pemilik manfaat bisnis; mengamankan dana dan sumber daya; memutuskan di gate | Menyetujui charter, *baseline*, dan perubahan dalam batas kewenangannya; menghentikan proyek |
| **Project Steering Committee (PSC)** | Forum pengarah lintas fungsi; memutuskan hal yang melampaui kewenangan Sponsor | Keputusan gate Tier 1; persetujuan perubahan besar; penyelesaian konflik antar unit |
| **Project Manager (PM)** | Perencanaan, eksekusi harian, pengendalian, pelaporan | Mengelola cadangan kontinjensi; menugaskan tim proyek; mengeskalasi |
| **PMD (Project Management Department)** | Penjaga metodologi; penjamin mutu proses; pengelola portofolio dan KB | Menolak gate yang tidak memenuhi syarat administratif; menaikkan tier proyek |
| **Business Owner / Pengguna** | Menetapkan kebutuhan dan kriteria penerimaan; melakukan UAT | Menerima atau menolak deliverable |
| **Technical Lead** | Kelayakan teknis, arsitektur, mutu teknis | Keputusan desain teknis dalam batas lingkup |
| **Procurement & Finance** | Proses pengadaan, kontrak, kontrol anggaran | Verifikasi ketersediaan dana; validasi kepatuhan pengadaan |
| **Risk & Compliance** | Tinjauan risiko dan kepatuhan | Menahan gate bila ada isu kepatuhan terbuka |

> ⚠️ KALIBRASI — nama jabatan di atas bersifat generik. PMD perlu memetakannya ke struktur
> organisasi yang berlaku.

## 2. Matriks RACI

**R** = Responsible (mengerjakan) · **A** = Accountable (bertanggung gugat, hanya satu) ·
**C** = Consulted (dimintai pendapat) · **I** = Informed (diberi tahu)

| Aktivitas | Sponsor | PSC | PM | PMD | Business Owner | Tech Lead | Proc. & Fin. |
|-----------|:-------:|:---:|:--:|:---:|:--------------:|:---------:|:------------:|
| Pengajuan intake (F0) | A | I | C | R | R | I | I |
| Penetapan tier | C | I | C | **A/R** | I | I | I |
| Penyusunan Project Charter | **A** | I | R | C | C | C | C |
| Keputusan Gate G0–G1 | **A** | C | R | C | C | I | I |
| Penyusunan WBS & jadwal | I | I | **A/R** | C | C | C | I |
| Penetapan *baseline* biaya | **A** | I | R | C | I | C | C |
| Keputusan Gate G2 | **A** | C¹ | R | C | C | I | C |
| Pengelolaan risiko harian | I | I | **A/R** | C | C | C | I |
| Persetujuan Change Request | Lihat §3 | Lihat §3 | R | C | C | C | C |
| Pelaporan status berkala | I | I | **A/R** | C | I | I | I |
| Pengujian penerimaan (UAT) | I | I | C | I | **A/R** | C | I |
| Keputusan Gate G3 (go-live) | **A** | C¹ | R | C | C | C | I |
| Penutupan kontrak vendor | I | I | C | I | I | I | **A/R** |
| Keputusan Gate G4 | **A** | I | R | C | C | I | C |
| Lessons learned | I | I | R | **A** | C | C | I |
| Pengukuran realisasi manfaat (F5) | **A** | I | I | R | R | I | C |

¹ Untuk Tier 1, PSC berubah dari **C** menjadi **A** — keputusan gate ada di forum, bukan
pada Sponsor seorang diri.

## 3. Batas kewenangan perubahan (*Delegation of Authority*)

⚠️ KALIBRASI — seluruh ambang di bawah ini **wajib** diselaraskan dengan kebijakan DoA
korporat sebelum diberlakukan.

| Dampak perubahan terhadap *baseline* | Pemutus |
|--------------------------------------|---------|
| Biaya ≤ 2% **dan** jadwal ≤ 5 hari kerja, tanpa perubahan lingkup | Project Manager (memakai cadangan kontinjensi) |
| Biaya 2–10% **atau** jadwal 5–20 hari kerja | Project Sponsor |
| Biaya > 10% **atau** jadwal > 20 hari kerja **atau** perubahan lingkup material | Project Steering Committee |
| Perubahan sasaran proyek atau *business case* | PSC + Direksi |

Aturan turunan:
- Perubahan tidak boleh dipecah-pecah agar jatuh di bawah ambang. PMD memantau akumulasi
  *Change Request* terhadap *baseline* awal.
- Setiap perubahan yang memakai cadangan kontinjensi tetap wajib dicatat, meski berada
  dalam kewenangan PM.

## 4. Forum dan irama rapat

| Forum | Peserta | Frekuensi | Keluaran |
|-------|---------|-----------|----------|
| Rapat tim proyek | PM, tim inti | Mingguan | Rencana kerja, tindak lanjut isu |
| Rapat Sponsor | Sponsor, PM, PMD | Dwi-mingguan (T1) / Bulanan (T2) | Keputusan dalam kewenangan Sponsor |
| Project Steering Committee | PSC, Sponsor, PM, PMD | Bulanan (T1) / Sesuai gate (T2) | Keputusan gate, eskalasi, perubahan besar |
| Portfolio Review PMD | Head of PMD, seluruh PM | Bulanan | Status portofolio, alokasi sumber daya |
| Gate Review | Sesuai tier, lihat [02](./02-lifecycle-dan-gate.md) | Per gate | Berita acara keputusan gate |

## 5. Prinsip eskalasi

1. **Eskalasi bukan kegagalan.** Menahan masalah sampai gate berikutnya adalah kegagalan.
2. **Eskalasi berjenjang:** PM → Sponsor → PSC → Direksi. Melompati jenjang hanya untuk
   isu keselamatan, hukum, atau kepatuhan.
3. **Batas waktu keputusan:** setiap eskalasi harus mendapat keputusan dalam **10 hari
   kerja** ⚠️ KALIBRASI. Lewat batas itu, PMD mengangkatnya ke jenjang berikutnya secara
   otomatis.
4. **Eskalasi harus membawa opsi.** PM wajib menyertakan minimal dua alternatif beserta
   konsekuensinya, bukan hanya melaporkan masalah.

---

### Kendali Dokumen

| Atribut | Nilai |
|---------|-------|
| Versi | 0.1 (draft baseline) |
| Pemilik dokumen | Head of PMD ⚠️ KALIBRASI |
| Ketergantungan | Kebijakan *Delegation of Authority* korporat |
