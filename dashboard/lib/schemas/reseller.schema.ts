import { z } from "zod"

const telegramIdField = z.string().trim()
  .refine((v) => !v || /^\-?\d+$/.test(v), { message: "Telegram ID harus berupa angka" })
  .optional()
  .or(z.literal(""))

export const addResellerSchema = z.object({
  name: z.string().min(1, "Name is required").trim(),
  phone: z.string().trim().optional().or(z.literal("")),
  telegramId: telegramIdField,
  balance: z.string().optional().or(z.literal("")),
  discount: z.string().optional().or(z.literal("")),
  voucherGroup: z.string().trim().optional().or(z.literal("")),
  uplink: z.string().trim().optional().or(z.literal("")),
})

export type AddResellerFormData = z.infer<typeof addResellerSchema>

export const editResellerSchema = z.object({
  name: z.string().trim().optional().or(z.literal("")),
  phone: z.string().trim().optional().or(z.literal("")),
  telegramId: telegramIdField,
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  discount: z.string().optional().or(z.literal("")),
  voucherGroup: z.string().trim().optional().or(z.literal("")),
  uplink: z.string().trim().optional().or(z.literal("")),
})

export type EditResellerFormData = z.infer<typeof editResellerSchema>

export const saldoSchema = z.object({
  amount: z.string().min(1, "Amount is required").refine(
    (v) => {
      const n = parseInt(v)
      return !isNaN(n) && n > 0
    },
    { message: "Enter a valid amount greater than 0" }
  ),
  description: z.string().trim().optional().or(z.literal("")),
})

export type SaldoFormData = z.infer<typeof saldoSchema>
