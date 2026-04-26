import { z } from "zod"

export const addHotspotUserSchema = z.object({
  username: z.string().min(1, "Username is required").trim(),
  password: z.string().optional().or(z.literal("")),
  profile: z.string().optional().or(z.literal("")),
  server: z.string().optional().or(z.literal("")),
  limitUptime: z.string().optional().or(z.literal("")),
  limitBytesTotal: z.string().optional().or(z.literal("")),
  limitBytesIn: z.string().optional().or(z.literal("")),
  limitBytesOut: z.string().optional().or(z.literal("")),
  comment: z.string().optional().or(z.literal("")),
})

export type AddHotspotUserFormData = z.infer<typeof addHotspotUserSchema>
