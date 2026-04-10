export function formatRupiah(amount: number): string {
  return `Rp ${amount.toLocaleString("id-ID")}`
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-"
  return new Date(dateStr).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function formatDateShort(dateStr: string | null | undefined): string {
  if (!dateStr) return "-"
  return new Date(dateStr).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function formatCurrency(amount: number, currency = "IDR"): string {
  if (currency === "IDR") return formatRupiah(amount)
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount)
}
