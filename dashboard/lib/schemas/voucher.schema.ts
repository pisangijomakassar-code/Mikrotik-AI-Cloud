import { z } from "zod"

export const CHAR_TYPES = [
  { value: "numeric", label: "Angka (1234)" },
  { value: "upper", label: "Huruf Besar (ABC)" },
  { value: "lower", label: "Huruf Kecil (abc)" },
  { value: "mixed", label: "Campuran (ABCabc)" },
  { value: "alphanumeric", label: "Alfanumerik (ABC123)" },
  { value: "all", label: "Semua (ABCabc123)" },
] as const

export const LOGIN_TYPES = [
  { value: "separate", label: "Username & Password terpisah" },
  { value: "same", label: "Username = Password" },
] as const

export const generateVoucherSchema = z.object({
  profile: z.string().min(1, "Pilih profile terlebih dahulu"),
  routerName: z.string().optional().or(z.literal("")),
  count: z.string().min(1, "Jumlah wajib diisi").refine(
    (v) => { const n = parseInt(v); return !isNaN(n) && n > 0 },
    { message: "Masukkan jumlah yang valid" }
  ),
  pricePerUnit: z.string().min(1, "Harga wajib diisi").refine(
    (v) => { const n = parseInt(v); return !isNaN(n) && n >= 0 },
    { message: "Masukkan harga yang valid" }
  ),
  prefix: z.string().optional().or(z.literal("")),
  usernameLength: z.string().optional().or(z.literal("")),
  passwordLength: z.string().optional().or(z.literal("")),
  charType: z.string().optional().or(z.literal("")),
  loginType: z.string().optional().or(z.literal("")),
  limitUptime: z.string().optional().or(z.literal("")),
  limitBytesTotal: z.string().optional().or(z.literal("")),
})

export type GenerateVoucherFormData = z.infer<typeof generateVoucherSchema>
