import { z } from "zod"

export const addResellerSchema = z.object({
  name: z.string().min(1, "Name is required").trim(),
  phone: z.string().trim().optional().or(z.literal("")),
  telegramId: z.string().trim().optional().or(z.literal("")),
  balance: z.string().optional().or(z.literal("")),
})

export type AddResellerFormData = z.infer<typeof addResellerSchema>

export const editResellerSchema = z.object({
  name: z.string().trim().optional().or(z.literal("")),
  phone: z.string().trim().optional().or(z.literal("")),
  telegramId: z.string().trim().optional().or(z.literal("")),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
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
