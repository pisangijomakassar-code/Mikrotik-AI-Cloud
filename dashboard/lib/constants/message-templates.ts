import { FileText, AlertTriangle, Tag, type LucideIcon } from "lucide-react"

export interface MessageTemplate {
  label: string
  icon: LucideIcon
  content: string
}

export const MESSAGE_TEMPLATES: MessageTemplate[] = [
  {
    label: "Status Voucher",
    icon: FileText,
    content:
      "Halo! Berikut update status voucher Anda:\n\n- Voucher aktif: [jumlah]\n- Voucher terpakai: [jumlah]\n- Voucher tersisa: [jumlah]\n\nSilakan hubungi kami jika ada pertanyaan.",
  },
  {
    label: "Gangguan Jaringan",
    icon: AlertTriangle,
    content:
      "PEMBERITAHUAN\n\nSedang terjadi gangguan jaringan di area [lokasi].\n\nEstimasi perbaikan: [waktu]\n\nMohon maaf atas ketidaknyamanannya. Kami sedang berupaya menyelesaikan masalah ini secepat mungkin.",
  },
  {
    label: "Info Promo",
    icon: Tag,
    content:
      "PROMO SPESIAL!\n\nDapatkan diskon [persentase]% untuk pembelian voucher paket [nama paket].\n\nPromo berlaku: [tanggal mulai] - [tanggal selesai]\n\nHubungi kami untuk info lebih lanjut!",
  },
]

export const MAX_MESSAGE_CHARS = 4000
