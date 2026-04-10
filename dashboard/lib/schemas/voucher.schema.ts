import { z } from "zod"

export const generateVoucherSchema = z.object({
  profile: z.string().min(1, "Select a profile"),
  routerName: z.string().optional().or(z.literal("")),
  count: z.string().min(1, "Count is required").refine(
    (v) => {
      const n = parseInt(v)
      return !isNaN(n) && n > 0
    },
    { message: "Enter a valid count" }
  ),
  pricePerUnit: z.string().min(1, "Price is required").refine(
    (v) => {
      const n = parseInt(v)
      return !isNaN(n) && n > 0
    },
    { message: "Enter a valid price" }
  ),
})

export type GenerateVoucherFormData = z.infer<typeof generateVoucherSchema>
