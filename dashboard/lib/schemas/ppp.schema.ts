import { z } from "zod"

export const addPPPSecretSchema = z.object({
  name: z.string().min(1, "Name is required").trim(),
  password: z.string().min(1, "Password is required"),
  service: z.string().default("any"),
  profile: z.string().optional().or(z.literal("")),
  localAddress: z.string().optional().or(z.literal("")),
  remoteAddress: z.string().optional().or(z.literal("")),
  comment: z.string().optional().or(z.literal("")),
})

export type AddPPPSecretFormData = z.infer<typeof addPPPSecretSchema>
